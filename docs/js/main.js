import { fetchRoute, searchPlaces } from "./api.js";
import {
  formatCoord,
  formatDistance,
  formatDuration,
  osmPath,
  parseCoordinateQuery,
  pathLengthMeters,
} from "./geo.js";
import { defaultView, parseMapHash } from "./hash.js";
import { applyI18n, t } from "./i18n.js";
import { createMapController } from "./map.js";
import { DEFAULT_STYLE_ID, getStyle, MAP_STYLES } from "./styles.js";

function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
    },
    emit(type, payload) {
      for (const fn of map.get(type) || []) fn(payload);
    },
  };
}

function initialLang() {
  const saved = localStorage.getItem("hexwebmap.lang");
  if (saved === "zh" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function initialStyle() {
  const hash = parseMapHash(location.hash);
  if (hash?.style) return hash.style;
  return localStorage.getItem("hexwebmap.style") || DEFAULT_STYLE_ID;
}

function initialView() {
  const hash = parseMapHash(location.hash);
  const base = defaultView(navigator.language);
  return {
    zoom: hash?.zoom ?? base.zoom,
    lat: hash?.lat ?? base.lat,
    lon: hash?.lon ?? base.lon,
    bearing: hash?.bearing ?? 0,
    pitch: hash?.pitch ?? 0,
  };
}

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem("hexwebmap.recent") || "[]").slice(0, 8);
  } catch {
    return [];
  }
}

const state = {
  lang: initialLang(),
  styleId: initialStyle(),
  view: initialView(),
  loaded: false,
  query: "",
  results: [],
  recent: loadRecent(),
  selected: null,
  place: null,
  inspect: [],
  clickMode: "browse",
  measure: [],
  routeFrom: null,
  routeTo: null,
  routeProfile: "driving",
  route: null,
  panel: "none",
};

const bus = createBus();
const $ = (id) => document.getElementById(id);
const app = $("app");

function msg() {
  return t(state.lang);
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 2400);
}

let mapCtrl;
let fellBack = false;
try {
  if (!globalThis.maplibregl) {
    throw new Error("MapLibre GL script missing");
  }
  mapCtrl = createMapController($("map"), state, bus);
} catch (err) {
  console.error(err);
  const loading = $("map-loading");
  if (loading) {
    loading.hidden = false;
    loading.innerHTML = `<p>地图引擎加载失败：${String(err.message || err)}</p>`;
  }
}

bus.on("map-error", (err) => {
  if (fellBack || !mapCtrl || state.styleId === "osm") return;
  fellBack = true;
  console.warn("[hexwebmap] falling back to OSM raster", err);
  mapCtrl.setStyle("osm");
  toast(state.lang === "zh" ? "矢量底图暂不可用，已切换 OSM 栅格" : "Vector style unavailable; switched to OSM raster");
});

function closePanels() {
  state.panel = "none";
  $("panel-layers").hidden = true;
  $("panel-place").hidden = true;
  $("panel-route").hidden = true;
  $("about-modal").hidden = true;
  ["btn-layers", "btn-route"].forEach((id) => $(id).classList.remove("live"));
}

function openPanel(name) {
  closePanels();
  state.panel = name;
  if (name === "layers") {
    $("panel-layers").hidden = false;
    $("btn-layers").classList.add("live");
    renderLayers();
  } else if (name === "place") {
    $("panel-place").hidden = false;
  } else if (name === "route") {
    $("panel-route").hidden = false;
    $("btn-route").classList.add("live");
    renderRoutePanel();
  } else if (name === "about") {
    $("about-modal").hidden = false;
  }
}

function renderLayers() {
  const body = $("layers-body");
  const m = msg();
  const groups = [
    ["carto", m.layersCarto],
    ["theme", m.layersTheme],
    ["special", m.layersSpecial],
  ];
  body.innerHTML = groups
    .map(([id, label]) => {
      const cards = MAP_STYLES.filter((s) => s.group === id)
        .map(
          (s) => `
        <button type="button" class="layer-card ${state.styleId === s.id ? "active" : ""}" data-style="${s.id}">
          <span class="swatch" data-style="${s.id}"></span>
          <strong>${s.name[state.lang]}</strong>
          <em>${s.description[state.lang]}</em>
        </button>`,
        )
        .join("");
      return `<section><h3>${label}</h3><div class="layer-grid">${cards}</div></section>`;
    })
    .join("");
  body.querySelectorAll("[data-style]").forEach((btn) => {
    if (!btn.classList.contains("layer-card")) return;
    btn.addEventListener("click", () => {
      mapCtrl.setStyle(btn.getAttribute("data-style"));
      renderLayers();
      applyChromeTheme();
    });
  });
}

