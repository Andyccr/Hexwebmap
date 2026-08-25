import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { parseCoordinateQuery, type SearchHit } from "@hexwebmap/shared";
import { searchPlaces } from "../api";
import { t } from "../i18n";
import { useMapStore } from "../store";
import { IconClose, IconHex, IconSearch } from "./Icons";

export function Header() {
  const lang = useMapStore((s) => s.lang);
  const query = useMapStore((s) => s.query);
  const results = useMapStore((s) => s.results);
  const searching = useMapStore((s) => s.searching);
  const recent = useMapStore((s) => s.recent);
  const setQuery = useMapStore((s) => s.setQuery);
  const setResults = useMapStore((s) => s.setResults);
  const setSearching = useMapStore((s) => s.setSearching);
  const remember = useMapStore((s) => s.remember);
  const selectPlace = useMapStore((s) => s.selectPlace);
  const requestFly = useMapStore((s) => s.requestFly);
  const setLang = useMapStore((s) => s.setLang);
  const setPanel = useMapStore((s) => s.setPanel);
  const embed = useMapStore((s) => s.embed);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const msg = t(lang);

  const coordHit = useMemo(() => {
    const parsed = parseCoordinateQuery(query);
    if (!parsed) return null;
    const hit: SearchHit = {
      id: `coord-${parsed.lat},${parsed.lon}`,
      name: `${parsed.lat.toFixed(5)}, ${parsed.lon.toFixed(5)}`,
      label: lang === "zh" ? "坐标" : "Coordinates",
      lat: parsed.lat,
      lon: parsed.lon,
    };
    return hit;
  }, [query, lang]);

  const shown = coordHit ? [coordHit, ...results] : results;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    if (coordHit && q.length < 4) return;
    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      void searchPlaces(q, lang, ctrl.signal)
        .then((data) => setResults(data.hits, false))
        .catch((err: unknown) => {
          if ((err as { name?: string }).name === "AbortError") return;
          setResults([], false);
        });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, lang, coordHit, setResults, setSearching]);

  function choose(hit: SearchHit) {
    remember(hit);
    selectPlace(hit);
    requestFly({ lat: hit.lat, lon: hit.lon, zoom: 14, bbox: hit.bbox });
    setOpen(false);
    setQuery(hit.name);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, shown.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const hit = shown[active];
      if (hit) choose(hit);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  if (embed) return null;

  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label={msg.brand}>
        <span className="brand-mark">
          <IconHex />
        </span>
        <span className="brand-text">
          <strong>{msg.brand}</strong>
          <em>{msg.tagline}</em>
        </span>
      </a>
      <div className={`search ${open ? "open" : ""}`}>
        <span className="search-icon">
          <IconSearch />
        </span>
        <input
          ref={inputRef}
          value={query}
          placeholder={msg.searchPlaceholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          onKeyDown={onKey}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {query && (
          <button
            className="icon-quiet"
            type="button"
            aria-label={msg.clear}
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
          >
            <IconClose />
          </button>
        )}
        {open && (
          <div className="search-menu" role="listbox">
            {searching && <div className="search-note">{msg.searching}</div>}
            {!searching && shown.length === 0 && query.trim().length >= 2 && (
              <div className="search-note">{msg.noResults}</div>
            )}
            {!query && recent.length > 0 && (
              <>
                <div className="search-label">{msg.recent}</div>
                {recent.map((hit, i) => (
                  <button
                    type="button"
                    className="search-item"
                    key={`recent-${hit.id}-${i}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(hit)}
                  >
                    <strong>{hit.name}</strong>
                    <span>{hit.label}</span>
                  </button>
                ))}
              </>
            )}
            {shown.map((hit, i) => (
              <button
                type="button"
                className={`search-item ${i === active ? "active" : ""}`}
                key={`hit-${hit.id}-${i}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(hit)}
                onMouseEnter={() => setActive(i)}
              >
                <strong>{hit.name}</strong>
                <span>{hit.label}</span>
              </button>
            ))}
            {!query && recent.length === 0 && <div className="search-note">{msg.searchHint}</div>}
          </div>
        )}
      </div>
      <div className="top-actions">
        <button type="button" className="text-btn" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {msg.lang}
        </button>
        <button type="button" className="text-btn" onClick={() => setPanel("about")}>
          {msg.about}
        </button>
      </div>
    </header>
  );
}
