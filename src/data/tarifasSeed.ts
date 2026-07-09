import type { TarifaBase, TarifaExtras, VehicleCategoria } from "../types/tarifas";

// Lugares disponibles para el origen/destino de una tarifa. Por ahora, según lo
// que definió el negocio, arrancamos con los aeropuertos y "Centro" (AEP/EZE al
// centro y AEP↔EZE). Es un catálogo acotado a propósito.
export const TARIFA_LUGARES = ["EZE", "AEP", "Centro"];

// Categorías de vehículo del paso "Tarifa" (mismas 4 del deck).
export const VEHICLE_CATEGORIAS: VehicleCategoria[] = [
  { codigo: "STD", nombre: "STANDARD", vehiculo: "Fiat Cronos (o similar)", orden: 1 },
  { codigo: "EJE", nombre: "EJECUTIVO", vehiculo: "Toyota Corolla (o similar)", orden: 2 },
  { codigo: "VVIP", nombre: "VAN VIP", vehiculo: "MB Vito (o similar)", orden: 3 },
  { codigo: "VAN", nombre: "VAN", vehiculo: "MB Sprinter (o similar)", orden: 4 },
];

// Helper para no repetir la estructura fila por fila. `cli` es la tarifa cliente
// (la del deck para EZE→Centro: 35/60/90/110) y `prov` el costo del proveedor.
function tarifa(
  n: number,
  origen: string,
  destino: string,
  categoria: string,
  prov: number,
  cli: number,
): TarifaBase {
  return {
    id: `T-${String(n).padStart(3, "0")}`,
    origen,
    destino,
    categoria,
    tarifaProveedor: prov,
    tarifaCliente: cli,
    activo: true,
  };
}

// Tarifas base de arranque. EZE→Centro reproduce los precios del deck; el resto
// son valores de ejemplo para que las vistas y el wizard tengan con qué trabajar.
export const SEED_TARIFAS_BASE: TarifaBase[] = [
  tarifa(1, "EZE", "Centro", "STD", 22, 35),
  tarifa(2, "EZE", "Centro", "EJE", 40, 60),
  tarifa(3, "EZE", "Centro", "VVIP", 65, 90),
  tarifa(4, "EZE", "Centro", "VAN", 80, 110),
  tarifa(5, "AEP", "Centro", "STD", 15, 25),
  tarifa(6, "AEP", "Centro", "EJE", 28, 45),
  tarifa(7, "AEP", "Centro", "VVIP", 50, 70),
  tarifa(8, "AEP", "Centro", "VAN", 60, 85),
  tarifa(9, "AEP", "EZE", "STD", 30, 48),
  tarifa(10, "AEP", "EZE", "EJE", 52, 78),
  tarifa(11, "AEP", "EZE", "VVIP", 80, 115),
  tarifa(12, "AEP", "EZE", "VAN", 95, 135),
];

// Único set de extras del proveedor (mock).
export const SEED_TARIFAS_EXTRAS: TarifaExtras = {
  proveedorId: "self",
  esperaProveedor: 0.3, // USD/min
  esperaCliente: 0.5,
  horaDispoProveedor: 18, // USD/hora
  horaDispoCliente: 28,
  kmProveedor: 0.8, // USD/km
  kmCliente: 1.2,
};
