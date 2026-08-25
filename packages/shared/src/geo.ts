const EARTH_RADIUS_M = 6_371_000;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampLat(lat: number): number {
  return clamp(lat, -85.05112878, 85.05112878);
}

export function wrapLon(lon: number): number {
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

export function haversineMeters(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δφ = ((b[1] - a[1]) * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function pathLengthMeters(coords: readonly (readonly [number, number])[]): number {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const next = coords[i];
    if (!prev || !next) continue;
    sum += haversineMeters(prev, next);
  }
  return sum;
}

/** Photon extent is [minLon, maxLat, maxLon, minLat] → [west, south, east, north]. */
export function bboxFromPhotonExtent(
  extent: number[] | undefined,
): [number, number, number, number] | undefined {
  if (!extent || extent.length < 4) return undefined;
  const minLon = extent[0];
  const maxLat = extent[1];
  const maxLon = extent[2];
  const minLat = extent[3];
  if (
    minLon === undefined ||
    maxLat === undefined ||
    maxLon === undefined ||
    minLat === undefined
  ) {
    return undefined;
  }
  return [minLon, minLat, maxLon, maxLat];
}

const COORD_RE =
  /^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/;

export function parseCoordinateQuery(
  q: string,
): { lat: number; lon: number } | null {
  const m = COORD_RE.exec(q.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const aIsLat = Math.abs(a) <= 90 && Math.abs(b) <= 180;
  const bIsLat = Math.abs(b) <= 90 && Math.abs(a) <= 180;
  if (aIsLat && !bIsLat) return { lat: a, lon: b };
  if (!aIsLat && bIsLat) return { lat: b, lon: a };
  if (aIsLat && bIsLat) {
    // Prefer lat,lon (OSM search convention) when both are valid.
    return { lat: a, lon: b };
  }
  return null;
}

export function formatDistance(meters: number, lang: "zh" | "en"): string {
  if (meters < 1000) {
    const m = Math.round(meters);
    return lang === "zh" ? `${m} 米` : `${m} m`;
  }
  const km = meters / 1000;
  const text = km >= 100 ? km.toFixed(0) : km >= 10 ? km.toFixed(1) : km.toFixed(2);
  return lang === "zh" ? `${text} 公里` : `${text} km`;
}

export function formatDuration(seconds: number, lang: "zh" | "en"): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (lang === "zh") {
    if (h <= 0) return `${m} 分钟`;
    if (m === 0) return `${h} 小时`;
    return `${h} 小时 ${m} 分钟`;
  }
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}°${ns} ${Math.abs(lon).toFixed(5)}°${ew}`;
}
