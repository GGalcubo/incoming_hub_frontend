import { describe, expect, it } from "vitest";
import type { Trip } from "../../types/domain";
import { EMPTY_TRIP } from "./types";
import { validateTripStep } from "./validation";

function tripWith(patch: Partial<Trip>): Trip {
  return { ...EMPTY_TRIP, ...patch };
}

describe("validateTripStep — paso viaje", () => {
  it("marca los campos obligatorios faltantes", () => {
    const errs = validateTripStep("viaje", EMPTY_TRIP);
    expect(errs.solicitante).toBeDefined();
    expect(errs.time).toBeDefined();
    expect(errs.cat).toBeDefined();
    // EMPTY_TRIP ya trae fecha (TODAY), así que no debe marcarse
    expect(errs.date).toBeUndefined();
  });

  it("marca nombre y apellido por pasajero", () => {
    const errs = validateTripStep("viaje", EMPTY_TRIP);
    expect(errs["pax-0-firstName"]).toBeDefined();
    expect(errs["pax-0-lastName"]).toBeDefined();
  });

  it("no devuelve errores cuando los datos son válidos", () => {
    const trip = tripWith({
      solicitante: "Ana",
      time: "10:00",
      cat: "Ejecutivo",
      passengers: [{ firstName: "Ana", lastName: "Pérez", phone: "+54 11 1234 5678" }],
    });
    expect(validateTripStep("viaje", trip)).toEqual({});
  });

  it("valida el formato de teléfono solo cuando hay valor", () => {
    const base = {
      solicitante: "Ana",
      time: "10:00",
      cat: "Ejecutivo",
    };
    const invalid = tripWith({
      ...base,
      passengers: [{ firstName: "Ana", lastName: "Pérez", phone: "abc" }],
    });
    expect(validateTripStep("viaje", invalid)["pax-0-phone"]).toBeDefined();

    const emptyPhone = tripWith({
      ...base,
      passengers: [{ firstName: "Ana", lastName: "Pérez", phone: "" }],
    });
    expect(validateTripStep("viaje", emptyPhone)["pax-0-phone"]).toBeUndefined();
  });
});

describe("validateTripStep — paso tramos", () => {
  it("exige origen y destino en cada tramo", () => {
    const errs = validateTripStep("tramos", EMPTY_TRIP);
    expect(errs["leg-0-origin"]).toBeDefined();
    expect(errs["leg-0-destination"]).toBeDefined();
  });

  it("pasa cuando todos los tramos tienen origen y destino", () => {
    const trip = tripWith({
      legs: [{ type: "in", origin: "Ezeiza", destination: "Centro", flight: "", obs: "" }],
    });
    expect(validateTripStep("tramos", trip)).toEqual({});
  });
});

describe("validateTripStep — pasos sin validación", () => {
  it("no valida costos/resumen/historial", () => {
    expect(validateTripStep("costos", EMPTY_TRIP)).toEqual({});
    expect(validateTripStep("resumen", EMPTY_TRIP)).toEqual({});
    expect(validateTripStep("historial", EMPTY_TRIP)).toEqual({});
  });
});
