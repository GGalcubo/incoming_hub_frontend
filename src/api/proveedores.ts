// Proveedores: catálogo y asignación viaje → proveedor.
//
// El backend todavía no modela proveedores (ni /proveedores/, ni un campo en
// /viajes/), así que esto vive en el frontend:
//   - el catálogo sale del seed (data/tarifasSeed.ts);
//   - la asignación viaje → proveedor se guarda en localStorage indexada por id
//     de viaje, así funciona igual contra el mock y contra el backend real (el
//     id del viaje es estable en los dos casos).
// Cuando el backend agregue el campo, se reemplaza `loadAsignaciones` por lo que
// venga en el viaje y se borra el overlay.

import { DEFAULT_PROVEEDOR_ID, PROVEEDORES } from "../data/tarifasSeed";
import type { Proveedor } from "../types/tarifas";
import type { MeProfile } from "./backend";

export { DEFAULT_PROVEEDOR_ID };

const ASIGNACIONES_KEY = "proxy:tripProveedor";

// Id de proveedor del usuario logueado, o null si no es proveedor. Usamos el
// username: es lo único estable que expone /auth/me/ y es la misma clave con la
// que el mock de auth deriva el rol.
export function proveedorIdOf(me: MeProfile | null | undefined): string | null {
  if (!me || me.role !== "proveedor") return null;
  return me.username.trim().toLowerCase() || null;
}

// Mapa { idViaje: idProveedor }.
export function loadAsignaciones(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ASIGNACIONES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* almacenamiento no disponible o dato inválido */
  }
  return {};
}

// Guarda (o borra, si `proveedorId` viene vacío) el proveedor de un viaje.
export function setAsignacion(tripId: string, proveedorId: string | undefined) {
  const map = loadAsignaciones();
  if (proveedorId) map[tripId] = proveedorId;
  else delete map[tripId];
  try {
    localStorage.setItem(ASIGNACIONES_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// Catálogo: el seed más cualquier proveedor que ya aparezca asignado a un viaje
// (p. ej. si se asignó desde otra sesión) y el usuario logueado si es proveedor
// y no está en la lista.
export async function listProveedores(me?: MeProfile | null): Promise<Proveedor[]> {
  const out = new Map(PROVEEDORES.map((p) => [p.id, p]));
  for (const id of Object.values(loadAsignaciones())) {
    if (!out.has(id)) out.set(id, { id, nombre: id });
  }
  const propio = proveedorIdOf(me);
  if (propio && !out.has(propio)) {
    const nombre = `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim() || propio;
    out.set(propio, { id: propio, nombre });
  }
  return Array.from(out.values());
}

// Nombre visible de un proveedor (cae al id si no está en el catálogo).
export function nombreProveedor(id: string | undefined, catalogo: Proveedor[]): string {
  if (!id) return "—";
  return catalogo.find((p) => p.id === id)?.nombre ?? id;
}
