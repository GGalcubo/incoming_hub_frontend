// Geocoding para el import de Excel: resuelve cada dirección con Google y
// devuelve coords + el formatted_address COMPLETO (sin acortar), para mostrarlo
// en la pre-carga y crear el viaje con lat/lng. Vive en lib/ (solo depende de
// lib/gmaps) para no invertir el layering desde api/.
import type { ExcelLeg, ExcelRow } from "../types/domain";
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

  // No muta las filas (devuelve copias) y es idempotente: solo geocodifica los
  // endpoints SIN coords, así respeta lo ya resuelto y re-resuelve lo editado.
  const out: ExcelRow[] = [];
  for (const row of rows) {
    const warnings = [...row.warnings];
    const legs: ExcelLeg[] = [];
    for (const leg of row.legs) {
      const next: ExcelLeg = { ...leg };
      if (next.origin && !next.originCoords) {
        const o = await resolve(next.origin);
        if (o) {
          next.originCoords = { lat: o.lat, lng: o.lng };
          next.originResolved = o.formatted;
        } else {
          warnings.push(`No se pudo geolocalizar el origen "${next.origin}"`);
        }
      }
      if (next.destination && !next.destinationCoords) {
        const d = await resolve(next.destination);
        if (d) {
          next.destinationCoords = { lat: d.lat, lng: d.lng };
          next.destinationResolved = d.formatted;
        } else {
          warnings.push(`No se pudo geolocalizar el destino "${next.destination}"`);
        }
      }
      legs.push(next);
    }
    out.push({ ...row, legs, warnings });
  }
  return out;
}
