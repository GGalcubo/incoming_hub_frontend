import { loadGoogleMaps, type GMapsGeocoder, type GMapsLatLngLiteral } from "../../lib/gmaps";

export const BA_CENTER: GMapsLatLngLiteral = { lat: -34.6037, lng: -58.3816 };

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
      cb(results?.[0]?.formatted_address ?? null);
    });
  });
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
