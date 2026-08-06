// Modelo de dominio de las TARIFAS (frontend). Es el contrato que consumen las
// vistas: api/tarifasCrud.ts lo traduce desde el tarifario del backend
// (/tarifarios/tarifas/).
//
// IMPORTANTE: todos los montos están en DÓLARES (USD). El deck lo pide explícito
// ("Los costos son en dólares").

// Categoría de vehículo que se ofrece en el paso "Tarifa" del wizard. El precio
// NO vive acá: sale de la tarifa base para la ruta elegida.
export interface VehicleCategoria {
  codigo: string; // identificador estable (STD, EJE, VVIP, VAN)
  nombre: string; // etiqueta visible (STANDARD, EJECUTIVO, …)
  vehiculo: string; // modelo de referencia ("Fiat Cronos (o similar)")
  orden: number;
}

// Un proveedor de traslados. Cada uno tiene SU tarifario (tarifas base + extras)
// y solo puede tocar el propio. El `id` es la clave de scoping en toda la app: es
// el id del proveedor en el backend (ver api/proveedores.ts).
export interface Proveedor {
  id: string;
  nombre: string;
}

// Una tarifa base: precio de un traslado punto-a-punto para una categoría de
// vehículo. `tarifaProveedor` es lo que cobra el proveedor; `tarifaCliente` es lo
// que se le factura al cliente (NUNCA visible para el rol proveedor).
export interface TarifaBase {
  id: string;
  // Dueño de la tarifa: cada proveedor tiene su propio tarifario y solo puede
  // crear/editar/borrar las suyas.
  proveedorId: string;
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
// proveedor": es un único registro POR PROVEEDOR (clave `proveedorId`).
//
// Las dos columnas viven en el proveedor del backend
// (/tarifarios/proveedores/{id}/): `valor_*` es lo que cobra el proveedor y
// `valor_*_cliente` lo que se le factura al cliente (NUNCA visible para el rol
// proveedor). Ver api/tarifasCrud.ts.
export interface TarifaExtras {
  proveedorId: string;
  // OJO: por MINUTO acá; el backend lo guarda por HORA (`valor_espera`). La
  // conversión está en MINUTOS_POR_HORA, en api/tarifasCrud.ts.
  esperaProveedor: number; // USD por minuto
  esperaCliente: number; // USD por minuto
  horaDispoProveedor: number; // USD por hora de disponibilidad
  horaDispoCliente: number;
  kmProveedor: number; // USD por km adicional
  kmCliente: number;
}

// ── Tarifario de CLIENTE ─────────────────────────────────────────────────────
// NO hay una tarifa por cliente: el backend modela una sola tarifa por
// (proveedor, ruta, categoría) con las dos columnas de precio adentro, así que
// "lo que se le factura al cliente" es `TarifaBase.tarifaCliente`, y los extras
// del lado cliente son las columnas `*Cliente` de TarifaExtras.
