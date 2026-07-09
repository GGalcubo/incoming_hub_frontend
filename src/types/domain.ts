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
  espera: number;
  peajes: number;
  estacionamiento: number;
  otros: number;
  // Moneda de los montos. Las tarifas nuevas trabajan en USD ("Los costos son en
  // dólares"); los viajes viejos sincronizados desde Central quedan sin moneda
  // (se muestran como estaban).
  moneda?: string;
  // Costo del proveedor para el tramo base (u$s). Se guarda aparte de `viaje`
  // (que es el precio al cliente) para no exponerlo nunca al cliente.
  tarifaProveedor?: number;
}

// Metadata del paso "Tarifa" (solo frontend: no se envía al backend). Guarda la
// ruta y modalidad elegidas para poder reconstruir la selección al reabrir.
export interface TripTarifa {
  origen?: string;
  destino?: string;
  categoria?: string; // código de VehicleCategoria (STD/EJE/VVIP/VAN)
  modalidad?: "traslado" | "horas";
  horas?: number;
}

export interface HistoryEntry {
  ts: string;
  user: string;
  action: string;
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
