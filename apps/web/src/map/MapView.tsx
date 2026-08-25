import { useEffect, useRef } from "react";
import maplibregl, { type MapMouseEvent, type Marker } from "maplibre-gl";
import {
  formatCoord,
  parseMapHash,
  pathLengthMeters,
  serializeMapHash,
  type ReversePlace,
  type SearchHit,
} from "@hexwebmap/shared";
import { reverseGeocode } from "../api";
import { t } from "../i18n";
import { useMapStore } from "../store";
import { ensureOverlays, setMeasureData, setRouteData } from "./overlays";
import { inspectAtPoint, resolveStyle } from "./style";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const applyingHash = useRef(false);
  const reverseCtrl = useRef<AbortController | null>(null);

  const styleId = useMapStore((s) => s.styleId);
  const lang = useMapStore((s) => s.lang);
  const clickMode = useMapStore((s) => s.clickMode);
  const selected = useMapStore((s) => s.selected);
  const route = useMapStore((s) => s.route);
  const measurePts = useMapStore((s) => s.measure.points);
  const flyTo = useMapStore((s) => s.flyTo);
  const loaded = useMapStore((s) => s.loaded);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { view, styleId: initialStyle } = useMapStore.getState();
    const map = new maplibregl.Map({
      container: el,
      style: resolveStyle(initialStyle),
      center: [view.lon, view.lat],
      zoom: view.zoom,
      bearing: view.bearing,
      pitch: view.pitch,
      hash: false,
      attributionControl: { compact: true },
      maxPitch: 85,
      fadeDuration: 120,
      canvasContextAttributes: { antialias: true, powerPreference: "high-performance" },
      localIdeographFontFamily: "'Noto Sans SC', 'Noto Sans CJK SC', sans-serif",
      pixelRatio: Math.min(window.devicePixelRatio, 2),
    });
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 140 }), "bottom-left");
    mapRef.current = map;

    const syncView = () => {
      const c = map.getCenter();
      const next = {
        zoom: map.getZoom(),
        lat: c.lat,
        lon: c.lng,
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      useMapStore.getState().setView(next);
      if (applyingHash.current) return;
      const hash = serializeMapHash(next, useMapStore.getState().styleId);
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
        history.replaceState(null, "", url);
      }
    };

    map.on("load", () => {
      ensureOverlays(map);
      useMapStore.getState().setLoaded(true);
      syncView();
    });
    map.on("style.load", () => {
      ensureOverlays(map);
      const st = useMapStore.getState();
      setRouteData(map, st.route?.geometry.coordinates ?? null);
      setMeasureData(map, st.measure.points);
    });
    map.on("moveend", syncView);

    let frames = 0;
    let last = performance.now();
    const onRender = () => {
      frames += 1;
      const now = performance.now();
      if (now - last >= 500) {
        useMapStore.getState().setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
    };
    map.on("render", onRender);

    const onHash = () => {
      const parsed = parseMapHash(window.location.hash);
      if (!parsed) return;
      applyingHash.current = true;
      map.jumpTo({
        center: [parsed.lon ?? map.getCenter().lng, parsed.lat ?? map.getCenter().lat],
        zoom: parsed.zoom ?? map.getZoom(),
        bearing: parsed.bearing ?? map.getBearing(),
        pitch: parsed.pitch ?? map.getPitch(),
      });
      if (parsed.style) useMapStore.getState().setStyle(parsed.style);
      requestAnimationFrame(() => {
        applyingHash.current = false;
      });
    };
    window.addEventListener("hashchange", onHash);
    const onZoom = (ev: Event) => {
      const delta = (ev as CustomEvent<number>).detail ?? 1;
      map.zoomTo(map.getZoom() + delta, { duration: 240 });
    };
    const onNorth = () => map.easeTo({ bearing: 0, pitch: 0, duration: 400 });
    const onTilt = () => map.easeTo({ pitch: map.getPitch() > 20 ? 0 : 55, duration: 450 });
    window.addEventListener("hex-zoom", onZoom);
    window.addEventListener("hex-north", onNorth);
    window.addEventListener("hex-tilt", onTilt);

    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("hex-zoom", onZoom);
      window.removeEventListener("hex-north", onNorth);
      window.removeEventListener("hex-tilt", onTilt);
      map.off("render", onRender);
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const styleReady = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!styleReady.current) {
      styleReady.current = true;
      return;
    }
    map.setStyle(resolveStyle(styleId));
  }, [styleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: MapMouseEvent) => {
      const st = useMapStore.getState();
      const lonlat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (st.clickMode === "measure") {
        st.addMeasurePoint(lonlat);
        return;
      }
      if (st.clickMode === "route-from" || st.clickMode === "route-to") {
        const hit: SearchHit = {
          id: `pick-${lonlat.join(",")}`,
          name: formatCoord(e.lngLat.lat, e.lngLat.lng),
          label: formatCoord(e.lngLat.lat, e.lngLat.lng),
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
        };
        st.setRouteEndpoint(st.clickMode === "route-from" ? "from" : "to", hit);
        st.setClickMode("browse");
        st.setPanel("directions");
        return;
      }
      const inspect = inspectAtPoint(map, e);
      const approx: ReversePlace = {
        name: formatCoord(e.lngLat.lat, e.lngLat.lng),
        displayName: formatCoord(e.lngLat.lat, e.lngLat.lng),
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
        address: {},
        extratags: {},
      };
      st.selectPlace(approx, inspect);
      reverseCtrl.current?.abort();
      const ctrl = new AbortController();
      reverseCtrl.current = ctrl;
      void reverseGeocode(e.lngLat.lat, e.lngLat.lng, map.getZoom(), ctrl.signal)
        .then((place) => {
          const cur = useMapStore.getState();
          cur.setPlaceDetails(place);
          cur.selectPlace(place, inspect);
        })
        .catch(() => {
          /* keep coordinate fallback */
        });
    };
    map.on("click", onClick);
    map.getCanvas().style.cursor = clickMode === "browse" ? "" : "crosshair";
    return () => {
      map.off("click", onClick);
    };
  }, [clickMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setRouteData(map, route?.geometry.coordinates ?? null);
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setMeasureData(map, measurePts);
  }, [measurePts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!selected) return;
    markerRef.current = new maplibregl.Marker({ color: "#5b8c5a" })
      .setLngLat([selected.lon, selected.lat])
      .addTo(map);
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    if (flyTo.bbox) {
      map.fitBounds(
        [
          [flyTo.bbox[0], flyTo.bbox[1]],
          [flyTo.bbox[2], flyTo.bbox[3]],
        ],
        { padding: 72, duration: 900, maxZoom: 16 },
      );
    } else {
      map.easeTo({
        center: [flyTo.lon, flyTo.lat],
        zoom: flyTo.zoom ?? Math.max(map.getZoom(), 12.5),
        duration: 800,
      });
    }
    useMapStore.getState().clearFly();
  }, [flyTo]);

  const msg = t(lang);
  const measureLen = pathLengthMeters(measurePts);

  return (
    <div className="map-stage">
      <div ref={containerRef} className="map-root" role="application" aria-label="map" />
      {!loaded && (
        <div className="map-loading">
          <div className="map-loading-mark" />
          <p>{msg.loading}</p>
        </div>
      )}
      {clickMode === "measure" && (
        <div className="measure-banner">
          {msg.measuring}
          {measurePts.length >= 2
            ? ` · ${measureLen >= 1000 ? `${(measureLen / 1000).toFixed(2)} km` : `${Math.round(measureLen)} m`}`
            : ""}
        </div>
      )}
    </div>
  );
}
