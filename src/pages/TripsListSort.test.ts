import { describe, expect, it } from "vitest";
import { canSort, defaultSort, orderingParam } from "./TripsList";

const DIA = { from: "2026-08-20", to: "2026-08-20" };
const RANGO = { from: "2026-08-01", to: "2026-08-31" };

describe("canSort", () => {
  // Un día entra en una página, así que ordenarlo en el navegador ordena el
  // resultado entero: valen las once columnas.
  it("con un día suelto se puede ordenar por cualquier columna", () => {
    for (const k of ["id", "date", "time", "est", "ori", "pasajero", "obs"] as const) {
      expect(canSort(k, DIA)).toBe(true);
    }
  });

  // Un rango no entra: lo ordena el servidor, y solo por lo que él sabe.
  it("con un rango solo las que ordena el backend", () => {
    expect(canSort("id", RANGO)).toBe(true);
    expect(canSort("date", RANGO)).toBe(true);
    expect(canSort("time", RANGO)).toBe(true);
    expect(canSort("est", RANGO)).toBe(true);
    for (const k of ["ori", "dst", "pasajero", "cat", "unit", "obs"] as const) {
      expect(canSort(k, RANGO)).toBe(false);
    }
  });
});

describe("orderingParam", () => {
  it("un día no le pide orden al servidor: ordena el navegador", () => {
    expect(orderingParam({ key: "time", dir: "asc" }, DIA)).toBeUndefined();
    expect(orderingParam({ key: "ori", dir: "desc" }, DIA)).toBeUndefined();
  });

  it("por fecha pide fecha Y hora: si no, las horas de cada día quedan sueltas", () => {
    expect(orderingParam({ key: "date", dir: "asc" }, RANGO)).toBe("fecha_servicio,hora_servicio");
  });

  it("descendente invierte TODOS los campos, no solo el primero", () => {
    expect(orderingParam({ key: "date", dir: "desc" }, RANGO)).toBe(
      "-fecha_servicio,-hora_servicio",
    );
    expect(orderingParam({ key: "est", dir: "desc" }, RANGO)).toBe("-estado");
  });

  // No puede quedar sin `ordering`: el backend contestaría en su orden y la
  // tabla mostraría días salteados página por página.
  it("una columna que el backend no ordena cae en el cronológico", () => {
    expect(orderingParam({ key: "ori", dir: "asc" }, RANGO)).toBe("fecha_servicio,hora_servicio");
  });
});

describe("defaultSort", () => {
  it("por hora dentro de un día, cronológico en un rango", () => {
    expect(defaultSort(DIA)).toEqual({ key: "time", dir: "asc" });
    expect(defaultSort(RANGO)).toEqual({ key: "date", dir: "asc" });
  });

  it("el orden por defecto siempre es uno que se puede usar", () => {
    expect(canSort(defaultSort(RANGO).key, RANGO)).toBe(true);
  });
});
