import { describe, expect, it } from "vitest";
import type { CategoriaServicio, CostoViaje, Estado, Tramo, Viaje } from "./backend";
import {
  CODIGO_ESTADO,
  estadoIdPorCodigo,
  estadosToStatusMeta,
  viajeToTrip,
  type Catalogs,
} from "./viajes";

const CATALOGS: Catalogs = { agencies: [], categorias: [], solicitantes: [], estados: [] };

// Catálogo con la misma forma que /services/ (ids y códigos reales del backend).
const CATEGORIAS: CategoriaServicio[] = [
  { id: 1, id_categoria_central: 1, codigo: "STD", nombre: "Auto Std", descripcion: "", activo: true, orden: 1 },
  { id: 2, id_categoria_central: 2, codigo: "EJEC", nombre: "Ejecutivo", descripcion: "", activo: true, orden: 2 },
];
const CON_CATEGORIAS: Catalogs = { ...CATALOGS, categorias: CATEGORIAS };

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
    base_manual: false,
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

// El paso Cotización marca la card y recotiza buscando por el CÓDIGO de la
// categoría (`tarifa.categoria`). Si no se reconstruye al leer el viaje, la card
// no queda seleccionada y ningún recálculo de precio encuentra qué recotizar.
describe("viajeToTrip — categoría elegida", () => {
  it("reconstruye el código de la categoría desde categoria_servicio", () => {
    const t = viajeToTrip(viaje({ categoria_servicio: 2 }), CON_CATEGORIAS);
    expect(t.cat).toBe("Ejecutivo");
    expect(t.tarifa?.categoria).toBe("EJEC");
    expect(t.tarifa?.tarifaId).toBe(5);
  });

  it("la deja marcada aunque el viaje no tenga tarifa (alta por Excel)", () => {
    const sinTarifa = viaje({
      categoria_servicio: 1,
      tramos: [{ ...(viaje().tramos![0] as Tramo), tarifa: null }],
    });
    const t = viajeToTrip(sinTarifa, CON_CATEGORIAS);
    expect(t.tarifa?.categoria).toBe("STD");
    expect(t.tarifa?.tarifaId).toBeUndefined();
  });

  it("sin categoría en el catálogo no inventa un código", () => {
    const t = viajeToTrip(viaje({ categoria_servicio: 99 }), CON_CATEGORIAS);
    expect(t.cat).toBe("");
    expect(t.tarifa?.categoria).toBeUndefined();
  });
});

// El catálogo de estados es del BACKEND. Estas filas son las reales de
// /estados/ (08/08/2026), cuando el backend normalizó la tabla: códigos en
// mayúsculas, sin espacios al final y ninguno que colisione. "Cancelado" se
// cargó último y por eso tiene el id 34, fuera del rango del resto.
//
// La última fila es sintética: hoy TODOS los estados vienen con
// `visible_agencia: true`, y hace falta uno en false para probar el filtro.
const ESTADOS: Estado[] = [
  { id: 1, codigo: "NUE", nombre: "Nuevo", color: "#273740", es_final: false, visible_agencia: true },
  { id: 6, codigo: "FIN", nombre: "Finalizado", color: "#273740", es_final: false, visible_agencia: true },
  { id: 7, codigo: "CER", nombre: "Cerrado", color: "#273740", es_final: true, visible_agencia: true },
  { id: 9, codigo: "NSH", nombre: "No Show", color: "#F5B041", es_final: false, visible_agencia: true },
  { id: 10, codigo: "MOD", nombre: "MOD", color: "#F5B041", es_final: false, visible_agencia: true },
  { id: 13, codigo: "NSP", nombre: "NO SHOW +", color: "#d3d3d3", es_final: true, visible_agencia: true },
  { id: 34, codigo: "CAN", nombre: "Cancelado", color: "#E53935", es_final: true, visible_agencia: true },
  { id: 99, codigo: "INT", nombre: "Interno", color: null, es_final: false, visible_agencia: false },
];

describe("estados: catálogo del backend", () => {
  it("resuelve el id por código", () => {
    expect(estadoIdPorCodigo(ESTADOS, CODIGO_ESTADO.FINALIZADO)).toBe(6);
    expect(estadoIdPorCodigo(ESTADOS, CODIGO_ESTADO.MODIFICADO)).toBe(10);
    expect(estadoIdPorCodigo(ESTADOS, CODIGO_ESTADO.CANCELADO)).toBe(34);
  });

  // El backend mandó códigos con casing irregular y espacios al final hasta el
  // 08/08/2026 ("Fin", "No "). Ya no, pero normalizar es una línea y evita que
  // volver a ensuciar la tabla rompa las acciones atadas a un estado.
  it("normaliza el código: ignora casing y espacios al final", () => {
    const sucios: Estado[] = [
      { ...ESTADOS[1], codigo: "Fin " },
      { ...ESTADOS[0], codigo: "nue" },
    ];
    expect(estadoIdPorCodigo(sucios, CODIGO_ESTADO.FINALIZADO)).toBe(6);
    expect(estadoIdPorCodigo(sucios, CODIGO_ESTADO.NUEVO)).toBe(1);
  });

  // Si el backend no tiene cargado el estado, la acción atada tiene que quedar
  // deshabilitada y no mandar otro. Es lo que pasaba con "Cancelado" antes de
  // que lo cargaran: el front mandaba un id fijo —el 5, "En Progreso"— y
  // cancelar dejaba el viaje en curso.
  it("devuelve null si el backend no tiene ese estado cargado", () => {
    const sinCancelado = ESTADOS.filter((e) => e.codigo !== "CAN");
    expect(estadoIdPorCodigo(sinCancelado, CODIGO_ESTADO.CANCELADO)).toBeNull();
  });

  // El id es la fila en la tabla del backend, no un campo de orden: "Cancelado"
  // se cargó después que el resto y por eso cae último del selector.
  it("deja afuera los estados internos de la central y ordena por id", () => {
    const metas = estadosToStatusMeta(ESTADOS);
    expect(metas.map((m) => m.id)).toEqual([1, 6, 7, 9, 10, 13, 34]);
    expect(metas.find((m) => m.label === "Interno")).toBeUndefined();
  });

  it("marca como final solo los que el backend marca (Cerrado sí, Finalizado no)", () => {
    const metas = estadosToStatusMeta(ESTADOS);
    expect(metas.find((m) => m.id === 7)?.esFinal).toBe(true);
    expect(metas.find((m) => m.id === 6)?.esFinal).toBe(false);
  });

  it("el estado del viaje es el id del backend, sin traducir", () => {
    expect(viajeToTrip(viaje({ estado: 13 }), CATALOGS).est).toBe(13);
  });
});
