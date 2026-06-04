import type { Trip } from "../../types/domain";
import type { StepId } from "./types";

const PHONE_RE = /^[+\d\s-]{8,20}$/;

/** Valida un paso del wizard y devuelve un mapa de errores por campo
 *  (vacío si el paso es válido). Función pura: fácil de testear. */
export function validateTripStep(stepId: StepId, t: Trip): Record<string, string> {
  const e: Record<string, string> = {};

  if (stepId === "viaje") {
    if (!t.solicitante) e.solicitante = "Ingresá el solicitante";
    if (!t.date) e.date = "La fecha es obligatoria";
    if (!t.time) e.time = "La hora es obligatoria";
    if (!t.cat) e.cat = "La categoría es obligatoria";
  }

  if (stepId === "pasajeros") {
    t.passengers.forEach((px, i) => {
      if (!px.firstName) e[`pax-${i}-firstName`] = "Ingresá el nombre";
      if (!px.lastName) e[`pax-${i}-lastName`] = "Ingresá el apellido";
      if (px.phone && !PHONE_RE.test(px.phone)) e[`pax-${i}-phone`] = "Teléfono inválido";
    });
  }

  if (stepId === "tramos") {
    t.legs.forEach((leg, i) => {
      if (!leg.origin) e[`leg-${i}-origin`] = "Origen requerido";
      if (!leg.destination) e[`leg-${i}-destination`] = "Destino requerido";
    });
  }

  return e;
}
