import { describe, expect, it } from "vitest";
import {
  MAX_RANGE_DAYS,
  addDays,
  clampRange,
  dayRange,
  isSingleDay,
  monthRange,
  rangeDays,
} from "./catalogos";

describe("addDays", () => {
  it("cruza fin de mes y fin de año", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("cruza un febrero bisiesto", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  // El horario de verano corre el reloj una hora: sumando días sobre la
  // medianoche eso puede caer en el día anterior. Se parsea al mediodía justo
  // para que no pase.
  it("no se corre un día con cambios de hora", () => {
    expect(addDays("2026-10-18", 1)).toBe("2026-10-19");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });
});

describe("rangeDays", () => {
  it("cuenta los dos extremos: un día es 1", () => {
    expect(rangeDays({ from: "2026-08-20", to: "2026-08-20" })).toBe(1);
    expect(rangeDays({ from: "2026-08-20", to: "2026-08-21" })).toBe(2);
    expect(rangeDays({ from: "2026-08-01", to: "2026-08-31" })).toBe(31);
  });
});

describe("clampRange", () => {
  it("deja pasar lo que entra en el tope", () => {
    const r = { from: "2026-08-01", to: "2026-08-31" };
    expect(clampRange(r)).toEqual(r);
  });

  it("recorta del lado que NO se tocó", () => {
    // Se movió "desde": queda fijo y se recorta "hasta".
    expect(clampRange({ from: "2026-08-01", to: "2026-12-31" }, "from")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    // Se movió "hasta": queda fijo y se recorta "desde".
    expect(clampRange({ from: "2026-01-01", to: "2026-08-31" }, "to")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("lo recortado mide exactamente el tope", () => {
    const r = clampRange({ from: "2026-08-01", to: "2027-08-01" }, "from");
    expect(rangeDays(r)).toBe(MAX_RANGE_DAYS);
  });

  it("ordena los extremos si vienen al revés", () => {
    expect(clampRange({ from: "2026-08-31", to: "2026-08-01" })).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });
});

describe("dayRange", () => {
  it("un día es el rango de un día", () => {
    expect(isSingleDay(dayRange("2026-08-20"))).toBe(true);
    expect(isSingleDay({ from: "2026-08-20", to: "2026-08-21" })).toBe(false);
  });
});

describe("monthRange", () => {
  it("va del 1 al último día, y nunca pasa el tope", () => {
    expect(monthRange("2026-08-20")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(monthRange("2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(rangeDays(monthRange("2026-01-15"))).toBeLessThanOrEqual(MAX_RANGE_DAYS);
  });
});
