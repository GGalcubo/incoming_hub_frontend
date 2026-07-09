import { TODAY } from "../../data/seed";
import type { Trip } from "../../types/domain";

export type Mode = "new" | "edit";

export type StepId =
  | "viaje"
  | "pasajeros"
  | "tramos"
  | "tarifa"
  | "costos"
  | "resumen"
  | "historial";

export interface StepDef {
  id: StepId;
  label: string;
}

export interface StepProps {
  t: Trip;
  set: (patch: Partial<Trip>) => void;
  errs: Record<string, string>;
}

export const EMPTY_TRIP: Trip = {
  id: "RX-NEW",
  agc: "",
  solicitante: "",
  date: TODAY,
  time: "",
  cat: "",
  legs: [{ type: "in", origin: "", destination: "", flight: "", obs: "" }],
  passengers: [{ firstName: "", lastName: "", phone: "" }],
  obs: "",
  est: "PENDIENTE",
  costs: { total: 0, viaje: 0, espera: 0, peajes: 0, estacionamiento: 0, otros: 0 },
  history: [],
  pax: 1,
  ori: "",
  dst: "",
  ref: "",
  unit: "",
};
