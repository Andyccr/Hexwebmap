import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { LruTtlCache, TokenBucket } from "./cache.ts";
import { fetchJson } from "./http.ts";
import { hasHan, hitsFromNominatim, hitsFromPhoton, mergeHits, photonLang } from "./geocode.ts";
import {
  HttpError,
  parseLatLon,
  parseLimit,
  parseProfile,
  requireQuery,
} from "./validate.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_DIST = resolve(ROOT, "apps/web/dist");
const PORT = Number(process.env.PORT ?? 8787);
const PHOTON = process.env.PHOTON_URL ?? "https://photon.komoot.io";
const NOMINATIM = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
const OSRM = process.env.OSRM_URL ?? "https://router.project-osrm.org";

const searchCache = new LruTtlCache<unknown>(400, 5 * 60_000);
const reverseCache = new LruTtlCache<unknown>(400, 10 * 60_000);
const routeCache = new LruTtlCache<unknown>(200, 3 * 60_000);
const limiter = new TokenBucket(2, 20);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

type NominatimReverse = {
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
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { type: string; coordinates: [number, number][] };
    legs?: Array<{ distance: number; duration: number; summary?: string }>;
  }>;
  message?: string;
};

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "HEAD"],
  }),
);

app.use("/api/*", async (c, next) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter.take(ip)) {
    return c.json({ error: "rate limited" }, 429);
  }
  const t0 = Date.now();
  await next();
  c.header("x-response-time", `${Date.now() - t0}ms`);
  c.header("cache-control", "public, max-age=60");
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "hexwebmap",
    cache: { search: searchCache.size, reverse: reverseCache.size, route: routeCache.size },
    uptime: process.uptime(),
  }),
);

app.get("/api/config", (c) =>
  c.json({
    name: "Hexwebmap",
    defaultStyle: "liberty",
    geocoder: "photon",
    router: "osrm",
    tiles: "openfreemap",
  }),
);

app.get("/api/geocode/search", async (c) => {
  const q = requireQuery(c.req.query("q"));
  const limit = parseLimit(c.req.query("limit"));
  const lang = c.req.query("lang") === "en" ? "en" : "zh";
  const key = `${lang}|${limit}|${q.toLowerCase()}`;
  const cached = searchCache.get(key);
  if (cached) {
    c.header("x-cache", "HIT");
    return c.json(cached);
  }

  const photonUrl = new URL("/api", PHOTON);
  photonUrl.searchParams.set("q", q);
  photonUrl.searchParams.set("limit", String(limit));
  const pLang = photonLang(lang);
  if (pLang) photonUrl.searchParams.set("lang", pLang);

  const cjk = hasHan(q);
  const nomiUrl = new URL("/search", NOMINATIM);
  nomiUrl.searchParams.set("q", q);
  nomiUrl.searchParams.set("format", "jsonv2");
  nomiUrl.searchParams.set("addressdetails", "1");
  nomiUrl.searchParams.set("limit", String(limit));
  nomiUrl.searchParams.set("accept-language", lang === "en" ? "en" : "zh");

  const photonTask = fetchJson<{ features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }> }>(
    photonUrl.toString(),
  ).catch(() => ({ features: [] }));
  const nomiTask = cjk
    ? fetchJson<Array<{ name?: string; display_name?: string; lat?: string; lon?: string; osm_type?: string; osm_id?: number; category?: string; type?: string; address?: Record<string, string>; boundingbox?: string[] }>>(
        nomiUrl.toString(),
      ).catch(() => [])
    : Promise.resolve([]);

  const [photon, nomi] = await Promise.all([photonTask, nomiTask]);
  const photonHits = hitsFromPhoton(photon.features, q);
  const nomiHits = hitsFromNominatim(nomi);
  const hits = cjk ? mergeHits(nomiHits, photonHits, limit) : mergeHits(photonHits, nomiHits, limit);
  const body = { query: q, hits };
  searchCache.set(key, body);
  c.header("x-cache", "MISS");
  return c.json(body);
});

