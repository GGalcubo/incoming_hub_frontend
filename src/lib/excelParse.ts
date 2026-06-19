// Parseo del Excel de carga de viajes EN EL BROWSER (SheetJS). Antes esto lo
// hacía el backend (/trips/excel/parse); ahora el archivo se lee acá y se
// reusa el mismo pipeline del wizard para crear los viajes. Cada fila del Excel
// es un VIAJE; los tramos extra se cargan en Destino 2 / Destino 3 (el origen de
// cada tramo es el destino del anterior).
import * as XLSX from "xlsx";
import type { ExcelLeg, ExcelRow, LegType } from "../types/domain";
import { normalizePlace } from "./places";

const PHONE_RE = /^[+\d\s-]{8,20}$/;

// Normaliza texto para comparar headers/valores: sin acentos, minúsculas, sin
// espacios redundantes.
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Tolera tanto los labels del desplegable ("Llegada (in)") como códigos sueltos
// ("IN", "out", "DISPO", "disposicion").
function parseTipo(raw: string): LegType | null {
  const s = norm(raw);
  if (!s) return null;
  if (s.includes("dispo")) return "disposicion";
  if (s.includes("llegada") || /\bin\b/.test(s)) return "in";
  if (s.includes("salida") || /\bout\b/.test(s)) return "out";
  if (s.includes("otro")) return "otro";
  return null;
}

const TIPO_CON_VUELO = new Set<LegType>(["in", "out"]);

// Acepta "07:30", "7:30" o una fracción de día de Excel (por las dudas) → "HH:MM".
function parseHora(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const h = Math.min(23, parseInt(m[1], 10));
    return `${String(h).padStart(2, "0")}:${m[2]}`;
  }
  const n = Number(s);
  if (Number.isFinite(n) && n > 0 && n < 1) {
    const mins = Math.round(n * 24 * 60);
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
  return "";
}

// Aliases de header → campo lógico (norm() ya quita acentos, así "Año" → "ano").
const COLS: Record<string, string[]> = {
  dia: ["dia"],
  mes: ["mes"],
  anio: ["ano", "anio"],
  hora: ["hora"],
  cat: ["categoria"],
  pax: ["pasajeros"],
  tel: ["telefono", "telefonos", "tel pasajero", "tel"],
  tipo: ["tipo"],
  origen: ["origen"],
  destino: ["destino"],
  vuelo: ["vuelo"],
  obs: ["observaciones"],
  destino2: ["destino 2", "destino2"],
  destino3: ["destino 3", "destino3"],
};

function buildHeaderMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const key = norm(h);
    for (const [field, names] of Object.entries(COLS)) {
      if (names.includes(key)) map[field] = i;
    }
  });
  return map;
}

function parseRow(get: (field: string) => string, rowNum: number): ExcelRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Fecha: Dia / Mes / Año (numéricos).
  const d = parseInt(get("dia"), 10);
  const m = parseInt(get("mes"), 10);
  const y = parseInt(get("anio"), 10);
  let date = "";
  if (
    Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) &&
    d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000
  ) {
    date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  } else {
    errors.push("Fecha incompleta o inválida (Dia/Mes/Año)");
  }

  const time = parseHora(get("hora"));
  if (!time) errors.push("Falta la hora");

  const cat = get("cat");
  if (!cat) errors.push("Falta la categoría");

  const tipo = parseTipo(get("tipo"));
  if (!tipo) errors.push("Tipo inválido (Llegada/Salida/Otro/Hs Disposición)");

  const passengers = get("pax")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (passengers.length === 0) warnings.push("Sin pasajero");
  if (passengers.length > 4) warnings.push("Más de 4 pasajeros");

  // Teléfonos alineados por posición con los pasajeros (mismo orden, " | ").
  const phones = get("tel").split("|").map((s) => s.trim());
  const phonesPresentes = phones.filter(Boolean);
  phonesPresentes.forEach((ph) => {
    if (!PHONE_RE.test(ph)) warnings.push(`Teléfono con formato dudoso: ${ph}`);
  });
  if (phonesPresentes.length > passengers.length) {
    warnings.push("Hay más teléfonos que pasajeros");
  }

  // Tramos: Origen→Destino (tipo de la fila), luego →Destino2, →Destino3 (otro).
  const origen = normalizePlace(get("origen"));
  const destino = normalizePlace(get("destino"));
  const destino2 = normalizePlace(get("destino2"));
  const destino3 = normalizePlace(get("destino3"));
  const flight = get("vuelo").trim();

  const legs: ExcelLeg[] = [];
  if (origen || destino) {
    legs.push({
      origin: origen,
      destination: destino,
      type: tipo ?? "otro",
      ...(flight ? { flight } : {}),
    });
  }
  if (destino2) legs.push({ origin: destino, destination: destino2, type: "otro" });
  if (destino3) legs.push({ origin: destino2, destination: destino3, type: "otro" });

  if (!origen) errors.push("Falta el origen");
  if (!destino) errors.push("Falta el destino");
  if (tipo && TIPO_CON_VUELO.has(tipo) && !flight) {
    warnings.push("Tipo in/out sin número de vuelo");
  }

  return {
    row: rowNum,
    rows: [rowNum],
    tripRef: "",
    date,
    time,
    cat,
    passengers,
    phones,
    obs: get("obs").trim(),
    legs,
    warnings,
    errors,
  };
}

export async function parseExcelFile(file: File): Promise<ExcelRow[]> {
  const buf = await file.arrayBuffer();
  // SheetJS con type:"array" espera un Uint8Array, no un ArrayBuffer crudo.
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  // Hoja "Viajes" o, si no está, la primera.
  const sheetName =
    wb.SheetNames.find((n) => norm(n) === "viajes") ?? wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) return [];

  // raw:false formatea las celdas según su formato (horas → "07:30", etc.).
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    blankrows: false,
  });
  if (matrix.length < 2) return [];

  const hmap = buildHeaderMap(matrix[0]);
  const fields = Object.keys(hmap);
  const out: ExcelRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i];
    const get = (field: string): string => {
      const idx = hmap[field];
      return idx == null ? "" : String(cells[idx] ?? "").trim();
    };
    // Saltea filas totalmente vacías.
    if (fields.every((f) => !get(f))) continue;
    // matrix[0] es el header (fila 1 de Excel); matrix[i] es la fila i+1.
    out.push(parseRow(get, i + 1));
  }
  return out;
}
