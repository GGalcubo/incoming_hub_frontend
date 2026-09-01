import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelFile } from "./excelParse";
import { validateExcelRow } from "./excelValidate";
import { normalizePlace } from "./places";

// Encabezados tal cual vienen en la plantilla "INCOMING HUB | PLANTILLA
// SERVICIOS" (mayúsculas, acentos, PAX, ORÍGEN, DESTINO3 sin espacio).
const HEADERS = [
  "FECHA", "HORA", "CATEGORÍA", "PAX", "TELÉFONO", "TIPO",
  "ORÍGEN", "DESTINO", "VUELO", "OBSERVACIONES", "DESTINO 2", "DESTINO3",
];

// Encabezados de la plantilla anterior (tienen que seguir funcionando).
const OLD_HEADERS = [
  "Fecha", "Hora", "Categoria", "Pasajeros", "Telefono", "Tipo",
  "Origen", "Destino", "Vuelo", "Observaciones", "Destino 2", "Destino 3",
];

type Cell = string | number | Date;

// Construye un .xlsx en memoria con la misma estructura que la plantilla
// (título en la fila 2, encabezados en la fila 4, datos desde la fila 5) y lo
// envuelve en un File-like (parseExcelFile solo usa arrayBuffer()).
function buildFile(rows: Cell[][], headers: Cell[] = HEADERS, withTitle = true): File {
  const aoa: Cell[][] = withTitle
    ? [[], ["INCOMING HUB | PLANTILLA SERVICIOS"], [], headers, ...rows]
    : [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Viajes");
  const data = XLSX.write(wb, { type: "array", bookType: "xlsx", cellDates: true });
  return { name: "t.xlsx", arrayBuffer: async () => data } as unknown as File;
}

// Fecha real de Excel (número de serie): 2026-09-10 = 46275.
const SERIAL_2026_09_10 = 46275;

describe("parseExcelFile", () => {
  it("mapea columnas de la plantilla nueva (título + encabezados en fila 4)", async () => {
    const rows = await parseExcelFile(
      buildFile([
        [SERIAL_2026_09_10, "07:30", "Ejecutivo", "JUAN LÓPEZ", "+54 9 11 5555-1234",
         "Llegada (in)", "AEROPUERTO EZEIZA (EZE)", "725 CONTINENTAL", "AA 909", "", "", ""],
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].row).toBe(5); // primera fila de datos de la plantilla
    expect(rows[0].date).toBe("2026-09-10");
    expect(rows[0].time).toBe("07:30");
    expect(rows[0].cat).toBe("Ejecutivo");
    expect(rows[0].passengers).toEqual(["JUAN LÓPEZ"]);
    // El teléfono se guarda compacto: sin espacios ni guiones.
    expect(rows[0].phones).toEqual(["+5491155551234"]);
    expect(rows[0].legs[0].type).toBe("in"); // "Llegada (in)" → in
    expect(rows[0].legs[0].origin).toBe("Aeropuerto Ezeiza (EZE)"); // alias
    expect(rows[0].legs[0].flight).toBe("AA 909");
    expect(rows[0].errors).toHaveLength(0);
  });

  it("sigue aceptando la plantilla anterior (encabezados en la fila 1)", async () => {
    const rows = await parseExcelFile(
      buildFile(
        [["20/06/2026", "07:30", "Ejecutivo", "JUAN PABLO", "+54 11 5555-1234",
          "Llegada (in)", "EZE", "725 Continental", "AR1234", "", "", ""]],
        OLD_HEADERS,
        false,
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].row).toBe(2);
    expect(rows[0].date).toBe("2026-06-20");
    expect(rows[0].legs[0].origin).toBe("Aeropuerto Ezeiza (EZE)");
  });

  it("una celda de fecha real se lee por su valor, no por cómo se muestra (mm-dd-yy)", async () => {
    // La plantilla muestra las fechas como mm-dd-yy: leída como texto,
    // "09-10-26" se confundiría con el 9 de octubre.
    const ws = XLSX.utils.aoa_to_sheet([
      HEADERS,
      [SERIAL_2026_09_10, "07:30", "Ejecutivo", "X", "+54 9 11 5555-1234",
       "Llegada (in)", "EZE", "Centro", "AR1", "", "", ""],
    ]);
    ws["A2"].z = "mm-dd-yy";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Viajes");
    const data = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const rows = await parseExcelFile(
      { name: "t.xlsx", arrayBuffer: async () => data } as unknown as File,
    );
    expect(rows[0].date).toBe("2026-09-10");
  });

  it("acepta la fecha en varios formatos (dd/mm, ISO, serie y celda Date)", async () => {
    const base = ["07:30", "Ejecutivo", "JUAN PABLO", "+54 11 5555-1234",
      "Llegada (in)", "EZE", "725 Continental", "AR1234", "", "", ""];
    const rows = await parseExcelFile(
      buildFile([
        ["20/6/2026", ...base],
        ["2026-06-20", ...base],
        ["6/20/26", ...base], // texto en inglés (mm/dd/aa)
        [46193, ...base], // número de serie
        [new Date(2026, 5, 20), ...base], // celda de fecha real
      ]),
    );
    expect(rows.map((r) => r.date)).toEqual([
      "2026-06-20", "2026-06-20", "2026-06-20", "2026-06-20", "2026-06-20",
    ]);
  });

  it("acepta la hora como texto o como celda de hora real (fracción de día)", async () => {
    const base = ["Ejecutivo", "JUAN PABLO", "+54 11 5555-1234",
      "Llegada (in)", "EZE", "725 Continental", "AR1234", "", "", ""];
    const rows = await parseExcelFile(
      buildFile([
        [SERIAL_2026_09_10, "07:30", ...base],
        [SERIAL_2026_09_10, "7:30", ...base],
        [SERIAL_2026_09_10, 0.3125, ...base], // 07:30 como fracción
        [SERIAL_2026_09_10, 0.5833333333333334, ...base], // 14:00
      ]),
    );
    expect(rows.map((r) => r.time)).toEqual(["07:30", "07:30", "07:30", "14:00"]);
  });

  it("saltea filas vacías y numera las filas como en Excel", async () => {
    const base = ["07:30", "Ejecutivo", "JUAN PABLO", "+54 11 5555-1234",
      "Llegada (in)", "EZE", "725 Continental", "AR1234", "", "", ""];
    const rows = await parseExcelFile(
      buildFile([
        [SERIAL_2026_09_10, ...base],
        [],
        [],
        [SERIAL_2026_09_10 + 1, ...base],
      ]),
    );
    expect(rows.map((r) => r.row)).toEqual([5, 8]);
  });

  it("Destino 2 genera un segundo tramo encadenado (origen = destino anterior)", async () => {
    const rows = await parseExcelFile(
      buildFile([
        [SERIAL_2026_09_10, "14:00", "Vito", "M. ROMAGNOLI", "", "Otro",
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
        [SERIAL_2026_09_10, "10:00", "Auto Std", "M. ROJO | N. FABBRI",
         "+54 11 4490 7781 | +54 11 6033 2210", "Salida (out)",
         "Santos Dumont 3429", "Aeropuerto Ezeiza (EZE)", "AR1256", "", "", ""],
      ]),
    );
    expect(rows[0].passengers).toEqual(["M. ROJO", "N. FABBRI"]);
    expect(rows[0].phones).toEqual(["+541144907781", "+541160332210"]);
  });

  it("marca errores en filas incompletas", async () => {
    const rows = await parseExcelFile(
      buildFile([
        [SERIAL_2026_09_10, "", "Ejecutivo", "X", "", "", "Recoleta", "Centro", "", "", "", ""],
      ]),
    );
    expect(rows[0].errors.length).toBeGreaterThan(0); // falta hora + tipo
  });

  it("devuelve vacío si no encuentra la fila de encabezados", async () => {
    const rows = await parseExcelFile(
      buildFile([["a", "b", "c"]], ["Uno", "Dos", "Tres"], false),
    );
    expect(rows).toEqual([]);
  });
});

describe("validateExcelRow", () => {
  const base = {
    date: "2026-06-20",
    time: "07:30",
    cat: "Ejecutivo",
    passengers: ["Juan Perez"],
    phones: ["+541155551234"],
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

  it("el teléfono del pasajero es obligatorio (bloquea)", () => {
    const sinTel = validateExcelRow({ ...base, phones: [] });
    expect(sinTel.errors).toContain("Falta teléfono de algún pasajero");
  });
});

describe("normalizePlace", () => {
  it("resuelve alias comunes a su nombre canónico", () => {
    expect(normalizePlace("EZE")).toBe("Aeropuerto Ezeiza (EZE)");
    expect(normalizePlace("aeroparque")).toBe("Aeroparque Jorge Newbery (AEP)");
    // No pisa direcciones reales que no son alias exactos.
    expect(normalizePlace("Av. Ezeiza 123")).toBe("Av. Ezeiza 123");
  });

  it("reconoce el aeropuerto aunque venga con texto extra (terminal, código)", () => {
    expect(normalizePlace("EZE T5")).toBe("Aeropuerto Ezeiza (EZE)");
    expect(normalizePlace("terminal EZE")).toBe("Aeropuerto Ezeiza (EZE)");
    expect(normalizePlace("terminal ezeiza")).toBe("Aeropuerto Ezeiza (EZE)");
    expect(normalizePlace("aeroparque terminal A")).toBe("Aeroparque Jorge Newbery (AEP)");
    // Idempotente: el canónico vuelve a sí mismo.
    expect(normalizePlace("Aeropuerto Ezeiza (EZE)")).toBe("Aeropuerto Ezeiza (EZE)");
  });

  it("no remapea direcciones de calle que mencionan el aeropuerto", () => {
    expect(normalizePlace("Ezeiza 123")).toBe("Ezeiza 123"); // altura → es una calle
    expect(normalizePlace("Calle Aeroparque 500")).toBe("Calle Aeroparque 500");
    expect(normalizePlace("Aeropuerto de Salta")).toBe("Aeropuerto de Salta"); // otro aeropuerto
  });
});
