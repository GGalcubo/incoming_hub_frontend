// Carga perezosa de la API de Google Maps (librería Places).
// Devuelve el namespace google.maps cuando está listo. Si no hay API key o
// falla la carga, resuelve a null y los componentes caen al listado local.

export interface GMapsLatLngLiteral {
  lat: number;
  lng: number;
}

export interface GMapsLatLng {
  lat(): number;
  lng(): number;
}

export interface GMapsPlacePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
}

export interface GMapsAutocompleteService {
  getPlacePredictions(
    req: {
      input: string;
      componentRestrictions?: { country: string | string[] };
      language?: string;
      sessionToken?: unknown;
      types?: string[];
    },
    cb: (predictions: GMapsPlacePrediction[] | null, status: string) => void,
  ): void;
}

export interface GMapsGeocoderResult {
  formatted_address: string;
  place_id: string;
  geometry: { location: GMapsLatLng };
}

export interface GMapsGeocoder {
  geocode(
    req: {
      placeId?: string;
      location?: GMapsLatLngLiteral;
      address?: string;
      componentRestrictions?: { country?: string | string[] };
      region?: string;
    },
    cb: (results: GMapsGeocoderResult[] | null, status: string) => void,
  ): void;
}

export interface GMapsMapOptions {
  center: GMapsLatLngLiteral;
  zoom: number;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  clickableIcons?: boolean;
  gestureHandling?: string;
  styles?: unknown[];
  disableDefaultUI?: boolean;
  zoomControl?: boolean;
}

export interface GMapsMap {
  setCenter(p: GMapsLatLngLiteral): void;
  setZoom(z: number): void;
  fitBounds(bounds: GMapsLatLngBounds, padding?: number): void;
  panTo(p: GMapsLatLngLiteral): void;
  addListener(evt: string, cb: (...args: unknown[]) => void): unknown;
}

export interface GMapsMarkerOptions {
  position: GMapsLatLngLiteral;
  map: GMapsMap;
  draggable?: boolean;
  label?: string | { text: string; color?: string; fontWeight?: string };
  title?: string;
  icon?: unknown;
}

export interface GMapsMarker {
  setPosition(p: GMapsLatLngLiteral): void;
  getPosition(): GMapsLatLng | null;
  setMap(m: GMapsMap | null): void;
  addListener(evt: string, cb: (...args: unknown[]) => void): unknown;
}

export interface GMapsLatLngBounds {
  extend(p: GMapsLatLngLiteral): void;
  isEmpty(): boolean;
}

export interface GMapsPolylineOptions {
  path: GMapsLatLngLiteral[];
  map: GMapsMap | null;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  geodesic?: boolean;
  icons?: unknown[];
}

export interface GMapsPolyline {
  setPath(path: GMapsLatLngLiteral[]): void;
  setMap(m: GMapsMap | null): void;
}

export interface GMapsPlacesNamespace {
  AutocompleteService: new () => GMapsAutocompleteService;
  AutocompleteSessionToken: new () => unknown;
  PlacesServiceStatus: { OK: string; ZERO_RESULTS: string };
}

export interface GMapsMouseEvent {
  latLng?: GMapsLatLng;
}

export interface GMapsNamespace {
  Map: new (el: HTMLElement, opts: GMapsMapOptions) => GMapsMap;
  Marker: new (opts: GMapsMarkerOptions) => GMapsMarker;
  Geocoder: new () => GMapsGeocoder;
  LatLngBounds: new () => GMapsLatLngBounds;
  Polyline: new (opts: GMapsPolylineOptions) => GMapsPolyline;
  places: GMapsPlacesNamespace;
  event: {
    removeListener(handle: unknown): void;
    clearInstanceListeners(instance: unknown): void;
  };
}

declare global {
  interface Window {
    google?: { maps?: GMapsNamespace };
    __gmapsLoader?: Promise<GMapsNamespace | null>;
  }
}

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";

export function hasGoogleMapsKey(): boolean {
  return !!API_KEY;
}

export function loadGoogleMaps(): Promise<GMapsNamespace | null> {
  if (!API_KEY) return Promise.resolve(null);
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps);
  if (window.__gmapsLoader) return window.__gmapsLoader;

  window.__gmapsLoader = new Promise<GMapsNamespace | null>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-gmaps-loader]");
    const onReady = () => resolve(window.google?.maps ?? null);
    if (existing) {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.gmapsLoader = "1";
    const params = new URLSearchParams({
      key: API_KEY,
      libraries: "places",
      language: "es",
      region: "AR",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(script);
  });

  return window.__gmapsLoader;
}

export function loadGoogleMapsPlaces(): Promise<GMapsPlacesNamespace | null> {
  return loadGoogleMaps().then((m) => m?.places ?? null);
}
