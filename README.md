# Hexwebmap

Worldwide map site in the OpenStreetMap visual language: GPU vector tiles, a small caching API, and a cartographic UI.

## Architecture

```
Browser ── MapLibre GL (WebGL) ──► OpenFreeMap / OSM raster CDNs
   │
   └── /api/* ── Hono BFF
                    ├── Photon     search (LRU + TTL)
                    ├── Nominatim  reverse geocode
                    └── OSRM       driving / walking / cycling
```

Tiles never transit the app server. The BFF only fronts rate-limited geocoding and routing, with validation, timeouts, and an in-memory cache.

| Layer | Role |
| --- | --- |
| `apps/web` | Vite + React + MapLibre GL |
| `apps/api` | Hono gateway, static SPA in production |
| `packages/shared` | styles catalog, hash URLs, geo helpers |

Hash URLs follow OSM: `#map=zoom/lat/lon&s=liberty`.

## Develop

Node 22+.

```bash
npm install
npm run dev
```

- UI: http://127.0.0.1:5173
- API: http://127.0.0.1:8787/api/health

```bash
npm test
npm run build
PORT=8080 npm start
```

Production serves `apps/web/dist` from the API process (port `8080` in Docker).

```bash
docker compose up --build
```

## Map data

Default basemap is **OpenFreeMap Liberty** (OpenMapTiles + OSM). Optional rasters include OSM Carto, HOT, CyclOSM, OpenTopoMap, and Esri World Imagery. Attribution stays on the map. OSM raster tiles are for light use; prefer the vector styles in production.

Search: [Photon](https://photon.komoot.io). Reverse: [Nominatim](https://nominatim.org). Routing: [OSRM](https://project-osrm.org). Override upstream URLs with the variables in `.env.example`.

## License

GNU Affero General Public License v3. Map data © OpenStreetMap contributors (ODbL).
