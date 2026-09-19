export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function clampLat(lat) {
  return clamp(lat, -85.05112878, 85.05112878);
}

export function wrapLon(lon) {
  if (!Number.isFinite(lon)) return 0;
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

const R = 6_371_000;
const M_PER_DEG = 111_320;

export function haversineMeters(a, b) {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δφ = ((b[1] - a[1]) * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function pathLengthMeters(coords) {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += haversineMeters(coords[i - 1], coords[i]);
  return sum;
}

export function bboxOfLine(coords) {
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  for (const [lon, lat] of coords) {
    if (lon < w) w = lon;
    if (lat < s) s = lat;
    if (lon > e) e = lon;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
}

function pointSegMeters(p, a, b) {
  const mx = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180) || 1e-6;
  const ax = a[0] * mx;
  const ay = a[1];
  const bx = b[0] * mx;
  const by = b[1];
  const px = p[0] * mx;
  const py = p[1];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return Math.hypot(qx, qy) * M_PER_DEG;
}

/** Iterative Douglas–Peucker. `epsilonM` is metres. */
export function simplifyPath(coords, epsilonM = 12) {
  if (!coords || coords.length <= 2) return coords ? coords.slice() : [];
  const n = coords.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const a = coords[start];
    const b = coords[end];
    for (let i = start + 1; i < end; i++) {
      const d = pointSegMeters(coords[i], a, b);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > epsilonM) {
      keep[idx] = 1;
      stack.push([start, idx], [idx, end]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(coords[i]);
  return out;
}

export function simplifyForZoom(coords, zoom) {
  if (!coords || coords.length < 80) return coords || [];
  const z = Number.isFinite(zoom) ? zoom : 10;
  const epsilon = z >= 14 ? 6 : z >= 11 ? 14 : z >= 8 ? 35 : 80;
  return simplifyPath(coords, epsilon);
}

const COORD_RE = /^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/;

export function parseCoordinateQuery(q) {
  const m = COORD_RE.exec(String(q || "").trim());
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
  return `${Number(h.lat).toFixed(5)},${Number(h.lon).toFixed(5)}`;
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

export function rankHits(hits, q, center) {
  const nq = String(q || "")
    .trim()
    .toLowerCase();
  return hits
    .map((h) => {
      const name = String(h.name || "").toLowerCase();
      const label = String(h.label || "").toLowerCase();
      let score = 0;
      if (nq) {
        if (name === nq) score += 100;
        else if (name.startsWith(nq)) score += 64;
        else if (name.includes(nq)) score += 32;
        else if (label.includes(nq)) score += 14;
      }
      if (center && Number.isFinite(h.lat) && Number.isFinite(h.lon)) {
        const d = haversineMeters([center.lon, center.lat], [h.lon, h.lat]);
        score += Math.max(0, 28 - Math.log10(d + 10) * 4);
      }
      if (h.bbox) score += 3;
      return { h, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.h);
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
