import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TarifaOpcion } from "../../../api/client";
import type { Trip } from "../../../types/domain";
import { EMPTY_TRIP } from "../types";
import { StepTarifa } from "./StepTarifa";

// El paso solo habla con la API y con el perfil logueado: los mockeamos para
// poder manejar a mano qué tarifas devuelve cada ruta.
const cotizarRuta = vi.fn();

vi.mock("../../../hooks/useMe", () => ({
  useMe: () => ({
    me: undefined,
    role: "admin",
    isAdmin: true,
    isProvider: false,
    isAgency: false,
    proveedorId: null,
    loading: false,
  }),
}));

vi.mock("../../../api/client", () => ({
  api: {
    listLugaresRuta: () => Promise.resolve(["AEP", "CENTRO", "EZE"]),
    getTarifasExtras: () => Promise.resolve(null),
    rutaDeTarifa: () => Promise.resolve(null),
    cotizarRuta: (...args: unknown[]) => cotizarRuta(...args),
  },
}));

function op(patch: Partial<TarifaOpcion>): TarifaOpcion {
  return {
    tarifaId: 1,
    proveedorId: "p1",
    proveedorNombre: "Prov 1",
    codigo: "STD",
    nombre: "Sedán",
    vehiculo: "Corolla",
    precioCliente: 100,
    precioProveedor: 70,
    moneda: "USD",
    ...patch,
  };
}

// Viaje con una tarifa YA elegida: EZE → CENTRO, categoría STD a 100.
const TRIP_CON_TARIFA: Trip = {
  ...EMPTY_TRIP,
  cat: "Sedán",
  proveedorId: "p1",
  tarifa: {
    origen: "EZE",
    destino: "CENTRO",
    categoria: "STD",
    tarifaId: 1,
    modalidad: "traslado",
  },
  costs: { ...EMPTY_TRIP.costs, viaje: 100, peajes: 10, total: 110, moneda: "USD" },
};

// Monta el paso con estado real, y expone el viaje resultante para las aserciones.
function setup(initial: Trip) {
  const seen: { trip: Trip } = { trip: initial };
  function Harness() {
    const [t, setT] = useState(initial);
    seen.trip = t;
    return <StepTarifa t={t} set={(patch) => setT((prev) => ({ ...prev, ...patch }))} errs={{}} />;
  }
  render(<Harness />);
  return seen;
}

