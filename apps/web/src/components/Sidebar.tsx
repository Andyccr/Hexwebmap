import { useEffect } from "react";
import {
  formatCoord,
  formatDistance,
  formatDuration,
  type ReversePlace,
  type SearchHit,
} from "@hexwebmap/shared";
import { fetchRoute } from "../api";
import { t } from "../i18n";
import { useMapStore } from "../store";
import { IconPin, IconSwap } from "./Icons";

function isSearchHit(p: SearchHit | ReversePlace): p is SearchHit {
  return "label" in p;
}

export function Sidebar() {
  const panel = useMapStore((s) => s.panel);
  if (panel === "place") return <PlacePanel />;
  if (panel === "directions") return <DirectionsPanel />;
  return null;
}

function PlacePanel() {
  const lang = useMapStore((s) => s.lang);
  const selected = useMapStore((s) => s.selected);
  const place = useMapStore((s) => s.place);
  const inspect = useMapStore((s) => s.inspect);
  const setPanel = useMapStore((s) => s.setPanel);
  const setRouteEndpoint = useMapStore((s) => s.setRouteEndpoint);
  const msg = t(lang);
  if (!selected) return null;
  const detail = place && Math.abs(place.lat - selected.lat) < 1e-4 ? place : null;
  const title = detail?.name || selected.name;
  const subtitle = detail?.displayName || (isSearchHit(selected) ? selected.label : selected.displayName);
  const osmType = detail?.osmType ?? (isSearchHit(selected) ? selected.osmType : undefined);
  const osmId = detail?.osmId ?? (isSearchHit(selected) ? selected.osmId : undefined);
  const osmUrl =
    osmType && osmId
      ? `https://www.openstreetmap.org/${osmType === "N" || osmType === "node" ? "node" : osmType === "W" || osmType === "way" ? "way" : "relation"}/${osmId}`
      : `https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}#map=18/${selected.lat}/${selected.lon}`;

  return (
    <aside className="sheet place-sheet">
      <header>
        <h2>{title}</h2>
        <button type="button" className="icon-quiet" onClick={() => setPanel("none")}>
          ×
        </button>
      </header>
      <p className="lede">{subtitle}</p>
      <dl className="meta">
        <div>
          <dt>{msg.coords}</dt>
          <dd>{formatCoord(selected.lat, selected.lon)}</dd>
        </div>
        {detail?.category && (
          <div>
            <dt>{msg.place}</dt>
            <dd>
              {detail.category}
              {detail.type ? ` / ${detail.type}` : ""}
            </dd>
          </div>
        )}
      </dl>
      {detail && Object.keys(detail.address).length > 0 && (
        <section>
          <h3>{msg.address}</h3>
          <ul className="kv">
            {Object.entries(detail.address)
              .slice(0, 12)
              .map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <strong>{v}</strong>
                </li>
              ))}
          </ul>
        </section>
      )}
      {inspect.length > 0 && (
        <section>
          <h3>{msg.inspect}</h3>
          {inspect.slice(0, 3).map((f, i) => (
            <div className="inspect-card" key={`${f.layerId}-${i}`}>
              <strong>
                {f.sourceLayer || f.layerId}
                {f.geometryType ? ` · ${f.geometryType}` : ""}
              </strong>
              <ul className="kv">
                {Object.entries(f.properties)
                  .slice(0, 8)
                  .map(([k, v]) => (
                    <li key={k}>
                      <span>{k}</span>
                      <strong>{String(v)}</strong>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      <div className="sheet-actions">
        <a className="btn" href={osmUrl} target="_blank" rel="noreferrer">
          {msg.openOsm}
        </a>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            const hit: SearchHit = {
              id: `sel-${selected.lon},${selected.lat}`,
              name: title,
              label: subtitle,
              lat: selected.lat,
              lon: selected.lon,
            };
            setRouteEndpoint("to", hit);
            setPanel("directions");
          }}
        >
          {msg.directions}
        </button>
      </div>
    </aside>
  );
}

function DirectionsPanel() {
  const lang = useMapStore((s) => s.lang);
  const from = useMapStore((s) => s.routeFrom);
  const to = useMapStore((s) => s.routeTo);
  const profile = useMapStore((s) => s.routeProfile);
  const route = useMapStore((s) => s.route);
  const routing = useMapStore((s) => s.routing);
  const clickMode = useMapStore((s) => s.clickMode);
  const setPanel = useMapStore((s) => s.setPanel);
  const setClickMode = useMapStore((s) => s.setClickMode);
  const setRouteEndpoint = useMapStore((s) => s.setRouteEndpoint);
  const setRouteProfile = useMapStore((s) => s.setRouteProfile);
  const setRoute = useMapStore((s) => s.setRoute);
  const requestFly = useMapStore((s) => s.requestFly);
  const msg = t(lang);

  useEffect(() => {
    if (!from || !to) {
      setRoute(null, false);
      return;
    }
    const ctrl = new AbortController();
    setRoute(null, true);
    void fetchRoute(from, to, profile, ctrl.signal)
      .then((r) => {
        setRoute(r, false);
        const coords = r.geometry.coordinates;
        if (coords.length > 0) {
          let w = 180,
            s = 90,
            e = -180,
            n = -90;
          for (const c of coords) {
            const lon = c[0];
            const lat = c[1];
            if (lon === undefined || lat === undefined) continue;
            w = Math.min(w, lon);
            s = Math.min(s, lat);
            e = Math.max(e, lon);
            n = Math.max(n, lat);
          }
          requestFly({ lat: (s + n) / 2, lon: (w + e) / 2, bbox: [w, s, e, n] });
        }
      })
      .catch(() => setRoute(null, false));
    return () => ctrl.abort();
  }, [from, to, profile, requestFly, setRoute]);

  return (
    <aside className="sheet place-sheet">
      <header>
        <h2>{msg.directions}</h2>
        <button type="button" className="icon-quiet" onClick={() => setPanel("none")}>
          ×
        </button>
      </header>
      <div className="route-fields">
        <label>
          <span>
            <IconPin /> {msg.from}
          </span>
          <button
            type="button"
            className={clickMode === "route-from" ? "pick live" : "pick"}
            onClick={() => setClickMode(clickMode === "route-from" ? "browse" : "route-from")}
          >
            {from?.name ?? msg.pickFrom}
          </button>
        </label>
        <button
          type="button"
          className="swap"
          onClick={() => {
            setRouteEndpoint("from", to);
            setRouteEndpoint("to", from);
          }}
          aria-label="swap"
        >
          <IconSwap />
        </button>
        <label>
          <span>
            <IconPin /> {msg.to}
          </span>
          <button
            type="button"
            className={clickMode === "route-to" ? "pick live" : "pick"}
            onClick={() => setClickMode(clickMode === "route-to" ? "browse" : "route-to")}
          >
            {to?.name ?? msg.pickTo}
          </button>
        </label>
      </div>
      <div className="segmented">
        {(["driving", "walking", "cycling"] as const).map((p) => (
          <button key={p} type="button" className={profile === p ? "on" : ""} onClick={() => setRouteProfile(p)}>
            {msg[p]}
          </button>
        ))}
      </div>
      {routing && <p className="search-note">{msg.searching}</p>}
      {!routing && !route && <p className="search-note">{from && to ? msg.noRoute : msg.routeEmpty}</p>}
      {route && (
        <div className="route-result">
          <strong>{formatDistance(route.distance, lang)}</strong>
          <span>{formatDuration(route.duration, lang)}</span>
          {route.legs[0]?.summary && <em>{route.legs[0].summary}</em>}
        </div>
      )}
    </aside>
  );
}
