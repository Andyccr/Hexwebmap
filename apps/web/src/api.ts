import {
  hasHan,
  hitsFromNominatim,
  hitsFromPhoton,
  mergeHits,
  photonLang,
  type ReversePlace,
  type RouteProfile,
  type RouteResult,
  type SearchHit,
} from "@hexwebmap/shared";

const PHOTON = "https://photon.komoot.io";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";

const memory = new Map<string, { exp: number; data: unknown }>();
const TTL = 5 * 60_000;

function cached<T>(key: string, ttl = TTL): T | undefined {
  const hit = memory.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.exp) {
    memory.delete(key);
    return undefined;
  }
  return hit.data as T;
}

function remember<T>(key: string, data: T, ttl = TTL): T {
  memory.set(key, { data, exp: Date.now() + ttl });
  return data;
}

function mixSignal(signal?: AbortSignal, ms = 8000): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal: mixSignal(signal),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function searchPlaces(
  q: string,
  lang: string,
  signal?: AbortSignal,
): Promise<{ hits: SearchHit[] }> {
  const key = `s:${lang}:${q.toLowerCase()}`;
  const hit = cached<{ hits: SearchHit[] }>(key);
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

  const photonTask = getJson<{ features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }> }>(
    photonUrl.toString(),
    signal,
  ).catch(() => ({ features: [] }));

  const nomiTask = cjk
    ? getJson<Parameters<typeof hitsFromNominatim>[0]>(nomiUrl.toString(), signal).catch(() => [])
    : Promise.resolve([]);

  const [photon, nomi] = await Promise.all([photonTask, nomiTask]);
  const photonHits = hitsFromPhoton(photon.features, q);
  const nomiHits = hitsFromNominatim(nomi);
  const hits = cjk ? mergeHits(nomiHits, photonHits, 8) : mergeHits(photonHits, nomiHits, 8);
  return remember(key, { hits });
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  zoom: number,
  signal?: AbortSignal,
): Promise<ReversePlace> {
  const key = `r:${lat.toFixed(5)}:${lon.toFixed(5)}:${Math.round(zoom)}`;
  const hit = cached<ReversePlace>(key);
  if (hit) return hit;

  try {
    const url = new URL("/reverse", NOMINATIM);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("zoom", String(Math.round(Math.min(18, Math.max(3, zoom)))));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("extratags", "1");
    const data = await getJson<{
      name?: string;
      display_name?: string;
      lat?: string;
      lon?: string;
      osm_type?: string;
      osm_id?: number;
      category?: string;
      type?: string;
      address?: Record<string, string>;
      extratags?: Record<string, string>;
      licence?: string;
    }>(url.toString(), signal);
    return remember(key, {
      name: data.name || data.address?.road || data.display_name?.split(",")[0] || "",
      displayName: data.display_name ?? "",
      lat: Number(data.lat ?? lat),
      lon: Number(data.lon ?? lon),
      osmType: data.osm_type,
      osmId: data.osm_id,
      category: data.category,
      type: data.type,
      address: data.address ?? {},
      extratags: data.extratags ?? {},
      licence: data.licence,
    });
  } catch {
    const url = new URL("/reverse", PHOTON);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    const data = await getJson<{
      features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }>;
    }>(url.toString(), signal);
    const mapped = hitsFromPhoton(data.features, "")[0];
    const props = data.features?.[0]?.properties ?? {};
    return remember(key, {
      name: mapped?.name ?? "",
      displayName: mapped?.label ?? "",
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

export async function fetchRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  profile: RouteProfile,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const key = `rt:${profile}:${from.lon.toFixed(5)},${from.lat.toFixed(5)}:${to.lon.toFixed(5)},${to.lat.toFixed(5)}`;
  const hit = cached<RouteResult>(key, 3 * 60_000);
  if (hit) return hit;
  const path = `/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = new URL(path, OSRM);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");
  const data = await getJson<{
    code?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry?: { type: string; coordinates: [number, number][] };
      legs?: Array<{ distance: number; duration: number; summary?: string }>;
    }>;
    message?: string;
  }>(url.toString(), signal);
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
      geometry: route.geometry as RouteResult["geometry"],
      legs: (route.legs ?? []).map((leg) => ({
        distance: leg.distance,
        duration: leg.duration,
        summary: leg.summary || "",
      })),
    },
    3 * 60_000,
  );
}
