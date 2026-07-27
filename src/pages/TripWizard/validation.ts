import type { Trip } from "../../types/domain";
import type { StepId } from "./types";

const PHONE_RE = /^[+\d\s-]{8,20}$/;

/** Valida un paso del wizard y devuelve un mapa de errores por campo
 *  (vacío si el paso es válido). Función pura: fácil de testear.
 *  `requireCoords` exige que cada destino esté geocodificado (elegido del
 *  autocompletado de Google Maps): el backend crea los tramos solo con
 *  coordenadas, así que un texto libre sin coords haría fallar el guardado.
 *  Se activa solo cuando hay Maps disponible (si no, no hay forma de geocodificar). */
export function validateTripStep(
  stepId: StepId,
  t: Trip,
  opts: { requireCoords?: boolean } = {},
): Record<string, string> {
  const e: Record<string, string> = {};

  if (stepId === "viaje") {
    if (!t.agc) e.agc = "Seleccioná la agencia";
    if (!t.solicitante) e.solicitante = "Ingresá el solicitante";
    if (!t.date) e.date = "La fecha es obligatoria";
    if (!t.time) e.time = "La hora es obligatoria";
    // La categoría ya no se elige acá: se selecciona en el paso "Tarifa".
  }

  if (stepId === "pasajeros") {
    t.passengers.forEach((px, i) => {
      if (!px.firstName) e[`pax-${i}-firstName`] = "Ingresá el nombre";
      if (!px.lastName) e[`pax-${i}-lastName`] = "Ingresá el apellido";
      if (!px.phone) e[`pax-${i}-phone`] = "Ingresá el teléfono";
      else if (!PHONE_RE.test(px.phone)) e[`pax-${i}-phone`] = "Teléfono inválido";
    });
  }

  if (stepId === "tarifa") {
    // Sin proveedor no hay tarifario del que sacar el precio.
    if (!t.proveedorId) e.proveedor = "Elegí el proveedor del viaje";
    // Hay que elegir una categoría (card). El precio puede ser 0 en modo horas
    // hasta que se cargue la cantidad de horas.
    if (!t.cat) e.cat = "Elegí una categoría";
    if (t.tarifa?.modalidad === "horas" && !(t.tarifa.horas && t.tarifa.horas > 0)) {
      e.horas = "Ingresá las horas a disposición";
    }
  }

  if (stepId === "tramos") {
    const COORD_MSG = "Elegí una opción del listado para fijar la ubicación en el mapa";
    t.legs.forEach((leg, i) => {
      if (!leg.origin) e[`leg-${i}-origin`] = "Origen requerido";
      // El origen solo se edita en el primer destino; en los siguientes se
      // propaga desde el destino anterior (sus coords se validan ahí).
      else if (opts.requireCoords && i === 0 && !leg.originCoords)
        e[`leg-${i}-origin`] = COORD_MSG;
      if (!leg.destination) e[`leg-${i}-destination`] = "Destino requerido";
      else if (opts.requireCoords && !leg.destinationCoords)
        e[`leg-${i}-destination`] = COORD_MSG;
    });
  }

  return e;
}
