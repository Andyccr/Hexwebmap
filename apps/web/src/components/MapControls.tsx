import { MAP_STYLES } from "@hexwebmap/shared";
import { t } from "../i18n";
import { useMapStore } from "../store";
import {
  IconCompass,
  IconLayers,
  IconLocate,
  IconMinus,
  IconPlus,
  IconRoute,
  IconRuler,
  IconShare,
} from "./Icons";

export function MapControls() {
  const lang = useMapStore((s) => s.lang);
  const panel = useMapStore((s) => s.panel);
  const clickMode = useMapStore((s) => s.clickMode);
  const locating = useMapStore((s) => s.locating);
  const view = useMapStore((s) => s.view);
  const setPanel = useMapStore((s) => s.setPanel);
  const setClickMode = useMapStore((s) => s.setClickMode);
  const clearMeasure = useMapStore((s) => s.clearMeasure);
  const requestFly = useMapStore((s) => s.requestFly);
  const setLocating = useMapStore((s) => s.setLocating);
  const showToast = useMapStore((s) => s.showToast);
  const selectPlace = useMapStore((s) => s.selectPlace);
  const msg = t(lang);

  return (
    <>
      <div className="ctrl-stack left">
        <div className="ctrl-group">
          <button
            type="button"
            title={msg.zoomIn}
            onClick={() => window.dispatchEvent(new CustomEvent("hex-zoom", { detail: 1 }))}
          >
            <IconPlus />
          </button>
          <button
            type="button"
            title={msg.zoomOut}
            onClick={() => window.dispatchEvent(new CustomEvent("hex-zoom", { detail: -1 }))}
          >
            <IconMinus />
          </button>
        </div>
        <div className="ctrl-group">
          <button
            type="button"
            title={msg.compass}
            className={Math.abs(view.bearing) > 1 || view.pitch > 1 ? "live" : ""}
            onClick={() => window.dispatchEvent(new Event("hex-north"))}
          >
            <span className="compass-face" style={{ transform: `rotate(${-view.bearing}deg)` }}>
              <IconCompass />
            </span>
          </button>
          <button
            type="button"
            title={msg.threeD}
            className={view.pitch > 5 ? "live" : ""}
            onClick={() => window.dispatchEvent(new Event("hex-tilt"))}
          >
            3D
          </button>
        </div>
        <div className="ctrl-group">
          <button
            type="button"
            title={msg.locate}
            className={locating ? "live" : ""}
            onClick={() => {
              setLocating(true);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setLocating(false);
                  requestFly({ lat: pos.coords.latitude, lon: pos.coords.longitude, zoom: 15 });
                  selectPlace({
                    name: lang === "zh" ? "当前位置" : "Current location",
                    displayName: lang === "zh" ? "当前位置" : "Current location",
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    address: {},
                    extratags: {},
                  });
                },
                () => {
                  setLocating(false);
                  showToast(msg.locateFail);
                },
                { enableHighAccuracy: true, timeout: 8000 },
              );
            }}
          >
            <IconLocate />
          </button>
          <button
            type="button"
            title={msg.measure}
            className={clickMode === "measure" ? "live" : ""}
            onClick={() => {
              if (clickMode === "measure") clearMeasure();
              else setClickMode("measure");
            }}
          >
            <IconRuler />
          </button>
        </div>
      </div>
      <div className="ctrl-stack right">
        <div className="ctrl-group">
          <button
            type="button"
            title={msg.layers}
            className={panel === "layers" ? "live" : ""}
            onClick={() => setPanel(panel === "layers" ? "none" : "layers")}
          >
            <IconLayers />
          </button>
          <button
            type="button"
            title={msg.directions}
            className={panel === "directions" ? "live" : ""}
            onClick={() => setPanel(panel === "directions" ? "none" : "directions")}
          >
            <IconRoute />
          </button>
          <button
            type="button"
            title={msg.share}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                showToast(msg.shared);
              } catch {
                showToast(window.location.href);
              }
            }}
          >
            <IconShare />
          </button>
        </div>
      </div>
    </>
  );
}

export function LayerPanel() {
  const lang = useMapStore((s) => s.lang);
  const styleId = useMapStore((s) => s.styleId);
  const panel = useMapStore((s) => s.panel);
  const setStyle = useMapStore((s) => s.setStyle);
  const setPanel = useMapStore((s) => s.setPanel);
  const msg = t(lang);
  if (panel !== "layers") return null;

  const groups = [
    { id: "carto" as const, label: msg.layersCarto },
    { id: "theme" as const, label: msg.layersTheme },
    { id: "special" as const, label: msg.layersSpecial },
  ];

  return (
    <aside className="sheet layers-sheet">
      <header>
        <h2>{msg.layers}</h2>
        <button type="button" className="icon-quiet" onClick={() => setPanel("none")}>
          ×
        </button>
      </header>
      {groups.map((g) => (
        <section key={g.id}>
          <h3>{g.label}</h3>
          <div className="layer-grid">
            {MAP_STYLES.filter((s) => s.group === g.id).map((s) => (
              <button
                key={s.id}
                type="button"
                className={`layer-card ${styleId === s.id ? "active" : ""}`}
                onClick={() => setStyle(s.id)}
              >
                <span className="swatch" data-style={s.id} />
                <strong>{s.name[lang]}</strong>
                <em>{s.description[lang]}</em>
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
