export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function clampLat(lat) {
  return clamp(lat, -85.05112878, 85.05112878);
}

export function wrapLon(lon) {
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

const R = 6_371_000;

export function haversineMeters(a, b) {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δφ = ((b[1] - a[1]) * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function pathLengthMeters(coords) {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += haversineMeters(coords[i - 1], coords[i]);
  return sum;
}

const COORD_RE = /^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/;

export function parseCoordinateQuery(q) {
  const m = COORD_RE.exec(q.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const aIsLat = Math.abs(a) <= 90 && Math.abs(b) <= 180;
  const bIsLat = Math.abs(b) <= 90 && Math.abs(a) <= 180;
  if (aIsLat && !bIsLat) return { lat: a, lon: b };
  if (!aIsLat && bIsLat) return { lat: b, lon: a };
  if (aIsLat && bIsLat) return { lat: a, lon: b };
  return null;
}

export function formatDistance(meters, lang) {
  if (meters < 1000) {
    const m = Math.round(meters);
    return lang === "zh" ? `${m} 米` : `${m} m`;
  }
  const km = meters / 1000;
  const text = km >= 100 ? km.toFixed(0) : km >= 10 ? km.toFixed(1) : km.toFixed(2);
  return lang === "zh" ? `${text} 公里` : `${text} km`;
}

export function formatDuration(seconds, lang) {
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

export function formatCoord(lat, lon) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}°${ns} ${Math.abs(lon).toFixed(5)}°${ew}`;
}

export function hasHan(q) {
  return /\p{Script=Han}/u.test(q);
}

export function photonLang(uiLang) {
  const v = (uiLang || "").toLowerCase();
  if (v === "en" || v === "de" || v === "fr") return v;
  return undefined;
}

export function hitKey(h) {
  if (h.osmType && h.osmId != null) return `${h.osmType}:${h.osmId}`;
  return `${h.lat.toFixed(5)},${h.lon.toFixed(5)}`;
}

export function mergeHits(primary, secondary, limit) {
  const seen = new Set();
  const out = [];
  for (const hit of [...primary, ...secondary]) {
    const k = hitKey(hit);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

export function hitsFromPhoton(features, q) {
  return (features || []).flatMap((f, i) => {
    const coords = f.geometry?.coordinates;
    const p = f.properties || {};
    if (!coords || coords.length < 2) return [];
    const [lon, lat] = coords;
    const extent = Array.isArray(p.extent) ? p.extent : undefined;
    const bbox =
      extent && extent.length >= 4 ? [extent[0], extent[3], extent[2], extent[1]] : undefined;
    const parts = [p.street, p.city, p.state, p.country].filter(Boolean);
    const name = String(p.name ?? p.city ?? p.street ?? q);
    const osmId = typeof p.osm_id === "number" ? p.osm_id : undefined;
    const osmType = p.osm_type ? String(p.osm_type) : undefined;
    return [
      {
        id: `${osmType ?? "p"}:${osmId ?? i}:${lon},${lat}`,
        name,
        label: parts.length ? `${name} · ${parts.join(", ")}` : String(p.name ?? name),
        lat,
        lon,
        osmKey: p.osm_key ? String(p.osm_key) : undefined,
        osmValue: p.osm_value ? String(p.osm_value) : undefined,
        osmType,
        osmId,
        country: p.country ? String(p.country) : undefined,
        bbox,
      },
    ];
  });
}

const OSM_TYPE_SHORT = { node: "N", way: "W", relation: "R" };

export function hitsFromNominatim(rows) {
  return (rows || []).flatMap((row, i) => {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const bb = row.boundingbox;
    const bbox =
      bb && bb.length >= 4 ? [Number(bb[2]), Number(bb[0]), Number(bb[3]), Number(bb[1])] : undefined;
    const osmType = row.osm_type ? OSM_TYPE_SHORT[row.osm_type] || row.osm_type : undefined;
    const name = row.name || row.display_name?.split(",")[0] || "";
    return [
      {
        id: `${osmType ?? "n"}:${row.osm_id ?? i}:${lon},${lat}`,
        name,
        label: row.display_name ?? name,
        lat,
        lon,
        osmKey: row.category,
        osmValue: row.type,
        osmType,
        osmId: row.osm_id,
        country: row.address?.country,
        bbox,
      },
    ];
  });
}

export function osmPath(osmType, osmId) {
  if (!osmType || osmId == null) return null;
  const t =
    osmType === "N" || osmType === "node"
      ? "node"
      : osmType === "W" || osmType === "way"
        ? "way"
        : "relation";
  return `${t}/${osmId}`;
}
