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
    // La categoría ya no se valida acá: se eligió mover al paso "tarifa".
    expect(errs.cat).toBeUndefined();
    // EMPTY_TRIP ya trae fecha (TODAY), así que no debe marcarse
    expect(errs.date).toBeUndefined();
  });

  it("no valida pasajeros en este paso", () => {
    const errs = validateTripStep("viaje", EMPTY_TRIP);
    expect(errs["pax-0-firstName"]).toBeUndefined();
    expect(errs["pax-0-lastName"]).toBeUndefined();
  });

  it("no devuelve errores cuando los datos son válidos", () => {
    const trip = tripWith({
      agc: "Travel BA",
      solicitante: "Ana",
      time: "10:00",
      cat: "Ejecutivo",
    });
    expect(validateTripStep("viaje", trip)).toEqual({});
  });

  it("marca la agencia faltante", () => {
    expect(validateTripStep("viaje", EMPTY_TRIP).agc).toBeDefined();
  });
});

describe("validateTripStep — paso tarifa", () => {
  it("exige elegir una categoría", () => {
    expect(validateTripStep("tarifa", EMPTY_TRIP).cat).toBeDefined();
  });

  it("no marca error con una categoría elegida en modo traslado", () => {
    const trip = tripWith({ cat: "STANDARD", tarifa: { modalidad: "traslado" } });
    expect(validateTripStep("tarifa", trip)).toEqual({});
  });

  it("en modo horas exige la cantidad de horas", () => {
    const trip = tripWith({ cat: "VAN", tarifa: { modalidad: "horas" } });
    expect(validateTripStep("tarifa", trip).horas).toBeDefined();
    const ok = tripWith({ cat: "VAN", tarifa: { modalidad: "horas", horas: 3 } });
    expect(validateTripStep("tarifa", ok)).toEqual({});
  });
});

describe("validateTripStep — paso pasajeros", () => {
  it("marca nombre y apellido por pasajero", () => {
    const errs = validateTripStep("pasajeros", EMPTY_TRIP);
    expect(errs["pax-0-firstName"]).toBeDefined();
    expect(errs["pax-0-lastName"]).toBeDefined();
  });

  it("no devuelve errores cuando los pasajeros son válidos", () => {
    const trip = tripWith({
      passengers: [{ firstName: "Ana", lastName: "Pérez", phone: "+54 11 1234 5678" }],
    });
    expect(validateTripStep("pasajeros", trip)).toEqual({});
  });

  it("exige el teléfono y valida su formato", () => {
    const invalid = tripWith({
      passengers: [{ firstName: "Ana", lastName: "Pérez", phone: "abc" }],
    });
    expect(validateTripStep("pasajeros", invalid)["pax-0-phone"]).toBeDefined();

    const emptyPhone = tripWith({
      passengers: [{ firstName: "Ana", lastName: "Pérez", phone: "" }],
    });
    expect(validateTripStep("pasajeros", emptyPhone)["pax-0-phone"]).toBeDefined();
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

  it("sin requireCoords no exige geocodificar (texto libre válido)", () => {
    const trip = tripWith({
      legs: [{ type: "in", origin: "Ezeiza", destination: "Centro", flight: "", obs: "" }],
    });
    expect(validateTripStep("tramos", trip, { requireCoords: true })["leg-0-origin"]).toBeDefined();
    expect(validateTripStep("tramos", trip, {})).toEqual({});
  });

  it("con requireCoords exige coords en origen y destino", () => {
    const trip = tripWith({
      legs: [{ type: "in", origin: "Ezeiza", destination: "Centro", flight: "", obs: "" }],
    });
    const errs = validateTripStep("tramos", trip, { requireCoords: true });
    expect(errs["leg-0-origin"]).toBeDefined();
    expect(errs["leg-0-destination"]).toBeDefined();
  });

  it("con requireCoords pasa cuando los destinos están geocodificados", () => {
    const trip = tripWith({
      legs: [
        {
          type: "in",
          origin: "Ezeiza",
          destination: "Centro",
          flight: "",
          obs: "",
          originCoords: { lat: -34.81, lng: -58.53 },
          destinationCoords: { lat: -34.6, lng: -58.38 },
        },
      ],
    });
    expect(validateTripStep("tramos", trip, { requireCoords: true })).toEqual({});
  });

  it("con requireCoords no exige coords de origen en destinos posteriores", () => {
    // El origen del 2º tramo se propaga del destino del 1º; solo se validan las
    // coords del destino de cada tramo y del origen del primero.
    const trip = tripWith({
      legs: [
        {
          type: "in",
          origin: "Ezeiza",
          destination: "Centro",
          flight: "",
          obs: "",
          originCoords: { lat: -34.81, lng: -58.53 },
          destinationCoords: { lat: -34.6, lng: -58.38 },
        },
        {
          type: "otro",
          origin: "Centro",
          destination: "Hotel",
          flight: "",
          obs: "",
          destinationCoords: { lat: -34.59, lng: -58.39 },
        },
      ],
    });
    expect(validateTripStep("tramos", trip, { requireCoords: true })).toEqual({});
  });
});

describe("validateTripStep — pasos sin validación", () => {
  it("no valida costos/resumen/historial", () => {
    expect(validateTripStep("costos", EMPTY_TRIP)).toEqual({});
    expect(validateTripStep("resumen", EMPTY_TRIP)).toEqual({});
    expect(validateTripStep("historial", EMPTY_TRIP)).toEqual({});
  });
});