describe("StepTarifa — recotización al cambiar la ruta", () => {
  beforeEach(() => {
    cotizarRuta.mockReset();
  });

  // El proyecto corre vitest con `globals: false`, así que el cleanup automático
  // de testing-library no se registra: hay que desmontar a mano.
  afterEach(cleanup);

  it("recalcula el precio de la categoría elegida y trae el tarifaId nuevo", async () => {
    cotizarRuta.mockImplementation((_origen: string, destino: string) =>
      Promise.resolve({
        proveedores: [{ id: "p1", nombre: "Prov 1" }],
        opciones:
          destino === "CENTRO"
            ? [op({ tarifaId: 1, precioCliente: 100, precioProveedor: 70 })]
            : [op({ tarifaId: 2, precioCliente: 150, precioProveedor: 90 })],
        detalle: "",
      }),
    );
    const seen = setup(TRIP_CON_TARIFA);
    await screen.findAllByRole("option", { name: "AEP" });

    await userEvent.selectOptions(screen.getByLabelText(/Destino/), "AEP");

    await waitFor(() => expect(seen.trip.tarifa?.tarifaId).toBe(2));
    // Misma categoría, precio nuevo, y el total rehecho con los peajes ya cargados.
    expect(seen.trip.cat).toBe("Sedán");
    expect(seen.trip.tarifa?.categoria).toBe("STD");
    expect(seen.trip.tarifa?.destino).toBe("AEP");
    expect(seen.trip.costs.viaje).toBe(150);
    expect(seen.trip.costs.tarifaProveedor).toBe(90);
    expect(seen.trip.costs.total).toBe(160);
  });

  it("limpia la selección si la ruta nueva no tiene esa categoría", async () => {
    cotizarRuta.mockImplementation((_origen: string, destino: string) =>
      Promise.resolve({
        proveedores: [{ id: "p1", nombre: "Prov 1" }],
        opciones:
          destino === "CENTRO"
            ? [op({ tarifaId: 1 })]
            : [op({ tarifaId: 3, codigo: "VAN", nombre: "Van", precioCliente: 200 })],
        detalle: "",
      }),
    );
    const seen = setup(TRIP_CON_TARIFA);
    await screen.findAllByRole("option", { name: "AEP" });

    await userEvent.selectOptions(screen.getByLabelText(/Destino/), "AEP");

    await waitFor(() => expect(seen.trip.cat).toBe(""));
    expect(seen.trip.tarifa?.tarifaId).toBeUndefined();
    expect(seen.trip.tarifa?.categoria).toBeUndefined();
    expect(seen.trip.costs.viaje).toBe(0);
    expect(seen.trip.costs.total).toBe(10); // solo los peajes
  });

  it("limpia la selección si la ruta queda incompleta", async () => {
    cotizarRuta.mockResolvedValue({
      proveedores: [{ id: "p1", nombre: "Prov 1" }],
      opciones: [op({ tarifaId: 1 })],
      detalle: "",
    });
    const seen = setup(TRIP_CON_TARIFA);
    await screen.findAllByRole("option", { name: "AEP" });

    await userEvent.selectOptions(screen.getByLabelText(/Destino/), "");

    await waitFor(() => expect(seen.trip.cat).toBe(""));
    expect(seen.trip.tarifa?.tarifaId).toBeUndefined();
    expect(seen.trip.costs.viaje).toBe(0);
  });

  it("no pisa la selección con las tarifas de la ruta anterior", async () => {
    // La cotización de la ruta vieja resuelve DESPUÉS que la de la nueva.
    const resolvers: Array<() => void> = [];
    cotizarRuta.mockImplementation(
      (_origen: string, destino: string) =>
        new Promise((resolve) => {
          const payload = {
            proveedores: [{ id: "p1", nombre: "Prov 1" }],
            opciones: [
              destino === "CENTRO"
                ? op({ tarifaId: 1, precioCliente: 100 })
                : op({ tarifaId: 2, precioCliente: 150 }),
            ],
            detalle: "",
          };
          resolvers.push(() => resolve(payload));
        }),
    );
    const seen = setup(TRIP_CON_TARIFA);
    await screen.findAllByRole("option", { name: "AEP" });
    await waitFor(() => expect(resolvers.length).toBe(1)); // cotización inicial (CENTRO)

    await userEvent.selectOptions(screen.getByLabelText(/Destino/), "AEP");
    await waitFor(() => expect(resolvers.length).toBe(2)); // cotización de AEP
    resolvers[1]!(); // llega primero la nueva
    await waitFor(() => expect(seen.trip.costs.viaje).toBe(150));
    resolvers[0]!(); // y después la vieja, que ya no debe aplicarse

    await new Promise((r) => setTimeout(r, 20));
    expect(seen.trip.costs.viaje).toBe(150);
    expect(seen.trip.tarifa?.tarifaId).toBe(2);
  });

  it("mantiene el precio anterior mientras la nueva cotización está en vuelo", async () => {
    let resolveSegunda: (() => void) | null = null;
    cotizarRuta.mockImplementation(
      (_origen: string, destino: string) =>
        new Promise((resolve) => {
          const payload = {
            proveedores: [{ id: "p1", nombre: "Prov 1" }],
            opciones: [op({ tarifaId: 2, precioCliente: 150 })],
            detalle: "",
          };
          if (destino === "CENTRO") resolve({ ...payload, opciones: [op({ tarifaId: 1 })] });
          else resolveSegunda = () => resolve(payload);
        }),
    );
    const seen = setup(TRIP_CON_TARIFA);
    await screen.findAllByRole("option", { name: "AEP" });

    await userEvent.selectOptions(screen.getByLabelText(/Destino/), "AEP");
    await waitFor(() => expect(resolveSegunda).not.toBeNull());

    // Todavía sin respuesta: la tarifa vieja sigue puesta (el viaje nunca queda
    // sin tarifa a mitad de camino).
    expect(seen.trip.cat).toBe("Sedán");
    expect(seen.trip.costs.viaje).toBe(100);
    expect(seen.trip.tarifa?.tarifaId).toBe(1);

    resolveSegunda!();
    await waitFor(() => expect(seen.trip.costs.viaje).toBe(150));
  });
});