function applyChromeTheme() {
  app.classList.toggle("dark", state.styleId === "dark" || state.styleId === "fiord");
}

function renderPlace(place) {
  openPanel("place");
  const title = place.name || formatCoord(place.lat, place.lon);
  const sub = place.displayName || place.label || "";
  $("place-title").textContent = title;
  $("place-sub").textContent = sub;
  const meta = $("place-meta");
  meta.innerHTML = `
    <div><dt>${msg().coords}</dt><dd>${formatCoord(place.lat, place.lon)}</dd></div>
    ${
      place.category
        ? `<div><dt>${msg().place}</dt><dd>${place.category}${place.type ? ` / ${place.type}` : ""}</dd></div>`
        : ""
    }`;
  const addr = place.address || {};
  const entries = Object.entries(addr).slice(0, 12);
  const addrSec = $("place-address");
  const addrList = $("place-address-list");
  if (entries.length) {
    addrSec.hidden = false;
    addrList.innerHTML = entries
      .map(([k, v]) => `<li><span>${k}</span><strong>${v}</strong></li>`)
      .join("");
  } else {
    addrSec.hidden = true;
    addrList.innerHTML = "";
  }
  const inspectSec = $("place-inspect");
  const inspectBody = $("place-inspect-body");
  if (state.inspect?.length) {
    inspectSec.hidden = false;
    inspectBody.innerHTML = state.inspect
      .slice(0, 3)
      .map((f) => {
        const props = Object.entries(f.properties || {})
          .slice(0, 8)
          .map(([k, v]) => `<li><span>${k}</span><strong>${String(v)}</strong></li>`)
          .join("");
        return `<div class="inspect-card"><strong>${f.sourceLayer || f.layerId}${
          f.geometryType ? ` · ${f.geometryType}` : ""
        }</strong><ul class="kv">${props}</ul></div>`;
      })
      .join("");
  } else {
    inspectSec.hidden = true;
    inspectBody.innerHTML = "";
  }
  const path = osmPath(place.osmType, place.osmId);
  $("place-osm").href = path
    ? `https://www.openstreetmap.org/${path}`
    : `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}`;
}

function remember(hit) {
  state.recent = [hit, ...state.recent.filter((r) => r.id !== hit.id)].slice(0, 8);
  localStorage.setItem("hexwebmap.recent", JSON.stringify(state.recent));
}

function chooseHit(hit) {
  remember(hit);
  state.selected = hit;
  state.place = null;
  state.inspect = [];
  mapCtrl.setMarker(hit.lon, hit.lat);
  mapCtrl.flyTo({ lat: hit.lat, lon: hit.lon, zoom: 14, bbox: hit.bbox });
  renderPlace(hit);
  $("search-input").value = hit.name;
  $("search-menu").hidden = true;
}

let searchAbort;
let searchTimer;
let activeIdx = 0;

function renderSearchMenu(items, note) {
  const menu = $("search-menu");
  if (note) {
    menu.innerHTML = `<div class="search-note">${note}</div>`;
    menu.hidden = false;
    return;
  }
  if (!items.length && !$("search-input").value.trim()) {
    if (state.recent.length) {
      menu.innerHTML =
        `<div class="search-label">${msg().recent}</div>` +
        state.recent
          .map(
            (hit, i) =>
              `<button type="button" class="search-item" data-i="${i}" data-recent="1"><strong>${hit.name}</strong><span>${hit.label}</span></button>`,
          )
          .join("");
      menu.hidden = false;
      return;
    }
    menu.innerHTML = `<div class="search-note">${msg().searchHint}</div>`;
    menu.hidden = false;
    return;
  }
  menu.innerHTML = items
    .map(
      (hit, i) =>
        `<button type="button" class="search-item ${i === activeIdx ? "active" : ""}" data-i="${i}"><strong>${hit.name}</strong><span>${hit.label}</span></button>`,
    )
    .join("");
  menu.hidden = false;
  menu.querySelectorAll(".search-item").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      const list = btn.hasAttribute("data-recent") ? state.recent : state.results;
      const hit = list[i];
      if (hit) chooseHit(hit);
    });
  });
}

