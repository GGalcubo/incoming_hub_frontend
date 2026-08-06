import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../context/ToastContext";
import type { UseMe } from "../../hooks/useMe";
import type { TarifaBase } from "../../types/tarifas";
import { TarifasBase } from "./TarifasBase";

// La tabla es una sola para los tres roles y se recorta por `me`: acá se fija
// qué ve cada lado del mostrador. Solo hablamos con la API, que mockeamos.
const TARIFAS: TarifaBase[] = [
  {
    id: "1",
    proveedorId: "p1",
    origen: "EZE",
    destino: "CABA",
    categoria: "STD",
    tarifaProveedor: 35,
    tarifaCliente: 40,
    activo: true,
  },
  {
    id: "2",
    proveedorId: "p1",
    origen: "AEP",
    destino: "CABA",
    categoria: "STD",
    tarifaProveedor: 20,
    tarifaCliente: 23,
    activo: false,
  },
];

vi.mock("../../api/client", () => ({
  api: {
    listTarifasBase: () => Promise.resolve(TARIFAS),
    listTarifaLugares: () => Promise.resolve(["AEP", "CABA", "EZE"]),
    listProveedores: () => Promise.resolve([{ id: "p1", nombre: "Central LT" }]),
    listCategoriasTarifa: () =>
      Promise.resolve([{ codigo: "STD", nombre: "Auto Std", vehiculo: "", orden: 1 }]),
  },
}));

function me(patch: Partial<UseMe>): UseMe {
  return {
    me: undefined,
    role: "admin",
    isAdmin: false,
    isProvider: false,
    isAgency: false,
    proveedorId: null,
    loading: false,
    ...patch,
  };
}

function renderTabla(perfil: UseMe) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <TarifasBase me={perfil} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("TarifasBase", () => {
  it("al admin le muestra las dos columnas y las acciones", async () => {
    renderTabla(me({ role: "admin", isAdmin: true }));

    await waitFor(() => expect(screen.getByText("u$s 40")).toBeTruthy());
    expect(screen.getByText("u$s 35")).toBeTruthy(); // costo del proveedor
    expect(screen.getAllByTitle("Editar")).toHaveLength(TARIFAS.length);
    // Ve también las tarifas dadas de baja: es quien administra el tarifario.
    expect(screen.getByText("Inactiva")).toBeTruthy();
  });

  it("a la agencia le muestra solo el precio cliente, sin editar ni bajas", async () => {
    renderTabla(me({ role: "agency_staff", isAgency: true }));

    await waitFor(() => expect(screen.getByText("u$s 40")).toBeTruthy());
    // El costo del proveedor no se muestra en ninguna forma.
    expect(screen.queryByText("u$s 35")).toBeNull();
    expect(screen.queryByText("u$s 20")).toBeNull();
    // Solo consulta: ni alta, ni edición, ni borrado.
    expect(screen.queryByText("Nueva tarifa")).toBeNull();
    expect(screen.queryByTitle("Editar")).toBeNull();
    expect(screen.queryByTitle("Eliminar")).toBeNull();
    // Una tarifa inactiva no es un precio vigente: no la ve (ni la columna).
    expect(screen.queryByText("u$s 23")).toBeNull();
    expect(screen.queryByText("Estado")).toBeNull();
  });

  it("al proveedor le oculta el precio al cliente", async () => {
    renderTabla(me({ role: "provider", isProvider: true, proveedorId: "p1" }));

    await waitFor(() => expect(screen.getByText("u$s 35")).toBeTruthy());
    expect(screen.queryByText("u$s 40")).toBeNull();
    // Edita su tarifario, así que la baja sí le importa.
    expect(screen.getAllByTitle("Editar")).toHaveLength(TARIFAS.length);
    expect(screen.getByText("Inactiva")).toBeTruthy();
  });
});
