import { formatCoord, pathLengthMeters } from "./geo.js";
import { parseMapHash, serializeMapHash } from "./hash.js";
import { getStyle, resolveStyle } from "./styles.js";
import { reverseGeocode } from "./api.js";

const ROUTE = "hex-route";
const MEASURE = "hex-measure";

function emptyLine() {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

export function createMapController(el, state, bus) {
  let map;
  let marker;
  let applyingHash = false;
  let reverseCtrl;
  let styleReady = false;

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
    src.setData(
      coords && coords.length >= 2
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }
        : emptyLine(),
    );
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

  function syncHash() {
    const c = map.getCenter();
    const view = {
      zoom: map.getZoom(),
      lat: c.lat,
      lon: c.lng,
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
    state.view = view;
    bus.emit("view", view);
    if (applyingHash) return;
    const url = `${location.pathname}${location.search}${serializeMapHash(view, state.styleId)}`;
    history.replaceState(null, "", url);
  }

  function inspectAt(e) {
    const rendered = map.queryRenderedFeatures(e.point);
    const seen = new Set();
    const out = [];
    for (const f of rendered) {
      if (f.layer?.id?.startsWith("hex-")) continue;
      const props = f.properties || {};
      const keys = Object.keys(props);
      if (!keys.length) continue;
      const sig = `${f.layer?.id}:${f.sourceLayer}:${keys.slice(0, 6).map((k) => `${k}=${props[k]}`).join("|")}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({
        layerId: f.layer?.id || "",
        sourceLayer: f.sourceLayer,
        geometryType: f.geometry?.type,
        properties: props,
      });
      if (out.length >= 6) break;
    }
    return out;
  }

  map = new maplibregl.Map({
    container: el,
    style: resolveStyle(state.styleId),
    center: [state.view.lon, state.view.lat],
    zoom: state.view.zoom,
    bearing: state.view.bearing,
    pitch: state.view.pitch,
    hash: false,
    attributionControl: { compact: true },
    maxPitch: 85,
    fadeDuration: 120,
    canvasContextAttributes: { antialias: true, powerPreference: "high-performance" },
    localIdeographFontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    pixelRatio: Math.min(devicePixelRatio || 1, 2),
  });
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 140 }), "bottom-left");

  map.on("load", () => {
    ensureOverlays();
    state.loaded = true;
    bus.emit("loaded");
    syncHash();
  });
  map.on("style.load", () => {
    ensureOverlays();
    setRoute(state.route?.geometry?.coordinates || null);
    setMeasure(state.measure);
  });
  map.on("moveend", syncHash);

  map.on("click", (e) => {
    const lonlat = [e.lngLat.lng, e.lngLat.lat];
    if (state.clickMode === "measure") {
      state.measure = [...state.measure, lonlat];
      setMeasure(state.measure);
      bus.emit("measure", state.measure);
      return;
    }
    if (state.clickMode === "route-from" || state.clickMode === "route-to") {
      const hit = {
        id: `pick-${lonlat.join(",")}`,
        name: formatCoord(e.lngLat.lat, e.lngLat.lng),
        label: formatCoord(e.lngLat.lat, e.lngLat.lng),
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
      };
      if (state.clickMode === "route-from") state.routeFrom = hit;
      else state.routeTo = hit;
      state.clickMode = "browse";
      map.getCanvas().style.cursor = "";
      bus.emit("route-ends");
      bus.emit("panel", "route");
      return;
    }
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
        bus.emit("place", place);
      })
      .catch(() => {});
  });

  function setMarker(lon, lat) {
    marker?.remove();
    marker = new maplibregl.Marker({ color: "#5b8c5a" }).setLngLat([lon, lat]).addTo(map);
  }

  function flyTo(target) {
    if (target.bbox) {
      map.fitBounds(
        [
          [target.bbox[0], target.bbox[1]],
          [target.bbox[2], target.bbox[3]],
        ],
        { padding: 72, duration: 900, maxZoom: 16 },
      );
    } else {
      map.easeTo({
        center: [target.lon, target.lat],
        zoom: target.zoom ?? Math.max(map.getZoom(), 12.5),
        duration: 800,
      });
    }
  }

  window.addEventListener("hashchange", () => {
    const parsed = parseMapHash(location.hash);
    if (!parsed) return;
    applyingHash = true;
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
      if (!styleReady) {
        styleReady = true;
        if (id === state.styleId) return;
      }
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
      map.zoomTo(map.getZoom() + delta, { duration: 240 });
    },
    north() {
      map.easeTo({ bearing: 0, pitch: 0, duration: 400 });
    },
    tilt() {
      map.easeTo({ pitch: map.getPitch() > 20 ? 0 : 55, duration: 450 });
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
