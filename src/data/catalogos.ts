// Helpers de fecha para los atajos "Hoy / Mañana" de la lista de viajes.
//
// Acá vivía además un catálogo de estados propio del front (`STATUSES`). Se
// eliminó: los estados salen de `GET /estados/` (ver api/viajes → listEstados y
// hooks/useEstados). El mapeo que traducía esos nueve nombres a los ids 1–9 del
// backend estaba MAL — el front creía que el 5 era "Cancelado" y allá es "En
// Progreso" —, así que la lista mostraba estados que no eran.

const today = new Date();
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const TODAY = fmt(today);
export const TOMORROW = fmt(new Date(today.getTime() + 86400000));
