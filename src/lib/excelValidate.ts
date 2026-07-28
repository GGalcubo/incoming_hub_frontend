// Validación de filas del Excel, SIN dependencias pesadas (no importa SheetJS).
// Vive aparte de excelParse.ts para que el modal pueda importar la validación
// sin arrastrar xlsx al bundle principal (xlsx se carga lazy desde el parser).
import type { ExcelLeg } from "../types/domain";
import { PHONE_RE } from "./phone";

// Valida una fila a partir de sus campos editables. Es la fuente única de verdad
// de la validación: la usa el parser y también el modal cada vez que el usuario
// edita una fila, para que corregir habilite/deshabilite la selección.
export function validateExcelRow(r: {
  date: string;
  time: string;
  cat: string;
  passengers: string[];
  phones?: string[];
  legs: ExcelLeg[];
}): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!r.date) errors.push("Falta la fecha");
  if (!r.time) errors.push("Falta la hora");
  if (!r.cat) errors.push("Falta la categoría");

  const named = r.passengers.filter((p) => p.trim());
  if (named.length === 0) warnings.push("Sin pasajero");
  if (named.length > 4) warnings.push("Más de 4 pasajeros");
  // El teléfono ya viene normalizado (sin espacios ni guiones); acá solo se
  // avisa si igual no parece un número válido.
  (r.phones ?? []).filter(Boolean).forEach((ph) => {
    if (!PHONE_RE.test(ph)) warnings.push(`Teléfono con formato dudoso: ${ph}`);
  });
  // El teléfono de cada pasajero es obligatorio (bloquea la carga si falta).
  if (r.passengers.some((p, i) => p.trim() && !(r.phones?.[i] ?? "").trim())) {
    errors.push("Falta teléfono de algún pasajero");
  }

  if (r.legs.length === 0) {
    errors.push("Falta un tramo");
  } else {
    r.legs.forEach((l, i) => {
      if (!l.origin.trim() || !l.destination.trim()) {
        errors.push(`Tramo ${i + 1} incompleto`);
      }
    });
    const first = r.legs[0];
    if ((first.type === "in" || first.type === "out") && !first.flight?.trim()) {
      warnings.push("Tipo in/out sin número de vuelo");
    }
  }
  if (r.legs.length > 2) warnings.push(`Viaje con ${r.legs.length} tramos`);

  return { errors, warnings };
}
