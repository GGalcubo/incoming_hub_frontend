import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelFile } from "./excelParse";
import { validateExcelRow } from "./excelValidate";
import { normalizePlace } from "./places";

const HEADERS = [
  "Dia", "Mes", "Año", "Hora", "Categoria", "Pasajeros", "Telefono", "Tipo",
  "Origen", "Destino", "Vuelo", "Observaciones", "Destino 2", "Destino 3",
];

// Construye un .xlsx en memoria con la misma estructura que la plantilla y lo
// envuelve en un File-like (parseExcelFile solo usa arrayBuffer()).
function buildFile(rows: (string | number)[][]): File {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Viajes");
  const data = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return { name: "t.xlsx", arrayBuffer: async () => data } as unknown as File;
}

describe("parseExcelFile", () => {
  it("mapea columnas, arma la fecha de 3 campos, el tipo y normaliza el alias", async () => {
    const rows = await parseExcelFile(
      buildFile([
        [20, 6, 2026, "07:30", "Ejecutivo", "JUAN PABLO", "+54 11 5555-1234",
         "Llegada (in)", "EZE", "725 Continental", "AR1234", "", "", ""],
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-06-20");
    expect(rows[0].time).toBe("07:30");
    expect(rows[0].cat).toBe("Ejecutivo");
    expect(rows[0].phones).toEqual(["+54 11 5555-1234"]);
    expect(rows[0].legs[0].type).toBe("in"); // "Llegada (in)" → in
    expect(rows[0].legs[0].origin).toBe("Aeropuerto Ezeiza (EZE)"); // alias EZE
    expect(rows[0].errors).toHaveLength(0);
  });

  it("Destino 2 genera un segundo tramo encadenado (origen = destino anterior)", async () => {
    const rows = await parseExcelFile(
      buildFile([
        [20, 6, 2026, "14:00", "Vito", "M. ROMAGNOLI", "", "Otro",
         "Hotel Faena", "Hotel Alvear", "", "", "San Isidro", ""],
      ]),
    );
    expect(rows[0].legs).toHaveLength(2);
    expect(rows[0].legs[1].origin).toBe("Hotel Alvear");
    expect(rows[0].legs[1].destination).toBe("San Isidro");
  });

  it("alinea varios teléfonos con los pasajeros por posición", async () => {
    const rows = await parseExcelFile(
      buildFile([
        [20, 6, 2026, "10:00", "Auto Std", "M. ROJO | N. FABBRI",
         "+54 11 4490 7781 | +54 11 6033 2210", "Salida (out)",
         "Santos Dumont 3429", "Aeropuerto Ezeiza (EZE)", "AR1256", "", "", ""],
      ]),
    );
    expect(rows[0].passengers).toEqual(["M. ROJO", "N. FABBRI"]);
    expect(rows[0].phones).toEqual(["+54 11 4490 7781", "+54 11 6033 2210"]);
  });

  it("marca errores en filas incompletas", async () => {
    const rows = await parseExcelFile(
      buildFile([
        [20, 6, 2026, "", "Ejecutivo", "X", "", "", "Recoleta", "Centro", "", "", "", ""],
      ]),
    );
    expect(rows[0].errors.length).toBeGreaterThan(0); // falta hora + tipo
  });
});

describe("validateExcelRow", () => {
  const base = {
    date: "2026-06-20",
    time: "07:30",
    cat: "Ejecutivo",
    passengers: ["Juan Perez"],
    phones: ["+54 11 5555-1234"],
    legs: [{ origin: "Recoleta", destination: "Centro", type: "out" as const }],
  };

  it("una fila completa no tiene errores", () => {
    expect(validateExcelRow(base).errors).toHaveLength(0);
  });

  it("marca errores cuando faltan fecha/hora/categoría o el tramo está incompleto", () => {
    expect(validateExcelRow({ ...base, time: "" }).errors).toContain("Falta la hora");
    expect(validateExcelRow({ ...base, date: "" }).errors).toContain("Falta la fecha");
    expect(validateExcelRow({ ...base, cat: "" }).errors).toContain("Falta la categoría");
    const incompleto = validateExcelRow({
      ...base,
      legs: [{ origin: "Recoleta", destination: "", type: "otro" as const }],
    });
    expect(incompleto.errors).toContain("Tramo 1 incompleto");
  });

  it("avisa (no error) si no hay pasajero o el teléfono es dudoso", () => {
    const sinPax = validateExcelRow({ ...base, passengers: [] });
    expect(sinPax.errors).toHaveLength(0);
    expect(sinPax.warnings).toContain("Sin pasajero");
    expect(validateExcelRow({ ...base, phones: ["123"] }).warnings.length).toBeGreaterThan(0);
  });
});

describe("normalizePlace", () => {
  it("resuelve alias comunes a su nombre canónico", () => {
    expect(normalizePlace("EZE")).toBe("Aeropuerto Ezeiza (EZE)");
    expect(normalizePlace("aeroparque")).toBe("Aeroparque Jorge Newbery (AEP)");
    // No pisa direcciones reales que no son alias exactos.
    expect(normalizePlace("Av. Ezeiza 123")).toBe("Av. Ezeiza 123");
  });
});
