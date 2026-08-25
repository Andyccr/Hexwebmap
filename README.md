# Hexwebmap

Static worldwide map for **GitHub Pages**, in the OpenStreetMap visual language. No application server.

Live: [andyccr.github.io/Hexwebmap](https://andyccr.github.io/Hexwebmap/)

## Architecture

```
GitHub Pages (static SPA)
  └── MapLibre GL (WebGL)
        ├── tiles / styles  →  OpenFreeMap, OSM rasters
        ├── search          →  Photon + Nominatim (browser CORS)
        ├── reverse         →  Nominatim, Photon fallback
        └── directions      →  public OSRM
```

| Path | Role |
| --- | --- |
| `apps/web` | Vite + React + MapLibre GL |
| `packages/shared` | styles, hash URLs, geo / geocode helpers |

Hash URLs follow OSM: `#map=zoom/lat/lon&s=liberty`.

## Develop

Node 22+.

```bash
npm install
npm run dev
```

http://127.0.0.1:5173

```bash
npm test
npm run build
```

Production build for project Pages uses `GITHUB_PAGES=true` so asset URLs are `/Hexwebmap/`. Enable **Settings → Pages → GitHub Actions** on the repository; pushes to `main` deploy `apps/web/dist`.

## Map data

Default basemap is OpenFreeMap Liberty (OpenMapTiles + OSM). Optional rasters: OSM Carto, HOT, CyclOSM, OpenTopoMap, Esri imagery. Search uses [Photon](https://photon.komoot.io) and [Nominatim](https://nominatim.org); routing uses [OSRM](https://project-osrm.org). Follow each provider’s usage policy.

## License

GNU Affero General Public License v3. Map data © OpenStreetMap contributors (ODbL).
