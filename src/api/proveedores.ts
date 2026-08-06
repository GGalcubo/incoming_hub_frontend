// Proveedor del usuario logueado.
//
// El proveedor está modelado en el backend: el viaje lo trae en `viaje.proveedor`,
// el usuario logueado en `/auth/me/.proveedor` y el catálogo sale de
// /tarifarios/proveedores/ (ver api/tarifasCrud.ts). Acá solo queda el helper que
// lee el id del perfil.

import type { MeProfile } from "./backend";

// Id de proveedor del usuario logueado, o null si no es proveedor. Es el "scope"
// con el que se filtran su tarifario y sus viajes.
//
// Un usuario con rol `provider` y sin `proveedor` en el perfil está MAL
// configurado: devolvemos null (no ve nada) en vez de inventarle un id, que es lo
// que hacía el modo demo con el username.
export function proveedorIdOf(me: MeProfile | null | undefined): string | null {
  if (!me || me.role !== "provider") return null;
  return me.proveedor ? String(me.proveedor.id) : null;
}
