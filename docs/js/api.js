import {
  hasHan,
  hitsFromNominatim,
  hitsFromPhoton,
  mergeHits,
  photonLang,
} from "./geo.js";

const PHOTON = "https://photon.komoot.io";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";

const memory = new Map();

function cached(key) {
  const hit = memory.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.exp) {
    memory.delete(key);
    return undefined;
  }
  return hit.data;
}

function remember(key, data, ttl = 300_000) {
  memory.set(key, { data, exp: Date.now() + ttl });
  return data;
}

function mix(signal, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  const out = ctrl.signal;
  out.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return out;
}

async function getJson(url, signal) {
  const res = await fetch(url, {
    signal: mix(signal),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchPlaces(q, lang, signal) {
  const key = `s:${lang}:${q.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return hit;

  const photonUrl = new URL("/api", PHOTON);
  photonUrl.searchParams.set("q", q);
  photonUrl.searchParams.set("limit", "8");
  const pl = photonLang(lang);
  if (pl) photonUrl.searchParams.set("lang", pl);

  const cjk = hasHan(q);
  const nomiUrl = new URL("/search", NOMINATIM);
  nomiUrl.searchParams.set("q", q);
  nomiUrl.searchParams.set("format", "jsonv2");
  nomiUrl.searchParams.set("addressdetails", "1");
  nomiUrl.searchParams.set("limit", "8");
  nomiUrl.searchParams.set("accept-language", lang === "en" ? "en" : "zh");

  const [photon, nomi] = await Promise.all([
    getJson(photonUrl, signal).catch(() => ({ features: [] })),
    cjk ? getJson(nomiUrl, signal).catch(() => []) : Promise.resolve([]),
  ]);

  const photonHits = hitsFromPhoton(photon.features, q);
  const nomiHits = hitsFromNominatim(nomi);
  const hits = cjk ? mergeHits(nomiHits, photonHits, 8) : mergeHits(photonHits, nomiHits, 8);
  return remember(key, { hits });
}

export async function reverseGeocode(lat, lon, zoom, signal) {
  const key = `r:${lat.toFixed(5)}:${lon.toFixed(5)}:${Math.round(zoom)}`;
  const hit = cached(key);
  if (hit) return hit;

  try {
    const url = new URL("/reverse", NOMINATIM);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("zoom", String(Math.round(Math.min(18, Math.max(3, zoom)))));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("extratags", "1");
    const data = await getJson(url, signal);
    return remember(key, {
      name: data.name || data.address?.road || data.display_name?.split(",")[0] || "",
      displayName: data.display_name || "",
      lat: Number(data.lat ?? lat),
      lon: Number(data.lon ?? lon),
      osmType: data.osm_type,
      osmId: data.osm_id,
      category: data.category,
      type: data.type,
      address: data.address || {},
      extratags: data.extratags || {},
    });
  } catch {
    const url = new URL("/reverse", PHOTON);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    const data = await getJson(url, signal);
    const mapped = hitsFromPhoton(data.features, "")[0];
    const props = data.features?.[0]?.properties || {};
    return remember(key, {
      name: mapped?.name || "",
      displayName: mapped?.label || "",
      lat: mapped?.lat ?? lat,
      lon: mapped?.lon ?? lon,
      osmType: mapped?.osmType,
      osmId: mapped?.osmId,
      category: props.osm_key ? String(props.osm_key) : undefined,
      type: props.osm_value ? String(props.osm_value) : undefined,
      address: {
        city: props.city ? String(props.city) : "",
        state: props.state ? String(props.state) : "",
        country: props.country ? String(props.country) : "",
      },
      extratags: {},
    });
  }
}

export async function fetchRoute(from, to, profile, signal) {
  const key = `rt:${profile}:${from.lon.toFixed(5)},${from.lat.toFixed(5)}:${to.lon.toFixed(5)},${to.lat.toFixed(5)}`;
  const hit = cached(key);
  if (hit) return hit;
  const path = `/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = new URL(path, OSRM);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");
  const data = await getJson(url, signal);
  const route = data.routes?.[0];
  if (!route?.geometry || route.geometry.type !== "LineString") {
    throw new Error(data.message || "no route");
  }
  return remember(
    key,
    {
      distance: route.distance,
      duration: route.duration,
      profile,
      geometry: route.geometry,
      legs: (route.legs || []).map((leg) => ({
        distance: leg.distance,
        duration: leg.duration,
        summary: leg.summary || "",
      })),
    },
    180_000,
  );
}
