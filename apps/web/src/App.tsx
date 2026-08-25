import { lazy, Suspense, useEffect } from "react";
import { Header } from "./components/Header";
import { AboutModal, StatusBar, Toast } from "./components/Chrome";
import { LayerPanel, MapControls } from "./components/MapControls";
import { Sidebar } from "./components/Sidebar";
import { useMapStore } from "./store";

const MapView = lazy(() => import("./map/MapView").then((m) => ({ default: m.MapView })));

export function App() {
  const embed = useMapStore((s) => s.embed);
  const setPanel = useMapStore((s) => s.setPanel);
  const lang = useMapStore((s) => s.lang);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "Escape") setPanel("none");
      if (typing) return;
      if (e.key === "/" || e.key === "f" || e.key === "F") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search input")?.focus();
      }
      if (e.key === "=" || e.key === "+") {
        window.dispatchEvent(new CustomEvent("hex-zoom", { detail: 1 }));
      }
      if (e.key === "-" || e.key === "_") {
        window.dispatchEvent(new CustomEvent("hex-zoom", { detail: -1 }));
      }
      if (e.key === "0") window.dispatchEvent(new Event("hex-north"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanel]);

  return (
    <div className={`app ${embed ? "embed" : ""}`}>
      <Header />
      <main className="stage">
        <Suspense fallback={<div className="map-stage" />}>
          <MapView />
        </Suspense>
        <MapControls />
        <LayerPanel />
        <Sidebar />
        <StatusBar />
        <Toast />
        <AboutModal />
      </main>
    </div>
  );
}
