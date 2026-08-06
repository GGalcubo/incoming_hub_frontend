import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TarifaOpcion } from "../../../api/client";
import type { Leg, Trip } from "../../../types/domain";
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
    // Catálogo de categorías: es lo que se ofrece cuando la ruta no tiene tarifa.
    listCategoriasTarifa: () =>
      Promise.resolve([
        { codigo: "STD", nombre: "Sedán", vehiculo: "Corolla", orden: 1 },
        { codigo: "VAN", nombre: "Van", vehiculo: "Sprinter", orden: 2 },
      ]),
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

function leg(patch: Partial<Leg> = {}): Leg {
  return {
    type: "in",
    origin: "Aeropuerto de Ezeiza",
    destination: "Av. Corrientes 1000, CABA",
    flight: "",
    obs: "",
    ...patch,
  };
}

// Viaje con una tarifa YA elegida: EZE → CENTRO, categoría STD a 100. Su primer
// destino es esa misma ruta (es de donde salió la cotización).
const TRIP_CON_TARIFA: Trip = {
  ...EMPTY_TRIP,
  cat: "Sedán",
  proveedorId: "p1",
  legs: [leg()],
  tarifa: {
    origen: "EZE",
    destino: "CENTRO",
    categoria: "STD",
    tarifaId: 1,
    modalidad: "traslado",
  },
  costs: { ...EMPTY_TRIP.costs, viaje: 100, peajes: 10, total: 110, moneda: "USD" },
};

// Monta el paso con estado real. Expone el viaje resultante para las aserciones y
// un setter para simular que el usuario cambia el primer destino (paso Destinos).
function setup(initial: Trip) {
  const seen: { trip: Trip; patch: (p: Partial<Trip>) => void } = {
    trip: initial,
    patch: () => {},
  };
  function Harness() {
    const [t, setT] = useState(initial);
    seen.trip = t;
    seen.patch = (patch) => setT((prev) => ({ ...prev, ...patch }));
    return <StepTarifa t={t} set={(patch) => setT((prev) => ({ ...prev, ...patch }))} errs={{}} />;
  }
  render(<Harness />);
  return seen;
}

// Cambia el primer tramo como si el usuario hubiera vuelto al paso Destinos.
async function editarPrimerDestino(seen: { trip: Trip; patch: (p: Partial<Trip>) => void }, patch: Partial<Leg>) {
  await act(async () => {
    seen.patch({ legs: seen.trip.legs.map((l, i) => (i === 0 ? { ...l, ...patch } : l)) });
  });
}