function currentHits() {
  const q = $("search-input").value;
  const parsed = parseCoordinateQuery(q);
  const coord = parsed
    ? {
        id: `coord-${parsed.lat},${parsed.lon}`,
        name: `${parsed.lat.toFixed(5)}, ${parsed.lon.toFixed(5)}`,
        label: state.lang === "zh" ? "坐标" : "Coordinates",
        lat: parsed.lat,
        lon: parsed.lon,
      }
    : null;
  return coord ? [coord, ...state.results] : state.results;
}

function runSearch(q) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (q.trim().length < 2) {
      state.results = [];
      renderSearchMenu([]);
      return;
    }
    searchAbort?.abort();
    searchAbort = new AbortController();
    renderSearchMenu([], msg().searching);
    searchPlaces(q.trim(), state.lang, searchAbort.signal)
      .then((data) => {
        state.results = data.hits;
        activeIdx = 0;
        const hits = currentHits();
        if (!hits.length) renderSearchMenu([], msg().noResults);
        else renderSearchMenu(hits);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        state.results = [];
        renderSearchMenu([], msg().noResults);
      });
  }, 260);
}

function renderRoutePanel() {
  const fromBtn = $("route-from");
  const toBtn = $("route-to");
  fromBtn.textContent = state.routeFrom?.name || msg().pickFrom;
  toBtn.textContent = state.routeTo?.name || msg().pickTo;
  fromBtn.classList.toggle("live", state.clickMode === "route-from");
  toBtn.classList.toggle("live", state.clickMode === "route-to");
  $("route-profile").querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", b.getAttribute("data-profile") === state.routeProfile);
  });
  const note = $("route-note");
  const result = $("route-result");
  if (!state.routeFrom || !state.routeTo) {
    note.hidden = false;
    note.textContent = msg().routeEmpty;
    result.hidden = true;
    mapCtrl.setRoute(null);
    return;
  }
  note.hidden = false;
  note.textContent = msg().searching;
  result.hidden = true;
  fetchRoute(state.routeFrom, state.routeTo, state.routeProfile)
    .then((route) => {
      state.route = route;
      mapCtrl.setRoute(route.geometry.coordinates);
      note.hidden = true;
      result.hidden = false;
      $("route-distance").textContent = formatDistance(route.distance, state.lang);
      $("route-duration").textContent = formatDuration(route.duration, state.lang);
      const coords = route.geometry.coordinates;
      let w = 180,
        s = 90,
        e = -180,
        n = -90;
      for (const [lon, lat] of coords) {
        w = Math.min(w, lon);
        s = Math.min(s, lat);
        e = Math.max(e, lon);
        n = Math.max(n, lat);
      }
      mapCtrl.flyTo({ lat: (s + n) / 2, lon: (w + e) / 2, bbox: [w, s, e, n] });
    })
    .catch(() => {
      state.route = null;
      mapCtrl.setRoute(null);
      note.hidden = false;
      note.textContent = msg().noRoute;
      result.hidden = true;
    });
}

function updateStatus() {
  $("status-coords").textContent = formatCoord(state.view.lat, state.view.lon);
  $("status-zoom").textContent = `z ${state.view.zoom.toFixed(2)}`;
  $("status-style").textContent = getStyle(state.styleId).name[state.lang];
}

function updateMeasureBanner() {
  const banner = $("measure-banner");
  if (state.clickMode !== "measure") {
    banner.hidden = true;
    return;
  }
  const len = pathLengthMeters(state.measure);
  const extra =
    state.measure.length >= 2
      ? ` · ${len >= 1000 ? `${(len / 1000).toFixed(2)} km` : `${Math.round(len)} m`}`
      : "";
  banner.textContent = msg().measuring + extra;
  banner.hidden = false;
}

/* wire UI */
applyI18n(document, state.lang);
applyChromeTheme();
updateStatus();

bus.on("loaded", () => {
  $("map-loading").hidden = true;
});
bus.on("view", updateStatus);
bus.on("style", () => {
  applyChromeTheme();
  updateStatus();
});
bus.on("place", (place) => renderPlace(place));
bus.on("panel", (name) => openPanel(name));
bus.on("route-ends", () => renderRoutePanel());
bus.on("measure", () => updateMeasureBanner());

$("btn-lang").addEventListener("click", () => {
  state.lang = state.lang === "zh" ? "en" : "zh";
  localStorage.setItem("hexwebmap.lang", state.lang);
  applyI18n(document, state.lang);
  updateStatus();
  if (state.panel === "layers") renderLayers();
  if (state.panel === "route") renderRoutePanel();
  if (state.panel === "place" && state.selected) renderPlace(state.selected);
  updateMeasureBanner();
});

