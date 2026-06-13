// Parseo de la plantilla de viajes (.xlsx) en el frontend.
// Convención de columnas (ver scripts/make_plantilla.py):
//   Viaje | Fecha | Hora | Categoria | Pasajeros | Telefonos? | Tipo | Origen | Destino | Vuelo | Observaciones
//   - Una fila por TRAMO. Las filas del mismo viaje comparten el ID de "Viaje".
//   - La primera fila de cada viaje lleva Fecha/Hora/Categoria/Pasajeros.
//   - Pasajeros (y Telefonos) múltiples separados por " | ", alineados por posición.
//   - Tipo: in | out | otro | disposicion.
import type { ExcelLeg, ExcelRow, LegType } from "../types/domain";

// Normaliza un encabezado: minúsculas, sin tildes ni espacios sobrantes.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function findCol(header: string[], names: string[]): number {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

const cell = (row: unknown[], i: number): string =>
  i >= 0 && i < row.length ? String(row[i] ?? "").trim() : "";

function normType(raw: string): LegType {
  const t = norm(raw);
  if (t === "in" || t === "llegada") return "in";
  if (t === "out" || t === "salida") return "out";
  if (t === "disposicion" || t === "hds" || t === "hs disposicion") return "disposicion";
  return "otro";
}

// Devuelve la fecha en formato YYYY-MM-DD y un aviso si tuvo que convertirla.
function normDate(raw: string): { date: string; warn: string[] } {
  if (!raw) return { date: "", warn: [] };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: raw, warn: [] };
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return { date: iso, warn: ["Fecha convertida a AAAA-MM-DD"] };
  }
  return { date: raw, warn: [] };
}

// Devuelve la hora en formato HH:MM (24h) y un aviso si venía en 12h.
function normTime(raw: string): { time: string; warn: string[] } {
  if (!raw) return { time: "", warn: [] };
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const min = ampm[2];
    const isPm = ampm[3].toLowerCase() === "pm";
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return { time: `${String(h).padStart(2, "0")}:${min}`, warn: ["Hora en formato 12h"] };
  }
  const hm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return { time: `${hm[1].padStart(2, "0")}:${hm[2]}`, warn: [] };
  return { time: raw, warn: [] };
}

function parsePassengers(namesRaw: string, phonesRaw: string) {
  const names = namesRaw.split("|").map((s) => s.trim()).filter(Boolean);
  const phones = phonesRaw.split("|").map((s) => s.trim());
  return names.map((name, i) => ({ name, phone: phones[i] ?? "" }));
}

// Recalcula errores/avisos de una fila según sus campos (regla: teléfono obligatorio).
export function validateExcelRow(r: ExcelRow): ExcelRow {
  const errors: string[] = [];
  // Conservamos avisos de conversión (fecha/hora) y recomputamos el resto.
  const keep = r.warnings.filter((w) => /convertida|12h/.test(w));

  if (!r.date) errors.push("Falta fecha");
  if (!r.time) errors.push("Falta hora");
  const named = r.passengers.filter((p) => p.name.trim());
  if (named.length === 0) errors.push("Falta pasajero");
  else if (named.some((p) => !p.phone.trim())) errors.push("Falta teléfono de pasajero");
  if (r.legs.length === 0) errors.push("Falta tramo");
  else r.legs.forEach((l, i) => {
    if (!l.origin.trim() || !l.destination.trim()) errors.push(`Tramo ${i + 1} incompleto`);
  });
  const extra = r.legs.length > 2 ? [`Viaje con ${r.legs.length} tramos`] : [];

  return { ...r, errors, warnings: [...keep, ...extra] };
}

// Parsea las filas crudas de la hoja (array de arrays) en viajes (ExcelRow[]).
export function parseSheet(aoa: unknown[][]): ExcelRow[] {
  if (aoa.length < 2) return [];
  const header = (aoa[0] ?? []).map((c) => norm(String(c ?? "")));
  const idx = {
    viaje: findCol(header, ["viaje", "viaje id", "id viaje"]),
    fecha: findCol(header, ["fecha"]),
    hora: findCol(header, ["hora"]),
    cat: findCol(header, ["categoria", "categoria servicio"]),
    pax: findCol(header, ["pasajeros", "pasajero"]),
    tel: findCol(header, ["telefonos", "telefono", "telefonos pasajeros", "tel"]),
    tipo: findCol(header, ["tipo", "tipo servicio"]),
    ori: findCol(header, ["origen"]),
    dst: findCol(header, ["destino"]),
    vuelo: findCol(header, ["vuelo", "datos vuelo"]),
    obs: findCol(header, ["observaciones", "obs"]),
  };

  const out: ExcelRow[] = [];
  let current: ExcelRow | null = null;
  let currentRef = "";

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    if (row.every((c) => String(c ?? "").trim() === "")) continue;

    const ref = cell(row, idx.viaje);
    const ori = cell(row, idx.ori);
    const dst = cell(row, idx.dst);
    const vuelo = cell(row, idx.vuelo);
    const tipo = normType(cell(row, idx.tipo));

    const startsNew = current === null || (!!ref && ref !== currentRef);
    if (startsNew) {
      const { date, warn: dWarn } = normDate(cell(row, idx.fecha));
      const { time, warn: tWarn } = normTime(cell(row, idx.hora));
      current = {
        row: r + 1,
        tripRef: ref,
        date,
        time,
        cat: cell(row, idx.cat),
        passengers: parsePassengers(cell(row, idx.pax), cell(row, idx.tel)),
        legs: [],
        warnings: [...dWarn, ...tWarn],
        errors: [],
      };
      out.push(current);
      if (ref) currentRef = ref;
    }

    if (current && (ori || dst || vuelo)) {
      const leg: ExcelLeg = { origin: ori, destination: dst, type: tipo };
      if (vuelo) leg.flight = vuelo;
      current.legs.push(leg);
    }
  }

  return out.map(validateExcelRow);
}
