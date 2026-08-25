import type { MapStyle } from "./types.ts";

const OSM_ATTR = "© OpenStreetMap contributors";
const OFM_ATTR = "© OpenMapTiles © OpenStreetMap contributors";
const OTM_ATTR = "© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)";
const ESRI_ATTR =
  "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

function rasterStyleUrl(id: string): string {
  return `/styles/${id}.json`;
}

export const MAP_STYLES: MapStyle[] = [
  {
    id: "liberty",
    kind: "vector",
    group: "carto",
    name: { zh: "OSM Liberty", en: "OSM Liberty" },
    description: { zh: "最接近 OpenStreetMap 的矢量地图", en: "Vector style closest to classic OSM" },
    url: "https://tiles.openfreemap.org/styles/liberty",
  },
  {
    id: "bright",
    kind: "vector",
    group: "carto",
    name: { zh: "OSM Bright", en: "OSM Bright" },
    description: { zh: "明亮、道路对比更强", en: "Bright cartography with stronger roads" },
    url: "https://tiles.openfreemap.org/styles/bright",
  },
  {
    id: "osm",
    kind: "raster",
    group: "carto",
    name: { zh: "OSM 标准栅格", en: "OSM Standard" },
    description: { zh: "经典 openstreetmap.org 渲染", en: "Classic openstreetmap.org Carto raster" },
    url: rasterStyleUrl("osm"),
  },
  {
    id: "positron",
    kind: "vector",
    group: "theme",
    name: { zh: "浅色底图", en: "Positron" },
    description: { zh: "低对比浅色，适合叠加数据", en: "Light basemap for overlays" },
    url: "https://tiles.openfreemap.org/styles/positron",
  },
  {
    id: "dark",
    kind: "vector",
    group: "theme",
    name: { zh: "深色底图", en: "Dark" },
    description: { zh: "夜间阅读与演示", en: "Night-friendly dark basemap" },
    url: "https://tiles.openfreemap.org/styles/dark",
  },
  {
    id: "fiord",
    kind: "vector",
    group: "theme",
    name: { zh: "峡湾蓝", en: "Fiord" },
    description: { zh: "冷色调海洋风格", en: "Cool blue marine theme" },
    url: "https://tiles.openfreemap.org/styles/fiord",
  },
  {
    id: "hot",
    kind: "raster",
    group: "special",
    name: { zh: "人道主义", en: "Humanitarian" },
    description: { zh: "HOT 风格，突出设施与道路", en: "HOT style emphasizing amenities" },
    url: rasterStyleUrl("hot"),
  },
  {
    id: "cyclosm",
    kind: "raster",
    group: "special",
    name: { zh: "骑行", en: "CyclOSM" },
    description: { zh: "自行车道与坡度", en: "Cycling infrastructure and hills" },
    url: rasterStyleUrl("cyclosm"),
  },
  {
    id: "topo",
    kind: "raster",
    group: "special",
    name: { zh: "地形", en: "OpenTopoMap" },
    description: { zh: "等高线与地貌晕渲", en: "Contours and hillshade" },
    url: rasterStyleUrl("topo"),
  },
  {
    id: "satellite",
    kind: "raster",
    group: "special",
    name: { zh: "卫星影像", en: "Satellite" },
    description: { zh: "全球卫星影像底图", en: "Worldwide satellite imagery" },
    url: rasterStyleUrl("satellite"),
  },
];

export const DEFAULT_STYLE_ID = "liberty";

export const RASTER_STYLE_SPECS: Record<
  string,
  { tiles: string[]; attribution: string; maxzoom: number; tileSize?: number }
> = {
  osm: {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: OSM_ATTR,
    maxzoom: 19,
  },
  hot: {
    tiles: ["https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"],
    attribution: `${OSM_ATTR} · Humanitarian OSM Team`,
    maxzoom: 20,
  },
  cyclosm: {
    tiles: ["https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"],
    attribution: `${OSM_ATTR} · CyclOSM`,
    maxzoom: 20,
  },
  topo: {
    tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
    attribution: OTM_ATTR,
    maxzoom: 17,
  },
  satellite: {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: ESRI_ATTR,
    maxzoom: 19,
    tileSize: 256,
  },
};

export function buildRasterStyle(id: string) {
  const spec = RASTER_STYLE_SPECS[id];
  if (!spec) return null;
  return {
    version: 8 as const,
    name: id,
    sources: {
      raster: {
        type: "raster" as const,
        tiles: spec.tiles,
        tileSize: spec.tileSize ?? 256,
        attribution: spec.attribution,
        maxzoom: spec.maxzoom,
      },
    },
    layers: [
      {
        id: "raster",
        type: "raster" as const,
        source: "raster",
      },
    ],
  };
}

export const VECTOR_ATTRIBUTION = OFM_ATTR;

export function getStyle(id: string): MapStyle {
  return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]!;
}
