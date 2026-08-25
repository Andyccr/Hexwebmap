import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

const ROUTE = "hex-route";
const MEASURE = "hex-measure";

function emptyLine(): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

function emptyPoints(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export function ensureOverlays(map: MapLibreMap) {
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
    map.addSource(MEASURE, { type: "geojson", data: emptyPoints() });
    map.addLayer({
      id: `${MEASURE}-line`,
      type: "line",
      source: MEASURE,
      filter: ["==", "$type", "LineString"],
      paint: {
        "line-color": "#9b3d3d",
        "line-width": 2.4,
        "line-dasharray": [2, 1.4],
      },
    });
    map.addLayer({
      id: `${MEASURE}-pts`,
      type: "circle",
      source: MEASURE,
      filter: ["==", "$type", "Point"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#f4f1ea",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#9b3d3d",
      },
    });
  }
}

export function setRouteData(map: MapLibreMap, coords: [number, number][] | null) {
  const src = map.getSource(ROUTE) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(
    coords && coords.length >= 2
      ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }
      : emptyLine(),
  );
}

export function setMeasureData(map: MapLibreMap, points: [number, number][]) {
  const src = map.getSource(MEASURE) as GeoJSONSource | undefined;
  if (!src) return;
  const features: GeoJSON.Feature[] = points.map((coordinates, i) => ({
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
