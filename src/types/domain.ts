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
}

export interface TripCosts {
  total: number;
  viaje: number;
  espera: number;
  peajes: number;
  estacionamiento: number;
  otros: number;
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
}

export interface ExcelPassenger {
  name: string;
  // Obligatorio: todo pasajero debe tener teléfono.
  phone: string;
}

export interface ExcelRow {
  row: number;
  tripRef: string;
  date: string;
  time: string;
  cat: string;
  passengers: ExcelPassenger[];
  legs: ExcelLeg[];
  warnings: string[];
  errors: string[];
}