app.get("/api/geocode/reverse", async (c) => {
  const { lat, lon } = parseLatLon(c.req.query("lat"), c.req.query("lon"));
  const zoom = Math.min(18, Math.max(3, Number(c.req.query("zoom") ?? 18) || 18));
  const key = `${lat.toFixed(5)}|${lon.toFixed(5)}|${zoom}`;
  const cached = reverseCache.get(key);
  if (cached) {
    c.header("x-cache", "HIT");
    return c.json(cached);
  }
  const url = new URL("/reverse", NOMINATIM);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", String(zoom));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  const data = await fetchJson<NominatimReverse>(url.toString());
  const body = {
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
  };
  reverseCache.set(key, body);
  c.header("x-cache", "MISS");
  return c.json(body);
});

app.get("/api/route", async (c) => {
  const from = parseLatLon(c.req.query("fromLat"), c.req.query("fromLon"));
  const to = parseLatLon(c.req.query("toLat"), c.req.query("toLon"));
  const profile = parseProfile(c.req.query("profile"));
  const key = `${profile}|${from.lon.toFixed(5)},${from.lat.toFixed(5)}|${to.lon.toFixed(5)},${to.lat.toFixed(5)}`;
  const cached = routeCache.get(key);
  if (cached) {
    c.header("x-cache", "HIT");
    return c.json(cached);
  }
  const path = `/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = new URL(path, OSRM);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");
  const data = await fetchJson<OsrmResponse>(url.toString());
  if (data.code && data.code !== "Ok") {
    throw new HttpError(404, data.message || "no route");
  }
  const route = data.routes?.[0];
  if (!route?.geometry || route.geometry.type !== "LineString") {
    throw new HttpError(404, "no route");
  }
  const body = {
    distance: route.distance,
    duration: route.duration,
    profile,
    geometry: route.geometry,
    legs: (route.legs ?? []).map((leg) => ({
      distance: leg.distance,
      duration: leg.duration,
      summary: leg.summary || "",
    })),
  };
  routeCache.set(key, body);
  c.header("x-cache", "MISS");
  return c.json(body);
});

app.onError((err, c) => {
  if (err instanceof HttpError) {
    const status = err.status === 404 ? 404 : err.status === 429 ? 429 : 400;
    return c.json({ error: err.message }, status);
  }
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  const aborted = err instanceof Error && err.name === "AbortError";
  console.error("[hexwebmap-api]", err);
  return c.json({ error: aborted ? "upstream timeout" : "upstream error" }, 502);
});

const STATIC_ROOT = existsSync(WEB_DIST) ? WEB_DIST : null;

function safeJoin(root: string, reqPath: string): string | null {
  const decoded = decodeURIComponent(reqPath.split("?")[0] ?? "/");
  const full = normalize(join(root, decoded === "/" ? "index.html" : decoded));
  if (!full.startsWith(`${root}/`) && full !== root) return null;
  return full;
}

app.get("/LICENSE", async (c) => {
  const file = join(ROOT, "LICENSE");
  if (!existsSync(file)) return c.text("missing", 404);
  const buf = await readFile(file);
  return c.body(buf, 200, { "content-type": "text/plain; charset=utf-8" });
});

app.get("*", async (c, next) => {
  if (c.req.path.startsWith("/api")) return next();
  if (!STATIC_ROOT) return c.json({ error: "spa not built" }, 404);
  const wanted = safeJoin(STATIC_ROOT, c.req.path);
  if (!wanted) return c.body("forbidden", 403);
  let file = wanted;
  if (!existsSync(file) || file.endsWith("/")) {
    file = join(STATIC_ROOT, "index.html");
  } else if (statSync(file).isDirectory()) {
    file = join(STATIC_ROOT, "index.html");
  }
  if (!existsSync(file)) return c.body("not found", 404);
  const buf = await readFile(file);
  const mime = MIME[extname(file)] ?? "application/octet-stream";
  const immutable = file.includes("/assets/");
  return c.body(buf, 200, {
    "content-type": mime,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
});

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
  console.log(`Hexwebmap API on http://0.0.0.0:${info.port}`);
  if (STATIC_ROOT) console.log(`Serving SPA from ${STATIC_ROOT}`);
});
