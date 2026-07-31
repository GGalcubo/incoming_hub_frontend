// Modelo de dominio de las TARIFAS (frontend). Es el contrato que consumen las
// vistas: api/tarifasCrud.ts lo traduce desde el tarifario real del backend
// (/tarifarios/tarifas/) y api/tarifas.ts lo sirve desde localStorage cuando no
// hay backend configurado.
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

// Un proveedor de traslados. Cada uno tiene SU tarifario (tarifas base + extras)
// y solo puede tocar el propio. El `id` es la clave de scoping en toda la app:
// con backend es el id del proveedor; en modo mock, el username del usuario
// proveedor (ver api/proveedores.ts).
export interface Proveedor {
  id: string;
  nombre: string;
}

// Un cliente: la agencia a la que se le factura. A diferencia del proveedor, no
// sale de un seed propio: son las agencias que ya expone el backend (/agencies/).
// El `id` es el NOMBRE de la agencia porque es la única clave con la que el resto
// del front la referencia (`Trip.agc`) y es estable contra el mock y el backend.
export interface Cliente {
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
// ⚠️ MITAD Y MITAD contra el backend: los `*Proveedor` son reales (salen del
// propio proveedor, /tarifarios/proveedores/{id}/) y los `*Cliente` NO existen
// allá — se guardan en localStorage. api/client.ts (getTarifasExtras) devuelve
// el set combinado.
export interface TarifaExtras {
  proveedorId: string;
  // OJO: por MINUTO acá; el backend lo guarda por HORA (`valor_espera`). La
  // conversión está en MINUTOS_POR_HORA, en api/tarifasCrud.ts.
  esperaProveedor: number; // USD por minuto
  esperaCliente: number; // ⚠️ mock
  horaDispoProveedor: number; // USD por hora de disponibilidad
  horaDispoCliente: number; // ⚠️ mock
  kmProveedor: number; // USD por km adicional
  kmCliente: number; // ⚠️ mock
}

// ── Tarifario de CLIENTE ─────────────────────────────────────────────────────
// NO hay una tarifa por cliente: el backend modela una sola tarifa por
// (proveedor, ruta, categoría) con las dos columnas de precio adentro, así que
// "lo que se le factura al cliente" es `TarifaBase.tarifaCliente`.
//
// Extras del tarifario de cliente. Solo puede existir un set por cliente (clave
// `clienteId`).
//
// ⚠️ MOCK COMPLETO, en cualquier modo: el backend modela los extras del
// proveedor pero no tiene nada equivalente por cliente. Ver api/tarifasCliente.ts.
export interface TarifaClienteExtras {
  clienteId: string;
  espera: number; // USD por minuto
  horaDispo: number; // USD por hora de disponibilidad
  km: number; // USD por km adicional
}

// Una categoría con su precio ya resuelto para una ruta concreta (lo que consume
// el paso "Tarifa"). `null` cuando no hay tarifa activa para esa combinación.
export interface CategoriaTarifada extends VehicleCategoria {
  origen: string;
  destino: string;
  tarifaProveedor: number | null;
  tarifaCliente: number | null;
}
