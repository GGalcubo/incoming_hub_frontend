// Modelo de dominio de las TARIFAS (frontend). Como el backend todavía no expone
// endpoints de tarifas, estos tipos son el contrato que el front necesita; la
// capa de API (api/tarifas.ts) los sirve desde un mock en localStorage y, cuando
// el backend publique las rutas, se traducirá igual que en api/viajes.ts.
//
// IMPORTANTE: todos los montos están en DÓLARES (USD). El deck lo pide explícito
// ("Los costos son en dólares").

// Categoría de vehículo que se ofrece en el paso "Tarifa" del wizard. El precio
// NO vive acá: sale de la tarifa base para la ruta elegida (ver CategoriaTarifada).
export interface VehicleCategoria {
  codigo: string; // identificador estable (STD, EJE, VVIP, VAN)
  nombre: string; // etiqueta visible (STANDARD, EJECUTIVO, …)
  vehiculo: string; // modelo de referencia ("Fiat Cronos (o similar)")
  orden: number;
}

// Una tarifa base: precio de un traslado punto-a-punto para una categoría de
// vehículo. `tarifaProveedor` es lo que cobra el proveedor; `tarifaCliente` es lo
// que se le factura al cliente (NUNCA visible para el rol proveedor).
export interface TarifaBase {
  id: string;
  origen: string;
  destino: string;
  categoria: string; // VehicleCategoria.codigo
  tarifaProveedor: number; // USD
  tarifaCliente: number; // USD
  activo: boolean;
}

// Cuerpo escribible al crear/editar una tarifa base (sin id).
export type TarifaBaseInput = Omit<TarifaBase, "id">;

// Set de tarifas de EXTRAS. El deck aclara "solo puede existir un set por
// proveedor": es un único registro por proveedor, no una lista.
export interface TarifaExtras {
  proveedorId: string;
  esperaProveedor: number; // USD por minuto
  esperaCliente: number;
  horaDispoProveedor: number; // USD por hora de disponibilidad
  horaDispoCliente: number;
  kmProveedor: number; // USD por km adicional
  kmCliente: number;
}

// Una categoría con su precio ya resuelto para una ruta concreta (lo que consume
// el paso "Tarifa"). `null` cuando no hay tarifa activa para esa combinación.
export interface CategoriaTarifada extends VehicleCategoria {
  origen: string;
  destino: string;
  tarifaProveedor: number | null;
  tarifaCliente: number | null;
}
