import type { ReversePlace, RouteProfile, RouteResult, SearchHit } from "@hexwebmap/shared";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function searchPlaces(
  q: string,
  lang: string,
  signal?: AbortSignal,
): Promise<{ hits: SearchHit[] }> {
  const url = `/api/geocode/search?q=${encodeURIComponent(q)}&lang=${lang}&limit=8`;
  return getJson(url, signal);
}

export function reverseGeocode(
  lat: number,
  lon: number,
  zoom: number,
  signal?: AbortSignal,
): Promise<ReversePlace> {
  const url = `/api/geocode/reverse?lat=${lat}&lon=${lon}&zoom=${Math.round(zoom)}`;
  return getJson(url, signal);
}

export function fetchRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  profile: RouteProfile,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const url =
    `/api/route?fromLat=${from.lat}&fromLon=${from.lon}` +
    `&toLat=${to.lat}&toLon=${to.lon}&profile=${profile}`;
  return getJson(url, signal);
}
