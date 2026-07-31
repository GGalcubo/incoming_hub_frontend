import { describe, expect, it } from "vitest";
import type { CostoViaje, Tramo, Viaje } from "./backend";
import { viajeToTrip, type Catalogs } from "./viajes";

const CATALOGS: Catalogs = { agencies: [], categorias: [], solicitantes: [] };

function costo(patch: Partial<CostoViaje> = {}): CostoViaje {
  return {
    id: 1,
    viaje: 1,
    costo_viaje_proveedor: "70",
    costo_espera_proveedor: "0",
    costo_peajes_proveedor: "0",
    costo_estacionamiento_proveedor: "0",
    costo_otros_proveedor: "0",
    costo_total_proveedor: "70",
    moneda_proveedor: "USD",
    costo_viaje_cliente: "100",
    costo_espera_cliente: "0",
    costo_peajes_cliente: "10",
    costo_estacionamiento_cliente: "0",
    costo_otros_cliente: "0",
    costo_total_cliente: "110",
    moneda_cliente: "USD",
    comentarios: [],
    horas_disponibles: 0,
    updated_at: "",
    ...patch,
  };
}

function viaje(patch: Partial<Viaje> = {}): Viaje {
  const tramo = {
    id: 10,
    viaje: 1,
    numero_tramo: 1,
    tarifa: 5,
    origen_direccion: "Aeropuerto de Ezeiza",
    destino_direccion: "Av. Corrientes 1000, CABA",
    origen_latitud: null,
    origen_longitud: null,
    destino_latitud: null,
    destino_longitud: null,
  } as unknown as Tramo;
  return {
    id: 1,
    numero_viaje: "RX-1",
    referencia_externa: "",
    agencia: 1,
    solicitante: null,
    categoria_servicio: 1,
    proveedor: null,
    estado: 1,
    fecha_servicio: "2026-07-30",
    hora_servicio: "10:00",
    tipo_servicio: "HDS",
    cantidad_pasajeros: 1,
    cantidad_valijas: 0,
    observaciones: "",
    observaciones_chofer: "",
    datos_vuelo: "",
    unidad_asignada: "",
    tramos: [tramo],
    pasajeros: [],
    costo: costo(),
    ...patch,
  } as unknown as Viaje;
}

// El backend guarda la base PLANA y las horas aparte; el front cobra
// horas × tarifa, así que la multiplicación se rehace al leer el viaje (si no, un
// viaje guardado muestra menos de lo que cotizó el wizard).
describe("viajeToTrip — horas a disposición", () => {
  it("multiplica la base por las horas y rehace los totales", () => {
    const t = viajeToTrip(viaje({ costo: costo({ horas_disponibles: 3 }) }), CATALOGS);
    expect(t.costs.viaje).toBe(300); // 3 hs × 100
    expect(t.costs.tarifaProveedor).toBe(210); // 3 hs × 70
    expect(t.costs.total).toBe(310); // + 10 de peajes
    expect(t.costs.totalProveedor).toBe(210);
    expect(t.tarifa?.modalidad).toBe("horas");
    expect(t.tarifa?.horas).toBe(3);
  });

  it("devuelve las horas guardadas al primer destino (es donde se editan)", () => {
    const t = viajeToTrip(viaje({ costo: costo({ horas_disponibles: 4 }) }), CATALOGS);
    expect(t.legs[0].type).toBe("disposicion");
    expect(t.legs[0].hours).toBe(4);
  });

  it("sin horas a disposición respeta los montos del backend", () => {
    const t = viajeToTrip(viaje({ tipo_servicio: "IN" }), CATALOGS);
    expect(t.costs.viaje).toBe(100);
    expect(t.costs.total).toBe(110);
    expect(t.legs[0].hours).toBeUndefined();
    expect(t.tarifa?.modalidad).toBeUndefined();
  });
});
