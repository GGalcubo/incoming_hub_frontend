export type TripStatus =
  | "PENDIENTE"
  | "CONFIRMADO"
  | "EN_CURSO"
  | "FINALIZADO"
  | "CANCELADO"
  | "NO_SHOW"
  | "REPROGRAMADO"
  | "EN_ESPERA";

export type LegType = "in" | "out" | "otro";

export interface Passenger {
  name: string;
  phone: string;
  dni: string;
  luggage: number;
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
  exp?: number;
}

export interface ExcelRow {
  row: number;
  date: string;
  time: string;
  pax: number;
  cat: string;
  agency: string;
  passenger: string;
  origin: string;
  destination: string;
  warnings: string[];
  errors: string[];
}
