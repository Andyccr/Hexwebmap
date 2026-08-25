import {
  buildRasterStyle,
  getStyle,
  type InspectFeature,
} from "@hexwebmap/shared";
import type { Map as MapLibreMap, MapMouseEvent, StyleSpecification } from "maplibre-gl";

export function resolveStyle(styleId: string): string | StyleSpecification {
  const meta = getStyle(styleId);
  if (meta.kind === "raster") {
    const spec = buildRasterStyle(styleId);
    if (spec) return spec;
  }
  return meta.url;
}

export function inspectAtPoint(map: MapLibreMap, e: MapMouseEvent): InspectFeature[] {
  const rendered = map.queryRenderedFeatures(e.point);
  const seen = new Set<string>();
  const out: InspectFeature[] = [];
  for (const f of rendered) {
    if (f.layer?.id?.startsWith("hex-")) continue;
    const props = f.properties ?? {};
    const keys = Object.keys(props);
    if (keys.length === 0) continue;
    const sig = `${f.layer?.id}:${f.sourceLayer}:${keys
      .slice(0, 6)
      .map((k) => `${k}=${String(props[k])}`)
      .join("|")}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const properties: InspectFeature["properties"] = {};
    for (const [k, v] of Object.entries(props)) {
      if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        properties[k] = v;
      } else {
        properties[k] = String(v);
      }
    }
    out.push({
      layerId: f.layer?.id ?? "",
      sourceLayer: f.sourceLayer,
      geometryType: f.geometry?.type,
      properties,
    });
    if (out.length >= 6) break;
  }
  return out;
}
