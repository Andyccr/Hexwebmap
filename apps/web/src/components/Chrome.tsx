import { formatCoord, getStyle } from "@hexwebmap/shared";
import { t } from "../i18n";
import { useMapStore } from "../store";

export function StatusBar() {
  const lang = useMapStore((s) => s.lang);
  const view = useMapStore((s) => s.view);
  const styleId = useMapStore((s) => s.styleId);
  const loaded = useMapStore((s) => s.loaded);
  const msg = t(lang);
  const style = getStyle(styleId);

  return (
    <footer className="statusbar">
      <span className="mono">{formatCoord(view.lat, view.lon)}</span>
      <span className="dot" />
      <span>z {view.zoom.toFixed(2)}</span>
      <span className="dot" />
      <span>{style.name[lang]}</span>
      <span className="grow" />
      {!loaded && <span>{msg.loading}</span>}
    </footer>
  );
}

export function AboutModal() {
  const lang = useMapStore((s) => s.lang);
  const panel = useMapStore((s) => s.panel);
  const setPanel = useMapStore((s) => s.setPanel);
  const msg = t(lang);
  if (panel !== "about") return null;
  return (
    <div className="modal-back" onClick={() => setPanel("none")}>
      <article className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="about-title">
        <header>
          <h2 id="about-title">{msg.about}</h2>
          <button type="button" className="icon-quiet" onClick={() => setPanel("none")}>
            ×
          </button>
        </header>
        <p className="host-pill">{msg.host}</p>
        <p>{msg.aboutBody}</p>
        <p>{msg.aboutData}</p>
        <p>{msg.aboutPerf}</p>
        <p className="modal-links">
          <a href="https://github.com/Andyccr/Hexwebmap" target="_blank" rel="noreferrer">
            {msg.source}
          </a>
          <a href={`${import.meta.env.BASE_URL}LICENSE`} target="_blank" rel="noreferrer">
            {msg.license} (AGPL-3.0)
          </a>
        </p>
      </article>
    </div>
  );
}

export function Toast() {
  const toast = useMapStore((s) => s.toast);
  if (!toast) return null;
  return <div className="toast">{toast.text}</div>;
}
