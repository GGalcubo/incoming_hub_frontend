// Parseo del Excel de carga de viajes EN EL BROWSER (SheetJS). Antes esto lo
// hacía el backend (/trips/excel/parse); ahora el archivo se lee acá y se
// reusa el mismo pipeline del wizard para crear los viajes. Cada fila del Excel
// es un VIAJE; los tramos extra se cargan en Destino 2 / Destino 3 (el origen de
// cada tramo es el destino del anterior).
import * as XLSX from "xlsx";
import type { ExcelLeg, ExcelRow, LegType } from "../types/domain";
import { normalizePlace } from "./places";
import { normalizePhone } from "./phone";
import { validateExcelRow } from "./excelValidate";

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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Arma el ISO solo si los tres números son una fecha razonable.
function toISO(y: number, m: number, d: number): string {
  if (!(y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

// Fecha en UNA sola columna. Acepta lo que Excel muestra en una celda de fecha
// ("20/06/2026"), el ISO tipeado a mano ("2026-06-20") y el número de serie de
// Excel por si la celda viene sin formato.
function parseFecha(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return toISO(parseInt(iso[1], 10), parseInt(iso[2], 10), parseInt(iso[3], 10));

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    let d = parseInt(dmy[1], 10);
    let m = parseInt(dmy[2], 10);
    // Por defecto dd/mm/aaaa; si el segundo número no puede ser mes, la planilla
    // vino en mm/dd (Excel en inglés) y se invierte.
    if (m > 12 && d <= 12) [d, m] = [m, d];
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    return toISO(y, m, d);
  }

  // Número de serie de Excel: días desde el 1899-12-30. En UTC para no correrse
  // un día por la zona horaria.
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
    return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return "";
}

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

// Aliases de header → campo lógico (norm() ya quita acentos y baja a minúsculas).
const COLS: Record<string, string[]> = {
  fecha: ["fecha"],
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
  // Fecha: una sola columna ("Fecha"), en el formato que traiga la planilla.
  const fechaText = get("fecha");
  const date = parseFecha(fechaText);

  const time = parseHora(get("hora"));
  const cat = get("cat");

  const tipoText = get("tipo");
  const tipo = parseTipo(tipoText);

  const passengers = get("pax")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  // Teléfonos alineados por posición con los pasajeros (mismo orden, " | ").
  // Se normalizan acá: en el Excel vienen con espacios/guiones y se guardan
  // siempre compactos (solo dígitos y el "+" del prefijo).
  const phones = get("tel").split("|").map(normalizePhone);

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

  // Validación estructural compartida con el modal (fuente única de verdad).
  const { errors, warnings } = validateExcelRow({ date, time, cat, passengers, phones, legs });
  // Si la celda tenía algo pero no se pudo interpretar, se aclara el motivo
  // (validateExcelRow ya marcó el error "Falta la fecha").
  if (!date && fechaText) warnings.push(`Fecha no reconocida: "${fechaText}"`);
  // El tipo se parsea de texto libre; si no se reconoce, el tramo queda "otro".
  if (!tipo) {
    warnings.push(
      tipoText ? `Tipo no reconocido: "${tipoText}" (se usó Otro)` : "Falta el tipo (se usó Otro)",
    );
  }
  if (phones.filter(Boolean).length > passengers.length) {
    warnings.push("Hay más teléfonos que pasajeros");
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
