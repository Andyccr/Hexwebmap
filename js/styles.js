export const DEFAULT_STYLE_ID = "liberty";

export const MAP_STYLES = [
  {
    id: "liberty",
    kind: "vector",
    group: "carto",
    name: { zh: "OSM Liberty", en: "OSM Liberty" },
    description: { zh: "最接近 OSM 的矢量地图", en: "Closest to classic OSM" },
    url: "https://tiles.openfreemap.org/styles/liberty",
  },
  {
    id: "bright",
    kind: "vector",
    group: "carto",
    name: { zh: "OSM Bright", en: "OSM Bright" },
    description: { zh: "明亮道路对比", en: "Bright roads" },
    url: "https://tiles.openfreemap.org/styles/bright",
  },
  {
    id: "osm",
    kind: "raster",
    group: "carto",
    name: { zh: "OSM 标准栅格", en: "OSM Standard" },
    description: { zh: "经典 openstreetmap.org", en: "Classic Carto raster" },
  },
  {
    id: "positron",
    kind: "vector",
    group: "theme",
    name: { zh: "浅色底图", en: "Positron" },
    description: { zh: "低对比浅色", en: "Light basemap" },
    url: "https://tiles.openfreemap.org/styles/positron",
  },
  {
    id: "dark",
    kind: "vector",
    group: "theme",
    name: { zh: "深色底图", en: "Dark" },
    description: { zh: "夜间阅读", en: "Night-friendly" },
    url: "https://tiles.openfreemap.org/styles/dark",
  },
  {
    id: "fiord",
    kind: "vector",
    group: "theme",
    name: { zh: "峡湾蓝", en: "Fiord" },
    description: { zh: "冷色海洋", en: "Cool marine" },
    url: "https://tiles.openfreemap.org/styles/fiord",
  },
  {
    id: "hot",
    kind: "raster",
    group: "special",
    name: { zh: "人道主义", en: "Humanitarian" },
    description: { zh: "HOT 风格", en: "HOT style" },
  },
  {
    id: "cyclosm",
    kind: "raster",
    group: "special",
    name: { zh: "骑行", en: "CyclOSM" },
    description: { zh: "自行车道", en: "Cycling map" },
  },
  {
    id: "topo",
    kind: "raster",
    group: "special",
    name: { zh: "地形", en: "OpenTopoMap" },
    description: { zh: "等高线", en: "Contours" },
  },
  {
    id: "satellite",
    kind: "raster",
    group: "special",
    name: { zh: "卫星影像", en: "Satellite" },
    description: { zh: "全球影像", en: "World imagery" },
  },
];

const RASTERS = {
  osm: {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
    maxzoom: 19,
  },
  hot: {
    tiles: ["https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors · Humanitarian OSM Team",
    maxzoom: 20,
  },
  cyclosm: {
    tiles: ["https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors · CyclOSM",
    maxzoom: 20,
  },
  topo: {
    tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)",
    maxzoom: 17,
  },
  satellite: {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution:
      "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxzoom: 19,
  },
};

export function getStyle(id) {
  return MAP_STYLES.find((s) => s.id === id) || MAP_STYLES[0];
}

export function resolveStyle(id) {
  const meta = getStyle(id);
  if (meta.kind === "vector") return meta.url;
  const spec = RASTERS[id];
  if (!spec) return MAP_STYLES[0].url;
  return {
    version: 8,
    name: id,
    sources: {
      raster: {
        type: "raster",
        tiles: spec.tiles,
        tileSize: 256,
        attribution: spec.attribution,
        maxzoom: spec.maxzoom,
      },
    },
    layers: [{ id: "raster", type: "raster", source: "raster" }],
  };
}
