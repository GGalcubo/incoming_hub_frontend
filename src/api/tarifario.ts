// Capa de API del TARIFARIO del backend (/api/v1/tarifarios/…) y de los costos
// del viaje (/api/v1/viajes/{id}/costos/).
//
// El flujo que implementa, de punta a punta:
//   1. `listZonas()` puebla los dropdowns de origen/destino (EZE, AEP, CABA…).
//   2. `cotizar()` devuelve, para esa ruta, todas las tarifas vigentes agrupadas
//      por proveedor (una por categoría de vehículo). El usuario elige una.
//   3. El id de esa tarifa viaja en el tramo (`TramoInput.tarifa` en el alta,
//      `setTramoTarifa` al modificar): con eso el backend crea/recalcula el
//      registro de costos con la base del tarifario.
//   4. `getCostos()` / `patchCostos()` leen y ajustan los costos del viaje. La
//      base (`costo_viaje_*`) y los totales los calcula el backend: por PATCH
//      solo van los ajustes manuales (espera, peajes, estacionamiento, otros).
//
// OJO: esto NO reemplaza a api/tarifas.ts (el mock de las pantallas de Tarifas),
// que sigue sirviendo el tarifario local mientras esas vistas no se migren.

import type {
  ComentarioCosto,
  CostoViaje,
  CostoViajePatch,
  CotizarOutput,
  TarifaCRUD,
  Tramo,
  Zona,
} from "./backend";
import type { TripComentario } from "../types/domain";
import { fetchAll, request } from "./http";

// ── Catálogo de zonas ────────────────────────────────────────────────────────
// Cache por sesión: el catálogo es chico y no cambia mientras se usa la app.
let zonasPromise: Promise<Zona[]> | null = null;

export function listZonas(): Promise<Zona[]> {
  if (!zonasPromise) {
    zonasPromise = fetchAll<Zona>("/tarifarios/zonas/?activo=true").catch((err) => {
      zonasPromise = null; // permite reintentar tras un fallo
      throw err;
    });
  }
  return zonasPromise;
}

// Etiqueta con la que se muestra y se elige una zona. Usamos el `codigo_ref`
// (EZE, AEP, CABA) porque es la clave con la que se cotiza por código; si una
// zona no lo tiene, cae al nombre.
export const zonaKey = (z: Zona) => z.codigo_ref || z.nombre;

// ── Cotización ───────────────────────────────────────────────────────────────
// Tarifas vigentes de una ruta, por código de zona (el mismo valor que devuelve
// `zonaKey`). Devuelve todos los proveedores que tienen tarifa para el tramo.
export function cotizar(origen: string, destino: string, fecha?: string): Promise<CotizarOutput> {
  return request<CotizarOutput>("/tarifarios/cotizar-por-codigo/", {
    method: "POST",
    body: JSON.stringify({ origen, destino, ...(fecha ? { fecha } : {}) }),
  });
}

// Detalle de una tarifa ya elegida (para reconstruir la ruta al reabrir un viaje:
// del tramo solo tenemos el id de la tarifa).
export function getTarifa(id: number): Promise<TarifaCRUD> {
  return request<TarifaCRUD>(`/tarifarios/tarifas/${id}/`);
}

// ── Tarifa del tramo ─────────────────────────────────────────────────────────
// Endpoint dedicado: cambiar la tarifa recalcula el costo del viaje desde la
// base nueva (el backend resetea los ajustes manuales), así que si además hay
// costos que guardar, este PATCH va PRIMERO.
export function setTramoTarifa(tramoId: number, tarifa: number | null): Promise<Tramo> {
  return request<Tramo>(`/tramos/${tramoId}/tarifa/`, {
    method: "PATCH",
    body: JSON.stringify({ tarifa }),
  });
}

// ── Costos del viaje ─────────────────────────────────────────────────────────
export function getCostos(viajeId: string | number): Promise<CostoViaje> {
  return request<CostoViaje>(`/viajes/${viajeId}/costos/`);
}

export function patchCostos(
  viajeId: string | number,
  patch: CostoViajePatch,
): Promise<CostoViaje> {
  return request<CostoViaje>(`/viajes/${viajeId}/costos/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ── Comentarios del costo ────────────────────────────────────────────────────
// Cuelgan del costo del viaje, no del viaje: se leen embebidos en el GET de
// costos y se escriben por su propio sub-recurso. El autor lo fija el backend
// con el usuario logueado, así que la vista no lo manda.
//
// El backend NO devuelve el rol del autor (solo id y nombre), así que la chapita
// de "de qué lado del mostrador vino" queda sin poner: preferimos no mostrarla
// antes que adivinarla con el rol del que está leyendo.
function toTripComentario(c: ComentarioCosto): TripComentario {
  return {
    id: String(c.id),
    autor: c.autor_nombre || `Usuario #${c.autor}`,
    rol: null,
    texto: c.texto,
    fecha: c.created_at,
  };
}

export async function listComentariosCosto(viajeId: string | number): Promise<TripComentario[]> {
  const costos = await getCostos(viajeId);
  return (costos.comentarios ?? []).map(toTripComentario);
}

export async function addComentarioCosto(
  viajeId: string | number,
  texto: string,
): Promise<TripComentario> {
  const creado = await request<ComentarioCosto>(`/viajes/${viajeId}/costos/comentarios/`, {
    method: "POST",
    body: JSON.stringify({ texto }),
  });
  return toTripComentario(creado);
}
