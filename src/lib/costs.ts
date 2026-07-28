import type { TripCosts } from "../types/domain";

// Los costos del viaje tienen dos columnas: lo que se le factura al CLIENTE
// (`viaje`, `espera`, `peajes`, …) y lo que cobra el PROVEEDOR (`tarifaProveedor`,
// `esperaProveedor`, `peajesProveedor`, …). Los totales de las dos se recalculan
// juntos cada vez que cambia un rubro para que no queden desincronizados.

export function totalCliente(c: TripCosts): number {
  return c.viaje + c.espera + c.peajes + c.estacionamiento + c.otros;
}

export function totalProveedor(c: TripCosts): number {
  return (
    (c.tarifaProveedor ?? 0) +
    (c.esperaProveedor ?? 0) +
    (c.peajesProveedor ?? 0) +
    (c.estacionamientoProveedor ?? 0) +
    (c.otrosProveedor ?? 0)
  );
}

// Devuelve los costos con los dos totales al día. `total` es el del cliente: es
// el único que hoy viaja al backend (costo_total).
export function withTotals(c: TripCosts): TripCosts {
  return { ...c, total: totalCliente(c), totalProveedor: totalProveedor(c) };
}
