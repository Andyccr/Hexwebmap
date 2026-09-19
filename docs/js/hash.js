import { clamp, clampLat, wrapLon } from "./geo.js";

const MAP_RE = /^map=([\d.+-]+)\/([\d.+-]+)\/([\d.+-]+)(?:\/([\d.+-]+)(?:\/([\d.+-]+))?)?/;

export function parseMapHash(hash) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  let mapPart = raw;
  let style;
  for (const bit of raw.split("&")) {
    if (bit.startsWith("map=")) mapPart = bit;
    else if (bit.startsWith("s=")) {
      try {
        style = decodeURIComponent(bit.slice(2));
      } catch {
        style = undefined;
      }
    } else if (bit.startsWith("style=")) {
      try {
        style = decodeURIComponent(bit.slice(6));
      } catch {
        style = undefined;
      }
    }
  }
  const m = MAP_RE.exec(mapPart);
  if (!m) return style ? { style } : null;
  const zoom = Number(m[1]);
  const lat = Number(m[2]);
  const lon = Number(m[3]);
  if (![zoom, lat, lon].every(Number.isFinite)) return null;
  const bearing = m[4] !== undefined ? Number(m[4]) : 0;
  const pitch = m[5] !== undefined ? Number(m[5]) : 0;
  const view = {
    zoom: clamp(zoom, 0, 22),
    lat: clampLat(lat),
    lon: wrapLon(lon),
    bearing: Number.isFinite(bearing) ? bearing : 0,
    pitch: Number.isFinite(pitch) ? clamp(pitch, 0, 85) : 0,
  };
  if (style) view.style = style;
  return view;
}

export function serializeMapHash(view, styleId) {
  const z = view.zoom.toFixed(2).replace(/\.?0+$/, "");
  const lat = view.lat.toFixed(5);
  const lon = view.lon.toFixed(5);
  const tilted = Math.abs(view.bearing) > 0.05 || view.pitch > 0.05;
  let body = tilted
    ? `map=${z}/${lat}/${lon}/${view.bearing.toFixed(1)}/${view.pitch.toFixed(1)}`
    : `map=${z}/${lat}/${lon}`;
  if (styleId) body += `&s=${encodeURIComponent(styleId)}`;
  return `#${body}`;
}

export function defaultView(lang) {
  if (String(lang).toLowerCase().startsWith("zh")) {
    return { zoom: 4.2, lat: 35.1, lon: 105.5, bearing: 0, pitch: 0 };
  }
  return { zoom: 2.35, lat: 20, lon: 8, bearing: 0, pitch: 0 };
}
