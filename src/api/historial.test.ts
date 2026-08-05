import { describe, expect, it } from "vitest";
import type { HistorialEntrada } from "./backend";
import { entradaToHistoryEntry } from "./historial";

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
