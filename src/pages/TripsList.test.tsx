import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "../types/domain";
import { TODAY, dayRange } from "../data/catalogos";
import { TripsList, defaultSort } from "./TripsList";

const ESTADOS = [{ id: 1, codigo: "PEN", label: "Pendiente", color: "#888", esFinal: false }];

vi.mock("../api/client", () => ({
  api: { listEstados: () => Promise.resolve(ESTADOS) },
}));

function trip(patch: Partial<Trip>): Trip {
  return {
    id: "1",
    numero: "V-1",
    date: TODAY,
    time: "09:00",
    pax: 1,
    cat: "Auto Std",
    ori: "EZE",
    dst: "CABA",
    est: 1,
    agc: "",
    ref: "",
    obs: "",
    unit: "",
    passengers: [],
    legs: [],
    costs: undefined,
    history: [],
    solicitante: "",
    ...patch,
  } as Trip;
}

const RANGO = { from: "2026-08-01", to: "2026-08-31" };

function setup(props: Partial<React.ComponentProps<typeof TripsList>> = {}) {
  const onRangeChange = vi.fn();
  const onSortChange = vi.fn();
  const range = props.range ?? dayRange(TODAY);
  // El catálogo de estados se deja cargado de entrada. Si llegara por la red, al
  // resolver volvería a montar la tabla y cualquier nodo tomado antes quedaría
  // huérfano: el test clickearía un encabezado que ya no está en el documento.
  const qc = new QueryClient();
  qc.setQueryData(["estados"], ESTADOS);
  render(
    <QueryClientProvider client={qc}>
      <TripsList
        trips={[]}
        onOpen={vi.fn()}
        onCopy={vi.fn()}
        onExport={vi.fn()}
        onChangeStatus={vi.fn()}
        estadoFilter={null}
        onEstadoChange={vi.fn()}
        qViaje=""
        onQViajeChange={vi.fn()}
        qPasajero=""
        onQPasajeroChange={vi.fn()}
        range={range}
        onRangeChange={onRangeChange}
        sort={defaultSort(range)}
        onSortChange={onSortChange}
        page={1}
        pages={1}
        count={0}
        onPageChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onRangeChange, onSortChange };
}

afterEach(cleanup);

describe("filtro por rango", () => {
  it("mirando un día el botón ofrece el rango", () => {
    setup();
    expect(screen.getByRole("button", { name: /^Rango$/ })).toBeTruthy();
  });

  it("mirando un rango el botón dice cuántos días son", () => {
    setup({ range: RANGO });
    expect(screen.getByRole("button", { name: /31 días/ })).toBeTruthy();
  });

  it("el rango se aplica recién al confirmar, no al mover una fecha", async () => {
    const user = userEvent.setup();
    const { onRangeChange } = setup();
    await user.click(screen.getByRole("button", { name: /^Rango$/ }));
    await user.click(screen.getByRole("button", { name: "Próx. 7 días" }));
    // Todavía nada: mover el borrador no dispara una carga.
    expect(onRangeChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^Ver$/ }));
    expect(onRangeChange).toHaveBeenCalledWith({ from: TODAY, to: expect.any(String) });
    expect(onRangeChange.mock.calls[0][0].to).not.toBe(TODAY);
  });

  it("cancelar no cambia lo que se está mirando", async () => {
    const user = userEvent.setup();
    const { onRangeChange } = setup();
    await user.click(screen.getByRole("button", { name: /^Rango$/ }));
    await user.click(screen.getByRole("button", { name: "Este mes" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  // El tope es del front: el calendario mismo no deja pasarse.
  it("el calendario de 'Hasta' no deja elegir más allá del tope", async () => {
    const user = userEvent.setup();
    setup({ range: { from: "2026-08-01", to: "2026-08-05" } });
    await user.click(screen.getByRole("button", { name: /5 días/ }));
    const hasta = screen.getByLabelText(/Hasta/);
    expect(hasta.getAttribute("min")).toBe("2026-08-01");
    expect(hasta.getAttribute("max")).toBe("2026-08-31");
  });
});

describe("lo que se muestra de lo cargado", () => {
  it("un viaje fuera del rango no se cuela mientras recarga", () => {
    setup({
      range: RANGO,
      trips: [
        trip({ id: "1", date: "2026-08-10" }),
        trip({ id: "2", date: "2026-09-10" }),
        trip({ id: "3", date: "2026-07-31" }),
      ],
    });
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas).toHaveLength(1);
    expect(within(filas[0]).getByText("10/08")).toBeTruthy();
  });

  it("los dos extremos del rango entran", () => {
    setup({
      range: RANGO,
      trips: [trip({ id: "1", date: "2026-08-01" }), trip({ id: "2", date: "2026-08-31" })],
    });
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2);
  });
});

describe("orden de columnas", () => {
  it("con un día suelto se puede ordenar por cualquier columna", async () => {
    const user = userEvent.setup();
    const { onSortChange } = setup();
    await user.click(screen.getByText("Origen"));
    expect(onSortChange).toHaveBeenCalledWith({ key: "ori", dir: "asc" });
  });

  // Con un rango el orden lo hace el servidor: ordenar por una columna que él no
  // sabe ordenaría solo la página cargada, que se ve igual pero está mal.
  it("con un rango, una columna que el backend no ordena no hace nada", async () => {
    const user = userEvent.setup();
    const { onSortChange } = setup({ range: RANGO });
    await user.click(screen.getByText("Origen"));
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("con un rango, las que el backend sí ordena siguen andando", async () => {
    const user = userEvent.setup();
    const { onSortChange } = setup({ range: RANGO });
    await user.click(screen.getByText("Hora"));
    expect(onSortChange).toHaveBeenCalledWith({ key: "time", dir: "asc" });
  });
});
