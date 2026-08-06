export type TripStatus =
  | "PENDIENTE"
  | "CONFIRMADO"
  | "EN_CURSO"
  | "FINALIZADO"
  | "CANCELADO"
  | "NO_SHOW"
  | "REPROGRAMADO"
  | "MODIFICADO"
  | "EN_ESPERA";

export type LegType = "in" | "out" | "otro" | "disposicion";

export interface Passenger {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Leg {
  type: LegType;
  origin: string;
  destination: string;
  flight: string;
  obs: string;
  originCoords?: LatLng;
  destinationCoords?: LatLng;
  hours?: number;
  // Texto del lugar tal como lo desglosa el autocomplete de Google: nombre del
  // lugar (main_text) y dirección (secondary_text), por separado. `origin`/
  // `destination` guardan la descripción completa que se muestra en el input;
  // estos guardan las partes para mandarlas al backend como lugar_nombre/
  // direccion. Vacíos cuando el punto se marcó a mano o en el mapa.
  originName?: string;
  originAddress?: string;
  destinationName?: string;
  destinationAddress?: string;
}

export interface TripCosts {
  total: number;
  viaje: number;
  // Monto de espera al CLIENTE. No se carga a mano: sale de `esperaMin` por el
  // valor/minuto de la tarifa de extras (esperaCliente).
  espera: number;
  peajes: number;
  estacionamiento: number;
  otros: number;
  // Minutos de espera cargados por el proveedor. La unidad mínima es 15 min, así
  // que siempre es múltiplo de 15 (15, 30, 45, 60, 75, 90, …).
  esperaMin?: number;
  // Monto de espera al PROVEEDOR (esperaMin × esperaProveedor). Se guarda aparte
  // de `espera` (el del cliente) para no exponerle nunca el precio de venta.
  esperaProveedor?: number;
  // Moneda de los montos. Las tarifas nuevas trabajan en USD ("Los costos son en
  // dólares"); los viajes viejos sincronizados desde Central quedan sin moneda
  // (se muestran como estaban).
  moneda?: string;
  // Costo del proveedor para el tramo base (u$s). Se guarda aparte de `viaje`
  // (que es el precio al cliente) para no exponerlo nunca al cliente.
  tarifaProveedor?: number;
  // El monto base (`viaje`/`tarifaProveedor`) lo escribió una persona en el paso
  // Costos, no la cotización. Mientras esté en true, el paso Cotización NO lo
  // pisa con el precio del tarifario: solo vuelve a calcularlo si se elige una
  // categoría (que es cambiar de tarifa a propósito). Es de sesión: no se
  // persiste, así que al reabrir el viaje el monto guardado es el que manda.
  viajeManual?: boolean;
  // Extras del lado PROVEEDOR: lo que el proveedor cobra por cada rubro, contra
  // los campos de arriba (`peajes`, `estacionamiento`, `otros`), que son lo que
  // se le factura al cliente. Van en columnas separadas porque cada rol ve (y
  // edita) solo la suya.
  peajesProveedor?: number;
  estacionamientoProveedor?: number;
  otrosProveedor?: number;
  // Total de la columna proveedor (base + extras del proveedor). `total` es el
  // de la columna cliente, que es el único que viaja al backend.
  totalProveedor?: number;
}

// Comentario de un viaje. Lo puede dejar cualquier rol y lo ven todos: es el
// canal para discutir diferencias de costos sin salir del viaje.
export interface TripComentario {
  id: string;
  autor: string;
  // Rol del autor al momento de comentar ("admin" | "provider" | "agency_*").
  // Se guarda para poder mostrar de qué lado del mostrador vino el comentario.
  rol: string | null;
  texto: string;
  // ISO 8601.
  fecha: string;
}

// Selección del paso "Tarifa". `tarifaId` es lo único que viaja al backend: se
// manda en el tramo del viaje y es lo que define su costo (el backend crea el
// registro de costos con la base de esa tarifa). El resto es la ruta y modalidad
// elegidas, para poder reconstruir la selección al reabrir el viaje.
export interface TripTarifa {
  // Id de la tarifa del backend (/tarifarios/tarifas/).
  tarifaId?: number;
  origen?: string;
  destino?: string;
  categoria?: string; // código de VehicleCategoria (STD/EJE/VVIP/VAN)
  modalidad?: "traslado" | "horas";
  horas?: number;
}

// Un campo que cambió dentro de una entrada del historial. `from` queda vacío en
// un alta y `to` en una baja.
export interface HistoryChange {
  field: string;
  from: string;
  to: string;
}

export interface HistoryEntry {
  // Fecha y hora ya formateadas para mostrar (el historial no se ordena ni se
  // filtra en el front: viene armado del backend, del más reciente al más viejo).
  ts: string;
  user: string;
  action: string;
  // Diff del cambio, campo por campo.
  changes?: HistoryChange[];
}

export interface Trip {
  id: string;
  numero?: string;
  date: string;
  time: string;
  pax: number;
  cat: string;
  ori: string;
  dst: string;
  est: TripStatus;
  agc: string;
  ref: string;
  obs: string;
  unit: string;
  passengers: Passenger[];
  legs: Leg[];
  costs: TripCosts;
  history: HistoryEntry[];
  solicitante?: string;
  tarifa?: TripTarifa;
  // Proveedor que presta el servicio. Define de qué tarifario salen los precios
  // y quién puede editar los costos del viaje. Es el id del proveedor del viaje
  // en el backend (`viaje.proveedor`).
  proveedorId?: string;
}

export interface StatusMeta {
  id: TripStatus;
  label: string;
}

export interface User {
  user: string;
  token: string;
  refresh?: string;
  exp?: number;
}

export interface ExcelLeg {
  origin: string;
  destination: string;
  flight?: string;
  type?: LegType;
  // Resultado del geocoding (Google) para mostrar en la pre-carga y crear el
  // viaje con coordenadas. `*Resolved` es el formatted_address COMPLETO (sin
  // acortar), para que el operador confirme qué entendió Google.
  originCoords?: LatLng;
  destinationCoords?: LatLng;
  originResolved?: string;
  destinationResolved?: string;
}

export interface ExcelRow {
  row: number;
  // Filas de Excel que componen el viaje. En multi-tramo (formato de filas
  // repetidas) trae todas; si el backend no lo envía, se usa [row] como fallback.
  rows?: number[];
  tripRef: string;
  date: string;
  time: string;
  cat: string;
  passengers: string[];
  // Teléfonos alineados por posición con `passengers` (columna Telefono del
  // Excel: varios separados con " | " en el mismo orden que los pasajeros).
  phones?: string[];
  // Observaciones libres (columna Observaciones).
  obs?: string;
  legs: ExcelLeg[];
  warnings: string[];
  errors: string[];
}
