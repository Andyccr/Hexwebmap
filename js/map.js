import { formatCoord, pathLengthMeters, simplifyForZoom } from "./geo.js";
import { parseMapHash, serializeMapHash } from "./hash.js";
import { getStyle, resolveStyle } from "./styles.js";
import { reverseGeocode } from "./api.js";

const ROUTE = "hex-route";
const MEASURE = "hex-measure";
const CLICK_PX2 = 36;
const INSPECT_DELAY = 240;

const ml = () => {
  const g = globalThis.maplibregl;
  if (!g) throw new Error("MapLibre GL failed to load");
  return g;
};

function reducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function deviceCap() {
  const dpr = globalThis.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  const coarse = globalThis.matchMedia?.("(pointer: coarse)")?.matches;
  const low = mem <= 2 || cores <= 2 || (coarse && mem <= 4);
  return {
    low,
    coarse: !!coarse,
    pixelRatio: Math.min(dpr, low ? 1.25 : 2),
    fadeDuration: reducedMotion() ? 0 : 90,
  };
}

function emptyLine() {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function createMapController(el, state, bus) {
  let map;
  let marker;
  let applyingHash = false;
  let reverseCtrl;
  let viewRaf = 0;
  let hashTimer = 0;
  let inspectTimer = 0;
  let pointerDown = null;
  const cap = deviceCap();
  const motion = () => (reducedMotion() ? 0 : undefined);

  function ensureOverlays() {
    if (!map.getSource(ROUTE)) {
      map.addSource(ROUTE, { type: "geojson", data: emptyLine() });
      map.addLayer({
        id: `${ROUTE}-casing`,
        type: "line",
        source: ROUTE,
        paint: { "line-color": "#2b3a55", "line-width": 8, "line-opacity": 0.85 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: `${ROUTE}-line`,
        type: "line",
        source: ROUTE,
        paint: { "line-color": "#3d7ea6", "line-width": 4.5, "line-opacity": 0.95 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getSource(MEASURE)) {
      map.addSource(MEASURE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: `${MEASURE}-line`,
        type: "line",
        source: MEASURE,
        filter: ["==", "$type", "LineString"],
        paint: { "line-color": "#9b3d3d", "line-width": 2.4, "line-dasharray": [2, 1.4] },
      });
      map.addLayer({
        id: `${MEASURE}-pts`,
        type: "circle",
        source: MEASURE,
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#fff",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#9b3d3d",
        },
      });
    }
  }

  function setRoute(coords) {
    const src = map.getSource(ROUTE);
    if (!src) return;
    if (!coords || coords.length < 2) {
      src.setData(emptyLine());
      return;
    }
    const drawn = simplifyForZoom(coords, map.getZoom());
    src.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: drawn },
    });
  }

  function setMeasure(points) {
    const src = map.getSource(MEASURE);
    if (!src) return;
    const features = points.map((coordinates, i) => ({
      type: "Feature",
      properties: { i },
      geometry: { type: "Point", coordinates },
    }));
    if (points.length >= 2) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: points },
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }

  function readView() {
    const c = map.getCenter();
    return {
      zoom: map.getZoom(),
      lat: c.lat,
      lon: c.lng,
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
  }

  function emitView() {
    const view = readView();
    state.view = view;
    bus.emit("view", view);
    return view;
  }

  function syncHash() {
    const view = emitView();
    if (applyingHash) return;
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const next = `${location.pathname}${location.search}${serializeMapHash(view, state.styleId)}`;
      const cur = `${location.pathname}${location.search}${location.hash}`;
      if (next !== cur) history.replaceState(null, "", next);
    }, 90);
  }

  function inspectAt(e) {
    if (map.getZoom() < 12) return [];
    const rendered = map.queryRenderedFeatures(e.point);
    const seen = new Set();
    const out = [];
    for (const f of rendered) {
      if (f.layer?.id?.startsWith("hex-")) continue;
      const props = f.properties || {};
      const keys = Object.keys(props);
      if (!keys.length) continue;
      const sig = `${f.layer?.id}:${f.sourceLayer}:${keys
        .slice(0, 6)
        .map((k) => `${k}=${props[k]}`)
        .join("|")}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({
        layerId: f.layer?.id || "",
        sourceLayer: f.sourceLayer,
        geometryType: f.geometry?.type,
        properties: props,
      });
      if (out.length >= 4) break;
    }
    return out;
  }

  function setMarker(lon, lat) {
    if (marker) {
      marker.setLngLat([lon, lat]);
      return;
    }
    marker = new ml().Marker({ color: "#5b8c5a", scale: 0.92 }).setLngLat([lon, lat]).addTo(map);
  }

  function pickPoint(e, mode) {
    const hit = {
      id: `pick-${e.lngLat.lng},${e.lngLat.lat}`,
      name: formatCoord(e.lngLat.lat, e.lngLat.lng),
      label: formatCoord(e.lngLat.lat, e.lngLat.lng),
      lat: e.lngLat.lat,
      lon: e.lngLat.lng,
    };
    if (mode === "route-from") state.routeFrom = hit;
    else state.routeTo = hit;
    state.clickMode = "browse";
    map.getCanvas().style.cursor = "";
    bus.emit("route-ends");
    bus.emit("panel", "route");
  }

  function inspectPlace(e) {
    const inspect = inspectAt(e);
    const approx = {
      name: formatCoord(e.lngLat.lat, e.lngLat.lng),
      displayName: formatCoord(e.lngLat.lat, e.lngLat.lng),
      lat: e.lngLat.lat,
      lon: e.lngLat.lng,
      address: {},
      extratags: {},
    };
    state.selected = approx;
    state.inspect = inspect;
    state.place = null;
    setMarker(approx.lon, approx.lat);
    bus.emit("place", approx);
    reverseCtrl?.abort();
    reverseCtrl = new AbortController();
    reverseGeocode(e.lngLat.lat, e.lngLat.lng, map.getZoom(), reverseCtrl.signal)
      .then((place) => {
        state.place = place;
        state.selected = place;
        setMarker(place.lon, place.lat);
        bus.emit("place-update", place);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
      });
  }

  const maplibregl = ml();
  const mapOptions = {
    container: el,
    style: resolveStyle(state.styleId),
    center: [state.view.lon, state.view.lat],
    zoom: state.view.zoom,
    bearing: state.view.bearing,
    pitch: state.view.pitch,
    hash: false,
    attributionControl: { compact: true },
    maxPitch: 75,
    minZoom: 0,
    maxZoom: 22,
    fadeDuration: cap.fadeDuration,
    canvasContextAttributes: {
      antialias: false,
      powerPreference: cap.low ? "low-power" : "default",
      alpha: false,
      failIfMajorPerformanceCaveat: false,
    },
    localIdeographFontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    pixelRatio: cap.pixelRatio,
    validateStyle: false,
    collectResourceTiming: false,
    refreshExpiredTiles: false,
    cancelPendingTileRequestsWhileZooming: true,
    crossSourceCollisions: false,
    maxTileCacheSize: cap.low ? 40 : 80,
    cooperativeGestures: false,
    touchPitch: !cap.coarse,
    renderWorldCopies: true,
  };
  try {
    map = new maplibregl.Map(mapOptions);
  } catch {
    const { canvasContextAttributes: _ignored, ...rest } = mapOptions;
    map = new maplibregl.Map(rest);
  }
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 140 }), "bottom-left");
  map.scrollZoom.setWheelZoomRate(1 / 420);
  map.scrollZoom.setZoomRate(1 / 180);
  map.dragPan.enable({ linearity: 0.35, maxSpeed: 1400, deceleration: 2500 });

  let styleArmed = true;
  map.on("error", (e) => {
    const err = e?.error || e;
    const msg = String(err?.message || err || "");
    const blob = `${msg} ${e?.sourceId || ""} ${err?.url || ""}`;
    if (!styleArmed && /tile|glyph|sprite|image|source/i.test(blob)) return;
    console.error("[hexwebmap]", err);
    if (styleArmed) bus.emit("map-error", err);
  });

  map.on("load", () => {
    styleArmed = false;
    ensureOverlays();
    state.loaded = true;
    bus.emit("loaded");
    syncHash();
  });
  map.on("style.load", () => {
    styleArmed = false;
    ensureOverlays();
    setRoute(state.route?.geometry?.coordinates || null);
    setMeasure(state.measure);
  });
  map.on("move", () => {
    if (viewRaf) return;
    viewRaf = requestAnimationFrame(() => {
      viewRaf = 0;
      emitView();
    });
  });
  map.on("moveend", syncHash);

  map.on("mousedown", (e) => {
    pointerDown = e.point;
  });
  map.on("touchstart", (e) => {
    pointerDown = e.point;
  });

  map.on("dblclick", (e) => {
    clearTimeout(inspectTimer);
    inspectTimer = 0;
    if (state.clickMode === "measure") {
      e.preventDefault();
      if (state.measure.length) {
        state.measure = state.measure.slice(0, -1);
        setMeasure(state.measure);
      }
      bus.emit("measure-end");
    }
  });

  map.on("click", (e) => {
    if (pointerDown && dist2(e.point, pointerDown) > CLICK_PX2) return;
    const lonlat = [e.lngLat.lng, e.lngLat.lat];
    if (state.clickMode === "measure") {
      state.measure = [...state.measure, lonlat];
      setMeasure(state.measure);
      bus.emit("measure", state.measure);
      return;
    }
    if (state.clickMode === "route-from" || state.clickMode === "route-to") {
      pickPoint(e, state.clickMode);
      return;
    }
    clearTimeout(inspectTimer);
    inspectTimer = setTimeout(() => inspectPlace(e), INSPECT_DELAY);
  });

  function flyTo(target) {
    const duration = motion() === 0 ? 0 : 700;
    const wide = globalThis.innerWidth > 760 && state.panel !== "none";
    const padding = wide
      ? { top: 48, left: 56, right: 380, bottom: 48 }
      : { top: 48, left: 56, right: 56, bottom: 48 };
    map.stop();
    if (target.bbox) {
      map.fitBounds(
        [
          [target.bbox[0], target.bbox[1]],
          [target.bbox[2], target.bbox[3]],
        ],
        { padding, duration, maxZoom: 16 },
      );
    } else {
      map.easeTo({
        center: [target.lon, target.lat],
        zoom: target.zoom ?? Math.max(map.getZoom(), 12.5),
        duration,
      });
    }
  }

  window.addEventListener("hashchange", () => {
    const parsed = parseMapHash(location.hash);
    if (!parsed) return;
    applyingHash = true;
    map.stop();
    map.jumpTo({
      center: [parsed.lon ?? map.getCenter().lng, parsed.lat ?? map.getCenter().lat],
      zoom: parsed.zoom ?? map.getZoom(),
      bearing: parsed.bearing ?? map.getBearing(),
      pitch: parsed.pitch ?? map.getPitch(),
    });
    if (parsed.style && parsed.style !== state.styleId) {
      state.styleId = parsed.style;
      localStorage.setItem("hexwebmap.style", parsed.style);
      map.setStyle(resolveStyle(parsed.style));
      bus.emit("style", parsed.style);
    }
    requestAnimationFrame(() => {
      applyingHash = false;
    });
  });

  return {
    map,
    setStyle(id) {
      if (id === state.styleId && map.isStyleLoaded?.()) return;
      styleArmed = true;
      state.styleId = id;
      localStorage.setItem("hexwebmap.style", id);
      map.setStyle(resolveStyle(id));
      bus.emit("style", id);
      syncHash();
    },
    setRoute,
    setMeasure,
    setMarker,
    clearMarker() {
      marker?.remove();
      marker = null;
    },
    flyTo,
    zoomBy(delta) {
      map.stop();
      map.easeTo({
        zoom: map.getZoom() + delta,
        duration: motion() === 0 ? 0 : 150,
        easing: (t) => t,
      });
    },
    panBy(x, y) {
      map.stop();
      map.panBy([x, y], { duration: motion() === 0 ? 0 : 120 });
    },
    rotateBy(deg) {
      map.stop();
      map.easeTo({ bearing: map.getBearing() + deg, duration: motion() === 0 ? 0 : 180 });
    },
    north() {
      map.stop();
      map.easeTo({ bearing: 0, pitch: 0, duration: motion() === 0 ? 0 : 320 });
    },
    tilt() {
      map.stop();
      map.easeTo({ pitch: map.getPitch() > 20 ? 0 : 50, duration: motion() === 0 ? 0 : 360 });
    },
    setCursor(mode) {
      map.getCanvas().style.cursor = mode === "browse" ? "" : "crosshair";
    },
    measureLength() {
      return pathLengthMeters(state.measure);
    },
    getStyleMeta() {
      return getStyle(state.styleId);
    },
  };
}