describe("StepTarifa — la cotización sale del primer destino", () => {
  beforeEach(() => {
    cotizarRuta.mockReset();
  });

  // El proyecto corre vitest con `globals: false`, así que el cleanup automático
  // de testing-library no se registra: hay que desmontar a mano.
  afterEach(cleanup);

  it("viaje nuevo: toma la ruta del primer tramo, no del último", async () => {
    cotizarRuta.mockResolvedValue({
      proveedores: [{ id: "p1", nombre: "Prov 1" }],
      opciones: [op({ tarifaId: 1 })],
      detalle: "",
    });
    // Dos tramos: EZE → CABA y CABA → Aeroparque. La cotización es la del primero.
    const seen = setup({
      ...EMPTY_TRIP,
      legs: [
        leg(),
        leg({
          type: "otro",
          origin: "Av. Corrientes 1000, CABA",
          destination: "Aeroparque Jorge Newbery",
        }),
      ],
    });

    await waitFor(() => expect(seen.trip.tarifa?.origen).toBe("EZE"));
    expect(seen.trip.tarifa?.destino).toBe("CENTRO");
  });

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
    await waitFor(() => expect(cotizarRuta).toHaveBeenCalled());

    await editarPrimerDestino(seen, { destination: "Aeroparque Jorge Newbery" });

    await waitFor(() => expect(seen.trip.tarifa?.tarifaId).toBe(2));
    // Misma categoría, precio nuevo, y el total rehecho con los peajes ya cargados.
    expect(seen.trip.cat).toBe("Sedán");
    expect(seen.trip.tarifa?.categoria).toBe("STD");
    expect(seen.trip.tarifa?.destino).toBe("AEP");
    expect(seen.trip.costs.viaje).toBe(150);
    expect(seen.trip.costs.tarifaProveedor).toBe(90);
    expect(seen.trip.costs.total).toBe(160);
  });

  it("si la ruta nueva no cotiza esa categoría, la deja elegida pero sin precio", async () => {
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
    await waitFor(() => expect(cotizarRuta).toHaveBeenCalled());

    await editarPrimerDestino(seen, { destination: "Aeroparque Jorge Newbery" });

    // La categoría sigue elegida (queda a cotizar por el proveedor); lo que se
    // cae es el precio y el id de la tarifa.
    await waitFor(() => expect(seen.trip.costs.viaje).toBe(0));
    expect(seen.trip.cat).toBe("Sedán");
    expect(seen.trip.tarifa?.categoria).toBe("STD");
    expect(seen.trip.tarifa?.tarifaId).toBeUndefined();
    expect(seen.trip.costs.tarifaProveedor).toBeUndefined();
    expect(seen.trip.costs.total).toBe(10); // solo los peajes
  });

  it("deja la categoría sin precio si el primer destino queda vacío", async () => {
    cotizarRuta.mockResolvedValue({
      proveedores: [{ id: "p1", nombre: "Prov 1" }],
      opciones: [op({ tarifaId: 1 })],
      detalle: "",
    });
    const seen = setup(TRIP_CON_TARIFA);
    await waitFor(() => expect(cotizarRuta).toHaveBeenCalled());

    await editarPrimerDestino(seen, { destination: "" });

    await waitFor(() => expect(seen.trip.costs.viaje).toBe(0));
    expect(seen.trip.cat).toBe("Sedán");
    expect(seen.trip.tarifa?.tarifaId).toBeUndefined();
  });

  it("sin tarifas para la ruta, ofrece igual las categorías del catálogo", async () => {
    cotizarRuta.mockResolvedValue({
      proveedores: [],
      opciones: [],
      detalle: "No hay tarifa vigente para el tramo.",
    });
    const seen = setup({ ...EMPTY_TRIP, legs: [leg()] });

    const card = await screen.findByRole("button", { name: /Van/ });
    expect(card.textContent).toContain("Servicio a cotizar por el proveedor");
    expect((card as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      card.click();
    });

    // Se puede avanzar: el viaje queda con la categoría elegida y el costo en 0.
    await waitFor(() => expect(seen.trip.cat).toBe("Van"));
    expect(seen.trip.tarifa?.categoria).toBe("VAN");
    expect(seen.trip.tarifa?.tarifaId).toBeUndefined();
    expect(seen.trip.costs.viaje).toBe(0);
    expect(seen.trip.costs.tarifaProveedor).toBeUndefined();
    // Elegir una categoría sin tarifa no le asigna proveedor al viaje.
    expect(seen.trip.proveedorId).toBeUndefined();
  });

  it("una categoría sin precio dentro de una ruta tarifada también se puede elegir", async () => {
    cotizarRuta.mockResolvedValue({
      proveedores: [{ id: "p1", nombre: "Prov 1" }],
      opciones: [
        op({ tarifaId: 1, precioCliente: 100, precioProveedor: 70 }),
        op({ tarifaId: 4, codigo: "VAN", nombre: "Van", precioCliente: null, precioProveedor: null }),
      ],
      detalle: "",
    });
    const seen = setup({ ...EMPTY_TRIP, legs: [leg()] });

    // Con la cotización ya aplicada (la card de Sedán muestra su precio), la Van
    // sigue ofreciéndose sin precio y se puede elegir igual.
    await screen.findByText("100");
    const card = screen.getByRole("button", { name: /Van/ });
    expect(card.textContent).toContain("Servicio a cotizar por el proveedor");
    expect((card as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      card.click();
    });

    await waitFor(() => expect(seen.trip.cat).toBe("Van"));
    expect(seen.trip.tarifa?.tarifaId).toBe(4);
    expect(seen.trip.costs.viaje).toBe(0);
  });

  it("horas a disposición: cobra horas × tarifa y lo muestra en la card", async () => {
    cotizarRuta.mockResolvedValue({
      proveedores: [{ id: "p1", nombre: "Prov 1" }],
      opciones: [op({ tarifaId: 1, precioCliente: 100, precioProveedor: 70 })],
      detalle: "",
    });
    const seen = setup({
      ...EMPTY_TRIP,
      legs: [leg({ type: "disposicion", hours: 3 })],
    });

    // 3 hs × 100 = 300, y la card muestra el total (no el valor de la hora).
    // Se espera al precio: hasta que llega la cotización la card está "a cotizar".
    await screen.findByText("300");
    const card = screen.getByRole("button", { name: /Sedán/ });
    expect(card.textContent).toContain("3 hs × 100");

    await act(async () => {
      card.click();
    });
    await waitFor(() => expect(seen.trip.costs.viaje).toBe(300));
    expect(seen.trip.tarifa?.modalidad).toBe("horas");
    expect(seen.trip.tarifa?.horas).toBe(3);
    expect(seen.trip.costs.tarifaProveedor).toBe(210);
  });

  it("recotiza al cambiar las horas en el paso Destinos", async () => {
    cotizarRuta.mockResolvedValue({
      proveedores: [{ id: "p1", nombre: "Prov 1" }],
      opciones: [op({ tarifaId: 1, precioCliente: 100, precioProveedor: 70 })],
      detalle: "",
    });
    const seen = setup({
      ...EMPTY_TRIP,
      legs: [leg({ type: "disposicion", hours: 2 })],
    });

    await screen.findByText("200");
    const card = screen.getByRole("button", { name: /Sedán/ });
    await act(async () => {
      card.click();
    });
    await waitFor(() => expect(seen.trip.costs.viaje).toBe(200));

    await editarPrimerDestino(seen, { hours: 5 });

    await waitFor(() => expect(seen.trip.costs.viaje).toBe(500));
    expect(seen.trip.tarifa?.horas).toBe(5);
  });

  // El monto base se puede escribir a mano en el paso Costos (es la única forma
  // de ponerle precio a un viaje que la ruta no cotiza). Lo que lo pisa es todo
  // lo que cambie de qué tarifa se está hablando: elegir otra categoría o cambiar
  // la RUTA. Cambiar solo la modalidad o las horas lo respeta.
  describe("monto cargado a mano", () => {
    const TRIP_MANUAL: Trip = {
      ...TRIP_CON_TARIFA,
      costs: { ...TRIP_CON_TARIFA.costs, viaje: 500, total: 510, viajeManual: true },
    };

    // Decisión del usuario (06/08/2026): "si se cambia la ruta está bien que pise
    // el valor". Antes se conservaba, pero solo mientras no se recargara el viaje
    // (`viajeManual` no se persiste), así que la misma acción daba dos resultados.
    it("recotizar por cambio de ruta pisa el monto con la tarifa nueva", async () => {
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
      const seen = setup(TRIP_MANUAL);
      await waitFor(() => expect(cotizarRuta).toHaveBeenCalled());

      await editarPrimerDestino(seen, { destination: "Aeroparque Jorge Newbery" });

      await waitFor(() => expect(seen.trip.tarifa?.tarifaId).toBe(2));
      expect(seen.trip.costs.viaje).toBe(150);
      expect(seen.trip.costs.tarifaProveedor).toBe(90);
      expect(seen.trip.costs.viajeManual).toBe(false);
    });

    it("elegir una categoría vuelve a tomar el precio del tarifario", async () => {
      cotizarRuta.mockResolvedValue({
        proveedores: [{ id: "p1", nombre: "Prov 1" }],
        opciones: [op({ tarifaId: 1, precioCliente: 100, precioProveedor: 70 })],
        detalle: "",
      });
      const seen = setup(TRIP_MANUAL);
      await screen.findByText("100");

      await act(async () => {
        screen.getByRole("button", { name: /Sedán/ }).click();
      });

      await waitFor(() => expect(seen.trip.costs.viaje).toBe(100));
      expect(seen.trip.costs.tarifaProveedor).toBe(70);
      expect(seen.trip.costs.viajeManual).toBe(false);
    });

    it("se conserva aunque la ruta se quede sin cotizar", async () => {
      cotizarRuta.mockResolvedValue({
        proveedores: [{ id: "p1", nombre: "Prov 1" }],
        opciones: [op({ tarifaId: 1 })],
        detalle: "",
      });
      const seen = setup(TRIP_MANUAL);
      await waitFor(() => expect(cotizarRuta).toHaveBeenCalled());

      await editarPrimerDestino(seen, { destination: "" });

      await waitFor(() => expect(seen.trip.tarifa?.tarifaId).toBeUndefined());
      expect(seen.trip.costs.viaje).toBe(500);
    });
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
    await waitFor(() => expect(resolvers.length).toBe(1)); // cotización inicial (CENTRO)

    await editarPrimerDestino(seen, { destination: "Aeroparque Jorge Newbery" });
    await waitFor(() => expect(resolvers.length).toBe(2)); // cotización de AEP
    await act(async () => {
      resolvers[1]!(); // llega primero la nueva
    });
    await waitFor(() => expect(seen.trip.costs.viaje).toBe(150));
    await act(async () => {
      resolvers[0]!(); // y después la vieja, que ya no debe aplicarse
    });

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
    await waitFor(() => expect(cotizarRuta).toHaveBeenCalled());

    await editarPrimerDestino(seen, { destination: "Aeroparque Jorge Newbery" });
    await waitFor(() => expect(resolveSegunda).not.toBeNull());

    // Todavía sin respuesta: la tarifa vieja sigue puesta (el viaje nunca queda
    // sin tarifa a mitad de camino).
    expect(seen.trip.cat).toBe("Sedán");
    expect(seen.trip.costs.viaje).toBe(100);
    expect(seen.trip.tarifa?.tarifaId).toBe(1);

    await act(async () => {
      resolveSegunda!();
    });
    await waitFor(() => expect(seen.trip.costs.viaje).toBe(150));
  });
});
