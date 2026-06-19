import { loadGoogleMaps, type GMapsGeocoder, type GMapsLatLngLiteral } from "../../lib/gmaps";

export const BA_CENTER: GMapsLatLngLiteral = { lat: -34.6037, lng: -58.3816 };

// Acota una dirección formateada por Google: quita el código postal argentino,
// abrevia las jurisdicciones largas (CABA / PBA) y elimina el país redundante.
export function shortenAddress(raw: string): string {
  if (!raw) return raw;
  let s = raw;
  // Código postal argentino (CPA): letra + 4 dígitos + 3 letras (ej. C1430BCR).
  s = s.replace(/\b[A-Za-z]\d{4}[A-Za-z]{3}\b/g, "");
  // Jurisdicciones: "Ciudad/Cdad. Autónoma de Buenos Aires" → CABA.
  s = s.replace(/(?:Ciudad|Cdad\.?)\s*Aut[oó]noma de Buenos Aires/gi, "CABA");
  s = s.replace(/Provincia de Buenos Aires/gi, "PBA");
  // País redundante al final.
  s = s.replace(/,?\s*Argentina\s*$/i, "");
  // Limpieza de comas y espacios sobrantes.
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/\s*,\s*,/g, ",");
  s = s.replace(/\s+,/g, ",");
  s = s.replace(/^[\s,]+|[\s,]+$/g, "");
  return s.trim();
}

let geocoderInstance: GMapsGeocoder | null = null;

function getGeocoder(cb: (g: GMapsGeocoder | null) => void) {
  if (geocoderInstance) {
    cb(geocoderInstance);
    return;
  }
  loadGoogleMaps().then((maps) => {
    if (!maps) {
      cb(null);
      return;
    }
    geocoderInstance = new maps.Geocoder();
    cb(geocoderInstance);
  });
}

export function geocodePlaceId(placeId: string, cb: (coords: GMapsLatLngLiteral | null) => void) {
  getGeocoder((g) => {
    if (!g) {
      cb(null);
      return;
    }
    g.geocode({ placeId }, (results) => {
      const loc = results?.[0]?.geometry?.location;
      cb(loc ? { lat: loc.lat(), lng: loc.lng() } : null);
    });
  });
}

export function reverseGeocode(point: GMapsLatLngLiteral, cb: (address: string | null) => void) {
  getGeocoder((g) => {
    if (!g) {
      cb(null);
      return;
    }
    g.geocode({ location: point }, (results) => {
      const addr = results?.[0]?.formatted_address;
      cb(addr ? shortenAddress(addr) : null);
    });
  });
}

// Versión con Promise de geocodeAddress: resuelve la dirección a coordenadas
// usando el primer resultado de Google (o null si no hay key/coincidencia).
export function geocodeAddressAsync(address: string): Promise<GMapsLatLngLiteral | null> {
  return new Promise((resolve) => geocodeAddress(address, resolve));
}

export function geocodeAddress(address: string, cb: (coords: GMapsLatLngLiteral | null) => void) {
  getGeocoder((g) => {
    if (!g) {
      cb(null);
      return;
    }
    g.geocode({ address, componentRestrictions: { country: "ar" }, region: "AR" }, (results) => {
      const loc = results?.[0]?.geometry?.location;
      cb(loc ? { lat: loc.lat(), lng: loc.lng() } : null);
    });
  });
}
