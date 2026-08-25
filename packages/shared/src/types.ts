export type Lang = "zh" | "en";

export type StyleKind = "vector" | "raster";

export interface MapStyle {
  id: string;
  kind: StyleKind;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  /** MapLibre style URL, or an inline raster style served by the app. */
  url: string;
  group: "carto" | "theme" | "special";
}

export interface MapView {
  zoom: number;
  lat: number;
  lon: number;
  bearing: number;
  pitch: number;
}

export interface SearchHit {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  osmKey?: string;
  osmValue?: string;
  osmType?: string;
  osmId?: number;
  country?: string;
  /** west, south, east, north */
  bbox?: [number, number, number, number];
}

export interface ReversePlace {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  osmType?: string;
  osmId?: number;
  category?: string;
  type?: string;
  address: Record<string, string>;
  extratags: Record<string, string>;
  licence?: string;
}

export interface InspectFeature {
  sourceLayer?: string;
  layerId: string;
  geometryType?: string;
  properties: Record<string, string | number | boolean | null>;
}

export type RouteProfile = "driving" | "walking" | "cycling";

export interface RouteLeg {
  distance: number;
  duration: number;
  summary: string;
}

export interface RouteResult {
  distance: number;
  duration: number;
  profile: RouteProfile;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  legs: RouteLeg[];
}

export interface AppConfig {
  name: string;
  defaultStyle: string;
  styles: MapStyle[];
}
