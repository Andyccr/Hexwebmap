import { create } from "zustand";
import {
  DEFAULT_STYLE_ID,
  defaultView,
  parseMapHash,
  type InspectFeature,
  type Lang,
  type ReversePlace,
  type RouteProfile,
  type RouteResult,
  type SearchHit,
} from "@hexwebmap/shared";

export type ClickMode = "browse" | "measure" | "route-from" | "route-to";
export type Panel = "none" | "place" | "directions" | "layers" | "about";

export type MeasureState = {
  points: [number, number][];
};

export type Toast = { id: number; text: string } | null;

function initialLang(): Lang {
  const saved = localStorage.getItem("hexwebmap.lang");
  if (saved === "zh" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function initialStyle(): string {
  const hash = parseMapHash(window.location.hash);
  if (hash?.style) return hash.style;
  return localStorage.getItem("hexwebmap.style") || DEFAULT_STYLE_ID;
}

function initialView() {
  const hash = parseMapHash(window.location.hash);
  const base = defaultView(navigator.language);
  return {
    zoom: hash?.zoom ?? base.zoom,
    lat: hash?.lat ?? base.lat,
    lon: hash?.lon ?? base.lon,
    bearing: hash?.bearing ?? 0,
    pitch: hash?.pitch ?? 0,
  };
}

export interface MapStore {
  lang: Lang;
  styleId: string;
  view: { zoom: number; lat: number; lon: number; bearing: number; pitch: number };
  embed: boolean;
  loaded: boolean;
  fps: number;
  query: string;
  results: SearchHit[];
  searching: boolean;
  recent: SearchHit[];
  selected: SearchHit | ReversePlace | null;
  inspect: InspectFeature[];
  place: ReversePlace | null;
  panel: Panel;
  clickMode: ClickMode;
  measure: MeasureState;
  routeFrom: SearchHit | null;
  routeTo: SearchHit | null;
  routeProfile: RouteProfile;
  route: RouteResult | null;
  routing: boolean;
  locating: boolean;
  flyTo: {
    lat: number;
    lon: number;
    zoom?: number;
    bbox?: [number, number, number, number];
  } | null;
  toast: Toast;
  setLang: (lang: Lang) => void;
  setStyle: (id: string) => void;
  setView: (view: MapStore["view"]) => void;
  setLoaded: (v: boolean) => void;
  setFps: (n: number) => void;
  setQuery: (q: string) => void;
  setResults: (hits: SearchHit[], searching?: boolean) => void;
  setSearching: (v: boolean) => void;
  remember: (hit: SearchHit) => void;
  selectPlace: (place: SearchHit | ReversePlace, inspect?: InspectFeature[]) => void;
  setPlaceDetails: (place: ReversePlace | null) => void;
  setInspect: (features: InspectFeature[]) => void;
  setPanel: (panel: Panel) => void;
  setClickMode: (mode: ClickMode) => void;
  addMeasurePoint: (pt: [number, number]) => void;
  clearMeasure: () => void;
  setRouteEndpoint: (which: "from" | "to", hit: SearchHit | null) => void;
  setRouteProfile: (p: RouteProfile) => void;
  setRoute: (route: RouteResult | null, routing?: boolean) => void;
  setLocating: (v: boolean) => void;
  requestFly: (target: NonNullable<MapStore["flyTo"]>) => void;
  clearFly: () => void;
  showToast: (text: string) => void;
  clearToast: () => void;
}

const initialRecent = (): SearchHit[] => {
  try {
    const raw = localStorage.getItem("hexwebmap.recent");
    return raw ? (JSON.parse(raw) as SearchHit[]).slice(0, 8) : [];
  } catch {
    return [];
  }
};

let toastSeq = 1;

export const useMapStore = create<MapStore>((set, get) => ({
  lang: initialLang(),
  styleId: initialStyle(),
  view: initialView(),
  embed: new URLSearchParams(window.location.search).has("embed"),
  loaded: false,
  fps: 0,
  query: "",
  results: [],
  searching: false,
  recent: initialRecent(),
  selected: null,
  inspect: [],
  place: null,
  panel: "none",
  clickMode: "browse",
  measure: { points: [] },
  routeFrom: null,
  routeTo: null,
  routeProfile: "driving",
  route: null,
  routing: false,
  locating: false,
  flyTo: null,
  toast: null,
  setLang: (lang) => {
    localStorage.setItem("hexwebmap.lang", lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    set({ lang });
  },
  setStyle: (id) => {
    localStorage.setItem("hexwebmap.style", id);
    set({ styleId: id });
  },
  setView: (view) => set({ view }),
  setLoaded: (loaded) => set({ loaded }),
  setFps: (fps) => set({ fps }),
  setQuery: (query) => set({ query }),
  setResults: (results, searching) =>
    set({ results, searching: searching ?? false }),
  setSearching: (searching) => set({ searching }),
  remember: (hit) => {
    const next = [hit, ...get().recent.filter((r) => r.id !== hit.id)].slice(0, 8);
    localStorage.setItem("hexwebmap.recent", JSON.stringify(next));
    set({ recent: next });
  },
  selectPlace: (place, inspect = []) =>
    set({
      selected: place,
      inspect,
      panel: "place",
      clickMode: "browse",
    }),
  setPlaceDetails: (place) => set({ place }),
  setInspect: (inspect) => set({ inspect }),
  setPanel: (panel) => set({ panel, clickMode: panel === "directions" ? get().clickMode : "browse" }),
  setClickMode: (clickMode) => set({ clickMode }),
  addMeasurePoint: (pt) =>
    set({ measure: { points: [...get().measure.points, pt] } }),
  clearMeasure: () => set({ measure: { points: [] }, clickMode: "browse" }),
  setRouteEndpoint: (which, hit) =>
    set(which === "from" ? { routeFrom: hit } : { routeTo: hit }),
  setRouteProfile: (routeProfile) => set({ routeProfile }),
  setRoute: (route, routing) => set({ route, routing: routing ?? false }),
  setLocating: (locating) => set({ locating }),
  requestFly: (flyTo) => set({ flyTo }),
  clearFly: () => set({ flyTo: null }),
  showToast: (text) => {
    const id = toastSeq++;
    set({ toast: { id, text } });
    window.setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 2400);
  },
  clearToast: () => set({ toast: null }),
}));
