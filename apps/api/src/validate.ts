export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function requireQuery(q: string | undefined): string {
  const s = (q ?? "").trim();
  if (s.length < 1) throw new HttpError(400, "query is required");
  if (s.length > 200) throw new HttpError(400, "query is too long");
  return s;
}

export function parseLimit(raw: string | undefined, fallback = 8): number {
  const n = raw ? Number(raw) : fallback;
  if (!Number.isFinite(n) || n < 1 || n > 15) throw new HttpError(400, "limit must be 1–15");
  return Math.floor(n);
}

export function parseLatLon(latRaw: string | undefined, lonRaw: string | undefined) {
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new HttpError(400, "lat and lon are required numbers");
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new HttpError(400, "coordinates out of range");
  }
  return { lat, lon };
}

const PROFILES = new Set(["driving", "walking", "cycling"]);

export type RouteProfile = "driving" | "walking" | "cycling";

export function parseProfile(raw: string | undefined): RouteProfile {
  const p = raw ?? "driving";
  if (!PROFILES.has(p)) throw new HttpError(400, "profile must be driving, walking, or cycling");
  return p as RouteProfile;
}