$("btn-about").addEventListener("click", () => openPanel("about"));
$("about-close").addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closePanels();
});
$("about-modal").addEventListener("click", (e) => {
  if (e.target === $("about-modal")) closePanels();
});
document.querySelectorAll(".panel-close").forEach((btn) =>
  btn.addEventListener("click", closePanels),
);

$("btn-zoom-in").addEventListener("click", () => mapCtrl?.zoomBy(1));
$("btn-zoom-out").addEventListener("click", () => mapCtrl?.zoomBy(-1));
$("btn-north").addEventListener("click", () => mapCtrl?.north());
$("btn-tilt").addEventListener("click", () => mapCtrl?.tilt());
$("btn-layers").addEventListener("click", () =>
  state.panel === "layers" ? closePanels() : openPanel("layers"),
);
$("btn-route").addEventListener("click", () =>
  state.panel === "route" ? closePanels() : openPanel("route"),
);
$("btn-share").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast(msg().shared);
  } catch {
    toast(location.href);
  }
});
$("btn-locate").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const place = {
        name: msg().currentLocation,
        displayName: msg().currentLocation,
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        address: {},
        extratags: {},
      };
      state.selected = place;
      mapCtrl.setMarker(place.lon, place.lat);
      mapCtrl.flyTo({ lat: place.lat, lon: place.lon, zoom: 15 });
      renderPlace(place);
    },
    () => toast(msg().locateFail),
    { enableHighAccuracy: true, timeout: 8000 },
  );
});
$("btn-measure").addEventListener("click", () => {
  if (state.clickMode === "measure") {
    state.clickMode = "browse";
    state.measure = [];
    mapCtrl.setMeasure([]);
    mapCtrl.setCursor("browse");
    $("btn-measure").classList.remove("live");
  } else {
    state.clickMode = "measure";
    mapCtrl.setCursor("measure");
    $("btn-measure").classList.add("live");
  }
  updateMeasureBanner();
});

$("route-from").addEventListener("click", () => {
  state.clickMode = state.clickMode === "route-from" ? "browse" : "route-from";
  mapCtrl.setCursor(state.clickMode);
  renderRoutePanel();
});
$("route-to").addEventListener("click", () => {
  state.clickMode = state.clickMode === "route-to" ? "browse" : "route-to";
  mapCtrl.setCursor(state.clickMode);
  renderRoutePanel();
});
$("route-swap").addEventListener("click", () => {
  const a = state.routeFrom;
  state.routeFrom = state.routeTo;
  state.routeTo = a;
  renderRoutePanel();
});
$("route-profile").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-profile]");
  if (!btn) return;
  state.routeProfile = btn.getAttribute("data-profile");
  renderRoutePanel();
});
$("place-directions").addEventListener("click", () => {
  if (!state.selected) return;
  state.routeTo = {
    id: `sel-${state.selected.lon},${state.selected.lat}`,
    name: state.selected.name,
    label: state.selected.displayName || state.selected.label || "",
    lat: state.selected.lat,
    lon: state.selected.lon,
  };
  openPanel("route");
});

const input = $("search-input");
const clearBtn = $("search-clear");
input.addEventListener("input", () => {
  clearBtn.hidden = !input.value;
  activeIdx = 0;
  runSearch(input.value);
});
input.addEventListener("focus", () => renderSearchMenu(currentHits()));
input.addEventListener("blur", () => setTimeout(() => ($("search-menu").hidden = true), 160));
input.addEventListener("keydown", (e) => {
  const hits = currentHits();
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIdx = Math.min(activeIdx + 1, Math.max(0, hits.length - 1));
    renderSearchMenu(hits);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIdx = Math.max(activeIdx - 1, 0);
    renderSearchMenu(hits);
  } else if (e.key === "Escape") {
    $("search-menu").hidden = true;
    input.blur();
  }
});
clearBtn.addEventListener("click", () => {
  input.value = "";
  clearBtn.hidden = true;
  state.results = [];
  input.focus();
  renderSearchMenu([]);
});
$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const hits = currentHits();
  const hit = hits[activeIdx] || hits[0];
  if (hit) chooseHit(hit);
});

window.addEventListener("keydown", (e) => {
  const tag = e.target?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA";
  if (e.key === "Escape") closePanels();
  if (typing) return;
  if (e.key === "/" || e.key === "f" || e.key === "F") {
    e.preventDefault();
    input.focus();
  }
  if (e.key === "=" || e.key === "+") mapCtrl?.zoomBy(1);
  if (e.key === "-" || e.key === "_") mapCtrl?.zoomBy(-1);
  if (e.key === "0") mapCtrl?.north();
});
