const zh = {
  tagline: "开放地图",
  searchPlaceholder: "搜索地点或坐标",
  searchGo: "搜索",
  searchHint: "试试：东京、阿尔卑斯、40.71, -74.01",
  searching: "正在搜索…",
  noResults: "没有找到匹配的地点",
  recent: "最近搜索",
  layers: "图层",
  layersCarto: "OSM 制图",
  layersTheme: "主题",
  layersSpecial: "专题",
  directions: "路线",
  from: "起点",
  to: "终点",
  pickFrom: "在地图上选择起点",
  pickTo: "在地图上选择终点",
  driving: "驾车",
  walking: "步行",
  cycling: "骑行",
  routeEmpty: "选择起终点后计算路线",
  noRoute: "无法规划该路线",
  measure: "测距",
  measuring: "点击地图加点，再点测距结束",
  locateFail: "无法获取当前位置",
  shared: "链接已复制",
  about: "关于",
  place: "地点",
  inspect: "地图要素",
  address: "地址",
  coords: "坐标",
  openOsm: "在 OSM 打开",
  source: "源代码",
  host: "GitHub Pages · 打开即用 · 无需安装",
  hostShort: "GitHub Pages",
  aboutBody:
    "Hexwebmap 是托管在 GitHub Pages 上的纯静态全球地图。打开网页即可使用，不需要安装 Node、不需要后端服务。浏览器通过 MapLibre GL 渲染 OpenFreeMap 矢量瓦片；搜索走 Photon / Nominatim，路线走公共 OSRM。",
  aboutData:
    "地图数据 © OpenStreetMap 贡献者（ODbL）。矢量样式来自 OpenFreeMap / OpenMapTiles。栅格可选 OSM Carto、HOT、CyclOSM、OpenTopoMap 与 Esri 影像。",
  aboutPerf:
    "架构：docs/ 静态文件 + CDN 上的 MapLibre。瓦片与检索直连公共服务；结果缓存在浏览器内存。适合 GitHub Pages「打开就能看」。",
  loading: "正在载入地图…",
  lang: "English",
  currentLocation: "当前位置",
};

const en = {
  tagline: "Open map",
  searchPlaceholder: "Search places or coordinates",
  searchGo: "Go",
  searchHint: "Try Tokyo, the Alps, or 40.71, -74.01",
  searching: "Searching…",
  noResults: "No matching places",
  recent: "Recent",
  layers: "Layers",
  layersCarto: "OSM cartography",
  layersTheme: "Themes",
  layersSpecial: "Special",
  directions: "Directions",
  from: "From",
  to: "To",
  pickFrom: "Pick start on map",
  pickTo: "Pick destination on map",
  driving: "Drive",
  walking: "Walk",
  cycling: "Bike",
  routeEmpty: "Set origin and destination to route",
  noRoute: "No route found",
  measure: "Measure",
  measuring: "Click to add points, click Measure again to stop",
  locateFail: "Location unavailable",
  shared: "Link copied",
  about: "About",
  place: "Place",
  inspect: "Map features",
  address: "Address",
  coords: "Coordinates",
  openOsm: "Open in OSM",
  source: "Source",
  host: "GitHub Pages · open and use · no install",
  hostShort: "GitHub Pages",
  aboutBody:
    "Hexwebmap is a pure static worldwide map on GitHub Pages. Open the URL—no Node install, no app server. MapLibre GL renders OpenFreeMap vector tiles in the browser; Photon/Nominatim search and public OSRM route.",
  aboutData:
    "Map data © OpenStreetMap contributors (ODbL). Vector styles from OpenFreeMap / OpenMapTiles. Optional rasters: OSM Carto, HOT, CyclOSM, OpenTopoMap, Esri imagery.",
  aboutPerf:
    "Architecture: static files in docs/ plus MapLibre from CDN. Tiles and geocoding hit public services; results cache in memory. Built to open on GitHub Pages with zero install.",
  loading: "Loading map…",
  lang: "中文",
  currentLocation: "Current location",
};

export function t(lang) {
  return lang === "en" ? en : zh;
}

export function applyI18n(root, lang) {
  const msg = t(lang);
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && msg[key] != null) el.textContent = msg[key];
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && msg[key] != null) el.setAttribute("placeholder", msg[key]);
  });
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = lang === "zh" ? "Hexwebmap · 全球地图" : "Hexwebmap · World map";
}
