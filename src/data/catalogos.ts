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

// ── Rango de fechas de la lista ───────────────────────────────────────────────
//
// La lista se mira por DÍA o por un RANGO de días. Un solo día es el rango
// degenerado `from === to`, así que hay un único concepto para todo (el filtro,
// el título, el export) en vez de dos estados que puedan contradecirse.

/** Rango de fechas (YYYY-MM-DD), los dos extremos incluidos. */
export interface DateRange {
  from: string;
  to: string;
}

/**
 * Tope de días que se pueden pedir de una. El backend no lo impone: es del
 * front, porque un rango abierto se pagina de a 20 y bajarlo entero son
 * decenas de llamadas.
 */
export const MAX_RANGE_DAYS = 31;

const MS_DAY = 86400000;

/** "YYYY-MM-DD" → Date local (mediodía, para que el DST no corra el día). */
function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Corre una fecha `n` días (n puede ser negativo). */
export function addDays(date: string, n: number): string {
  return fmt(new Date(parseDay(date).getTime() + n * MS_DAY));
}

/** Cuántos días abarca el rango, contando los dos extremos: un día es 1. */
export function rangeDays(r: DateRange): number {
  const diff = parseDay(r.to).getTime() - parseDay(r.from).getTime();
  return Math.round(diff / MS_DAY) + 1;
}

export function isSingleDay(r: DateRange): boolean {
  return r.from === r.to;
}

/** El rango de un solo día. */
export function dayRange(date: string): DateRange {
  return { from: date, to: date };
}

/**
 * Deja el rango en algo pedible: ordena los extremos si vienen al revés y lo
 * recorta a `MAX_RANGE_DAYS` moviendo el extremo que NO se acaba de tocar.
 * `anchor` dice cuál se tocó, para recortar del otro lado.
 */
export function clampRange(r: DateRange, anchor: "from" | "to" = "from"): DateRange {
  const [from, to] = r.from <= r.to ? [r.from, r.to] : [r.to, r.from];
  if (rangeDays({ from, to }) <= MAX_RANGE_DAYS) return { from, to };
  return anchor === "from"
    ? { from, to: addDays(from, MAX_RANGE_DAYS - 1) }
    : { from: addDays(to, -(MAX_RANGE_DAYS - 1)), to };
}

/** El mes calendario de una fecha. Un mes nunca pasa de `MAX_RANGE_DAYS`. */
export function monthRange(date: string): DateRange {
  const d = parseDay(date);
  return {
    from: fmt(new Date(d.getFullYear(), d.getMonth(), 1, 12)),
    to: fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)),
  };
}
