import type { SearchHit } from "./types.ts";

const PHOTON_LANGS = new Set(["de", "en", "fr"]);

export function photonLang(uiLang: string | undefined): "de" | "en" | "fr" | undefined {
  const v = (uiLang ?? "").toLowerCase();
  if (PHOTON_LANGS.has(v)) return v as "de" | "en" | "fr";
  return undefined;
}

export function hasHan(q: string): boolean {
  return /\p{Script=Han}/u.test(q);
}

export function hitKey(h: SearchHit): string {
  if (h.osmType && h.osmId != null) return `${h.osmType}:${h.osmId}`;
  return `${h.lat.toFixed(5)},${h.lon.toFixed(5)}`;
}

export function mergeHits(primary: SearchHit[], secondary: SearchHit[], limit: number): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of [...primary, ...secondary]) {
    const k = hitKey(hit);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, unknown>;
};

export function hitsFromPhoton(features: PhotonFeature[] | undefined, q: string): SearchHit[] {
  return (features ?? []).flatMap((f, i) => {
    const coords = f.geometry?.coordinates;
    const p = f.properties ?? {};
    if (!coords || coords.length < 2) return [];
    const lon = coords[0];
    const lat = coords[1];
    if (lon === undefined || lat === undefined) return [];
    const extent = Array.isArray(p.extent) ? (p.extent as number[]) : undefined;
    const bbox =
      extent && extent.length >= 4
        ? ([extent[0], extent[3], extent[2], extent[1]] as [number, number, number, number])
        : undefined;
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

type NominatimSearch = {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  osm_type?: string;
  osm_id?: number;
  category?: string;
  type?: string;
  address?: Record<string, string>;
  boundingbox?: string[];
};

const OSM_TYPE_SHORT: Record<string, string> = {
  node: "N",
  way: "W",
  relation: "R",
};

export function hitsFromNominatim(rows: NominatimSearch[] | undefined): SearchHit[] {
  return (rows ?? []).flatMap((row, i) => {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const bb = row.boundingbox;
    const bbox =
      bb && bb.length >= 4
        ? ([Number(bb[2]), Number(bb[0]), Number(bb[3]), Number(bb[1])] as [
            number,
            number,
            number,
            number,
          ])
        : undefined;
    const osmType = row.osm_type ? (OSM_TYPE_SHORT[row.osm_type] ?? row.osm_type) : undefined;
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

export function nominatimOsmPath(osmType?: string, osmId?: number): string | null {
  if (!osmType || osmId == null) return null;
  const t =
    osmType === "N" || osmType === "node"
      ? "node"
      : osmType === "W" || osmType === "way"
        ? "way"
        : "relation";
  return `${t}/${osmId}`;
}
