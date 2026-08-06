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
    expect(a.trips.length).toBeGreaterThan(0);
    expect(a.trips).not.toBe(b.trips); // copia, no la misma referencia
  });

  // La lista se pide por día y por página (contra el backend eso lo resuelve el
  // servidor; acá, el mock).
  it("listTrips pagina y filtra por fecha", async () => {
    const todos = await api.listTrips();
    expect(todos.page).toBe(1);
    expect(todos.trips.length).toBeLessThanOrEqual(todos.count);
    // Una página más allá del final viene vacía, pero el total no cambia.
    const lejos = await api.listTrips({ page: todos.pages + 5 });
    expect(lejos.trips).toHaveLength(0);
    expect(lejos.count).toBe(todos.count);

    const fecha = todos.trips[0]!.date;
    const delDia = await api.listTrips({ date: fecha });
    expect(delDia.trips.length).toBeGreaterThan(0);
    expect(delDia.trips.every((t) => t.date === fecha)).toBe(true);
    expect(delDia.count).toBe(await api.countTrips(fecha));
  });

  it("createTrip agrega un viaje con id e estado por defecto", async () => {
    const before = await api.listTrips();
    const created = await api.createTrip({ agc: "Test", obs: "" });
    expect(created.id).toMatch(/^RX-/);
    expect(created.est).toBe("PENDIENTE");
    const after = await api.listTrips();
    expect(after.count).toBe(before.count + 1);
    expect(after.trips[0].id).toBe(created.id);
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
    expect(after.count).toBe(before.count + 1);
  });
});
