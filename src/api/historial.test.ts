import { describe, expect, it } from "vitest";
import type { HistorialEntrada } from "./backend";
import { entradaToHistoryEntry, filtrarPorVista } from "./historial";
import type { HistoryEntry } from "../types/domain";

const USUARIOS = new Map([[7, "Ana Pérez"]]);

function entrada(patch: Partial<HistorialEntrada> = {}): HistorialEntrada {
  return {
    modelo: "Viaje",
    objeto_id: 42,
    accion: "update",
    fecha: "2026-07-30T14:03:11Z",
    usuario: 7,
    cambios: {},
    ...patch,
  };
}

describe("historial: entrada del backend → HistoryEntry", () => {
  it("traduce acción y modelo, y resuelve el nombre del autor", () => {
    const e = entradaToHistoryEntry(entrada(), USUARIOS);
    expect(e.action).toBe("Modificación de viaje");
    expect(e.user).toBe("Ana Pérez");
  });

  it("cae a 'Usuario #id' si el autor no está en el padrón", () => {
    expect(entradaToHistoryEntry(entrada({ usuario: 99 }), USUARIOS).user).toBe("Usuario #99");
  });

  it("un cambio sin usuario es del sistema (no vino de un request)", () => {
    expect(entradaToHistoryEntry(entrada({ usuario: null }), USUARIOS).user).toBe("Sistema");
  });

  it("arma el diff con etiquetas en castellano", () => {
    const e = entradaToHistoryEntry(
      entrada({
        modelo: "CostoViaje",
        cambios: { costo_espera_proveedor: ["0", "1500"] },
      }),
      USUARIOS,
    );
    expect(e.action).toBe("Modificación de costos");
    expect(e.changes).toEqual([
      { field: "Espera (proveedor)", from: "0", to: "1500" },
    ]);
  });

  it("esconde los campos de ruido (id, FK al viaje y timestamps)", () => {
    const e = entradaToHistoryEntry(
      entrada({
        cambios: {
          id: [null, 42],
          viaje: [null, 42],
          updated_at: ["2026-07-30T14:00:00Z", "2026-07-30T14:03:11Z"],
          unidad_asignada: ["", "PROXY-08"],
        },
      }),
      USUARIOS,
    );
    expect(e.changes).toEqual([{ field: "Unidad asignada", from: "—", to: "PROXY-08" }]);
  });

  it("en un alta el valor suelto queda del lado del 'después'", () => {
    const e = entradaToHistoryEntry(
      entrada({ accion: "insert", cambios: { estado: 1, puede_modificar: true } }),
      USUARIOS,
    );
    expect(e.action).toBe("Alta de viaje");
    expect(e.changes).toEqual([
      { field: "Estado", from: "—", to: "1" },
      { field: "Se puede modificar", from: "—", to: "Sí" },
    ]);
  });

  it("en una baja el valor suelto queda del lado del 'antes'", () => {
    const e = entradaToHistoryEntry(
      entrada({ modelo: "Tramo", accion: "delete", cambios: { destino_direccion: "Tigre" } }),
      USUARIOS,
    );
    expect(e.action).toBe("Baja de tramo");
    expect(e.changes).toEqual([{ field: "Destino", from: "Tigre", to: "—" }]);
  });

  it("no inventa nombres para modelos ni acciones desconocidos", () => {
    const e = entradaToHistoryEntry(entrada({ modelo: "OtraCosa", accion: "merge" }), USUARIOS);
    expect(e.action).toBe("merge · OtraCosa");
  });

  it("un campo que no cambió no aparece en el diff", () => {
    const e = entradaToHistoryEntry(
      entrada({ cambios: { observaciones: ["igual", "igual"] } }),
      USUARIOS,
    );
    expect(e.changes).toBeUndefined();
  });
});

describe("historial: recorte por rol", () => {
  const viaje: HistoryEntry = {
    ts: "30/07/2026 14:03",
    user: "Ana Pérez",
    action: "Modificación de viaje",
    changes: [{ field: "Estado", from: "1", to: "2" }],
  };
  const costos: HistoryEntry = {
    ts: "30/07/2026 15:10",
    user: "Ana Pérez",
    action: "Modificación de costos",
    changes: [
      { field: "Viaje (cliente)", from: "32000", to: "35000" },
      { field: "Viaje (proveedor)", from: "24000", to: "26000" },
      { field: "Horas a disposición", from: "2", to: "3" },
    ],
  };
  const historia = [costos, viaje];

  it("el admin ve la auditoría entera, sin tocar nada", () => {
    expect(filtrarPorVista(historia, "todo")).toBe(historia);
  });

  it("la agencia ve solo los costos de cliente", () => {
    const out = filtrarPorVista(historia, "cliente");
    expect(out).toHaveLength(1);
    expect(out[0].changes).toEqual([
      { field: "Viaje (cliente)", from: "32000", to: "35000" },
      { field: "Horas a disposición", from: "2", to: "3" },
    ]);
  });

  it("el proveedor ve solo los costos de proveedor", () => {
    const out = filtrarPorVista(historia, "proveedor");
    expect(out).toHaveLength(1);
    expect(out[0].changes).toEqual([
      { field: "Viaje (proveedor)", from: "24000", to: "26000" },
      { field: "Horas a disposición", from: "2", to: "3" },
    ]);
  });

  it("una entrada de costos que quedó sin campos propios no se muestra", () => {
    const soloAjeno: HistoryEntry = {
      ...costos,
      changes: [{ field: "Total (proveedor)", from: "24000", to: "26000" }],
    };
    expect(filtrarPorVista([soloAjeno], "cliente")).toEqual([]);
  });

  it("no filtra por rol el historial que ya venía recortado", () => {
    expect(filtrarPorVista([viaje], "proveedor")).toEqual([]);
  });

  it("reconoce el lado de un campo de costo que el backend agregue después", () => {
    const nuevo: HistoryEntry = {
      ...costos,
      // Campo fuera de CAMPO_LABEL: llega prolijado ("recargo_nocturno_cliente").
      changes: [
        { field: "Recargo nocturno cliente", from: "0", to: "500" },
        { field: "Recargo nocturno proveedor", from: "0", to: "400" },
      ],
    };
    expect(filtrarPorVista([nuevo], "proveedor")[0].changes).toEqual([
      { field: "Recargo nocturno proveedor", from: "0", to: "400" },
    ]);
  });
});
