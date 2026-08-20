import { beforeEach, describe, expect, it, vi } from "vitest";

// `listTrips` se prueba por lo que le PIDE al backend: los filtros de fecha son
// el contrato con /viajes/ y un parámetro mal armado no se ve hasta producción.
const request = vi.fn();
vi.mock("./http", () => ({
  request: (...args: unknown[]) => request(...args),
  fetchAll: vi.fn(async () => []),
  drfErrorMessage: (e: unknown) => String(e),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

const { listTrips } = await import("./viajes");

// La primera página vacía alcanza: acá interesa la URL, no el mapeo.
const VACIO = { count: 0, next: null, previous: null, results: [] };

/** Los query params del GET /viajes/ que disparó la llamada. */
async function paramsDe(q: Parameters<typeof listTrips>[0]): Promise<URLSearchParams> {
  await listTrips(q);
  const url = request.mock.calls.map((c) => String(c[0])).find((u) => u.startsWith("/viajes/?"));
  return new URLSearchParams(url!.slice("/viajes/?".length));
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(VACIO);
});

describe("listTrips: filtro de fechas", () => {
  it("un solo día va por `fecha_servicio`, que es el filtro de siempre", async () => {
    const p = await paramsDe({ from: "2026-08-20", to: "2026-08-20" });
    expect(p.get("fecha_servicio")).toBe("2026-08-20");
    expect(p.get("fecha_servicio__gte")).toBeNull();
    expect(p.get("fecha_servicio__lte")).toBeNull();
  });

  it("un rango va por gte/lte, con los dos extremos incluidos", async () => {
    const p = await paramsDe({ from: "2026-08-01", to: "2026-08-31" });
    expect(p.get("fecha_servicio__gte")).toBe("2026-08-01");
    expect(p.get("fecha_servicio__lte")).toBe("2026-08-31");
    expect(p.get("fecha_servicio")).toBeNull();
  });

  it("manda el `ordering` que le pasan", async () => {
    const p = await paramsDe({
      from: "2026-08-01",
      to: "2026-08-31",
      ordering: "fecha_servicio,hora_servicio",
    });
    expect(p.get("ordering")).toBe("fecha_servicio,hora_servicio");
  });

  it("sin `ordering` no lo manda: el backend usa el suyo", async () => {
    const p = await paramsDe({ from: "2026-08-20", to: "2026-08-20" });
    expect(p.has("ordering")).toBe(false);
  });

  it("los filtros de la grilla siguen viajando con el rango", async () => {
    const p = await paramsDe({
      from: "2026-08-01",
      to: "2026-08-31",
      page: 2,
      estado: 9,
      qViaje: "AR-12",
      qPasajero: "perez",
    });
    expect(p.get("page")).toBe("2");
    expect(p.get("estado")).toBe("9");
    expect(p.get("search")).toBe("AR-12");
    expect(p.get("pasajeros__persona__nombre__icontains")).toBe("perez");
  });
});
