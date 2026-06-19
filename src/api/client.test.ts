import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./client";

// Sin VITE_API_URL la capa corre en modo mock, así que estos tests no tocan la red.

describe("api (modo mock)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("login devuelve un usuario con token JWT", async () => {
    const user = await api.login("operador@agencia.com", "secreto");
    expect(user.user).toBe("operador@agencia.com");
    expect(user.token.split(".")).toHaveLength(3);
    expect(typeof user.exp).toBe("number");
  });

  it("login rechaza credenciales vacías", async () => {
    await expect(api.login("", "")).rejects.toThrow();
  });

  it("listTrips devuelve una copia del seed", async () => {
    const a = await api.listTrips();
    const b = await api.listTrips();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b); // copia, no la misma referencia
  });

  it("createTrip agrega un viaje con id e estado por defecto", async () => {
    const before = await api.listTrips();
    const created = await api.createTrip({ agc: "Test", obs: "" });
    expect(created.id).toMatch(/^RX-/);
    expect(created.est).toBe("PENDIENTE");
    const after = await api.listTrips();
    expect(after.length).toBe(before.length + 1);
    expect(after[0].id).toBe(created.id);
  });

  it("cancelTrip marca el viaje como CANCELADO con el motivo", async () => {
    const created = await api.createTrip({ agc: "Test", obs: "" });
    const cancelled = await api.cancelTrip(created.id, "pasajero no se presentó");
    expect(cancelled.est).toBe("CANCELADO");
    expect(cancelled.obs).toContain("pasajero no se presentó");
  });

  it("cancelTrip falla si el viaje no existe", async () => {
    await expect(api.cancelTrip("RX-INEXISTENTE", "x")).rejects.toThrow();
  });

  it("importExcelRows crea los viajes seleccionados del Excel", async () => {
    const before = await api.listTrips();
    const res = await api.importExcelRows([
      {
        row: 2,
        tripRef: "",
        date: "2026-06-20",
        time: "07:30",
        cat: "Ejecutivo",
        passengers: ["Juan Perez"],
        phones: ["+54 11 5555-1234"],
        legs: [{ origin: "Recoleta", destination: "Aeropuerto Ezeiza (EZE)", type: "out" }],
        warnings: [],
        errors: [],
      },
    ]);
    expect(res.count).toBe(1);
    expect(res.errors).toHaveLength(0);
    const after = await api.listTrips();
    expect(after.length).toBe(before.length + 1);
  });
});
