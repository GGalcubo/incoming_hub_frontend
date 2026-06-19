// Geocoding para el import de Excel: resuelve cada dirección con Google y
// devuelve coords + el formatted_address COMPLETO (sin acortar), para mostrarlo
// en la pre-carga y crear el viaje con lat/lng. Vive en lib/ (solo depende de
// lib/gmaps) para no invertir el layering desde api/.
import type { ExcelRow } from "../types/domain";
import {
  hasGoogleMapsKey,
  loadGoogleMaps,
  type GMapsGeocoder,
  type GMapsLatLngLiteral,
} from "./gmaps";

let geocoder: GMapsGeocoder | null = null;

async function getGeocoder(): Promise<GMapsGeocoder | null> {
  if (geocoder) return geocoder;
  const maps = await loadGoogleMaps();
  if (!maps) return null;
  geocoder = new maps.Geocoder();
  return geocoder;
}

export interface GeoResult extends GMapsLatLngLiteral {
  formatted: string;
}

export async function geocodeAddressFull(address: string): Promise<GeoResult | null> {
  const addr = address.trim();
  if (!addr) return null;
  const g = await getGeocoder();
  if (!g) return null;
  return new Promise<GeoResult | null>((resolve) => {
    g.geocode(
      { address: addr, componentRestrictions: { country: "ar" }, region: "AR" },
      (results) => {
        const r = results?.[0];
        const loc = r?.geometry?.location;
        resolve(
          r && loc ? { lat: loc.lat(), lng: loc.lng(), formatted: r.formatted_address } : null,
        );
      },
    );
  });
}

// Enriquece las filas con coords + dirección resuelta. Sin API key de Google,
// devuelve las filas tal cual (se conserva el texto del Excel). Secuencial y con
// cache por dirección para no repetir llamadas (ej. el mismo aeropuerto).
export async function geocodeRows(rows: ExcelRow[]): Promise<ExcelRow[]> {
  if (!hasGoogleMapsKey()) return rows;

  const cache = new Map<string, GeoResult | null>();
  const resolve = async (addr: string): Promise<GeoResult | null> => {
    const key = addr.trim().toLowerCase();
    if (!key) return null;
    if (!cache.has(key)) cache.set(key, await geocodeAddressFull(addr));
    return cache.get(key) ?? null;
  };

  for (const row of rows) {
    for (const leg of row.legs) {
      if (leg.origin) {
        const o = await resolve(leg.origin);
        if (o) {
          leg.originCoords = { lat: o.lat, lng: o.lng };
          leg.originResolved = o.formatted;
        } else {
          row.warnings.push(`No se pudo geolocalizar el origen "${leg.origin}"`);
        }
      }
      if (leg.destination) {
        const d = await resolve(leg.destination);
        if (d) {
          leg.destinationCoords = { lat: d.lat, lng: d.lng };
          leg.destinationResolved = d.formatted;
        } else {
          row.warnings.push(`No se pudo geolocalizar el destino "${leg.destination}"`);
        }
      }
    }
  }
  return rows;
}
