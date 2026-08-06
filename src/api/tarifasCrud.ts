// Capa de API de las pantallas de TARIFAS contra el backend
// (/api/v1/tarifarios/tarifas/).
//
// MODELO DEL BACKEND: hay UNA tarifa por (proveedor, origen, destino, categoría)
// y trae las dos columnas de precio adentro (`precio_proveedor` y
// `precio_cliente`). NO existe un tarifario por cliente: lo que se le factura es
// la columna `precio_cliente` de esta misma tarifa.
//
// SCOPING: lo hace el SERVIDOR. Un usuario proveedor solo ve y edita las suyas
// (el backend le fuerza el `proveedor`); el admin ve todas. Acá no repetimos ese
// chequeo.

import type {
  CategoriaServicio,
  ProveedorApi,
  ProveedorValoresPatch,
  TarifaCRUD,
  Zona,
} from "./backend";
import { fetchAll, request } from "./http";
import { listZonas, zonaKey } from "./tarifario";
import type {
  Proveedor,
  TarifaBase,
  TarifaBaseInput,
  TarifaExtras,
  VehicleCategoria,
} from "../types/tarifas";

// "Los costos son en dólares": el tarifario del front trabaja en USD.
const MONEDA = "USD";

const TARIFAS_PATH = "/tarifarios/tarifas/";
const PROVEEDORES_PATH = "/tarifarios/proveedores/";

// ── Catálogos ────────────────────────────────────────────────────────────────
// Origen/destino son ids de ZONA y la categoría de vehículo es un id de
// CategoriaServicio: para traducir en los dos sentidos hace falta el catálogo
// completo (también las inactivas, o una tarifa vieja quedaría sin etiqueta).
// Los dos son chicos y no cambian mientras se usa la app: cache por sesión.
let categoriasPromise: Promise<CategoriaServicio[]> | null = null;

function listCategoriasServicio(): Promise<CategoriaServicio[]> {
  if (!categoriasPromise) {
    categoriasPromise = fetchAll<CategoriaServicio>("/categorias/").catch((err) => {
      categoriasPromise = null; // permite reintentar tras un fallo
      throw err;
    });
  }
  return categoriasPromise;
}

interface Catalogo {
  zonas: Zona[];
  categorias: CategoriaServicio[];
}

async function catalogo(): Promise<Catalogo> {
  const [zonas, categorias] = await Promise.all([listZonas(), listCategoriasServicio()]);
  return { zonas, categorias };
}

// Categorías de vehículo para el selector de una tarifa.
export async function listCategorias(): Promise<VehicleCategoria[]> {
  const cats = await listCategoriasServicio();
  return cats
    .filter((c) => c.activo)
    .sort((a, b) => a.orden - b.orden)
    .map((c) => ({
      codigo: c.codigo,
      nombre: c.nombre,
      vehiculo: c.descripcion ?? "",
      orden: c.orden,
    }));
}

// Lugares tarifados (códigos de zona: EZE, AEP, CABA…) para los selectores de
// origen y destino. Es el mismo catálogo con el que cotiza el wizard.
export async function listLugares(): Promise<string[]> {
  const zonas = await listZonas();
  return Array.from(new Set(zonas.map(zonaKey).filter(Boolean))).sort();
}

// ── Traducción backend ↔ dominio del front ───────────────────────────────────
const norm = (s: string) => s.trim().toLowerCase();

const zonaDeId = (id: number, c: Catalogo) => c.zonas.find((z) => z.id === id);
const zonaDeKey = (key: string, c: Catalogo) =>
  c.zonas.find((z) => norm(zonaKey(z)) === norm(key));
const catDeId = (id: number, c: Catalogo) => c.categorias.find((x) => x.id === id);
const catDeCodigo = (codigo: string, c: Catalogo) =>
  c.categorias.find((x) => norm(x.codigo) === norm(codigo));

// Si una zona o una categoría no está en el catálogo (inactiva, borrada), la fila
// se muestra igual con el id crudo: mejor eso que desaparecer sin explicación.
const labelZona = (id: number, c: Catalogo) => {
  const z = zonaDeId(id, c);
  return z ? zonaKey(z) : `#${id}`;
};
const labelCategoria = (id: number, c: Catalogo) => catDeId(id, c)?.codigo ?? `#${id}`;

const num = (v: string | null) => (v != null && v !== "" ? Number(v) : 0);

function toTarifaBase(t: TarifaCRUD, c: Catalogo): TarifaBase {
  return {
    id: String(t.id),
    proveedorId: String(t.proveedor),
    origen: labelZona(t.origen, c),
    destino: labelZona(t.destino, c),
    categoria: labelCategoria(t.categoria_servicio, c),
    tarifaProveedor: num(t.precio_proveedor),
    tarifaCliente: num(t.precio_cliente),
    activo: t.activo,
  };
}

// Los precios viajan como string decimal (DRF los serializa así).
const monto = (n: number) => n.toFixed(2);

function toPayload(input: TarifaBaseInput, c: Catalogo): Record<string, unknown> {
  const origen = zonaDeKey(input.origen, c);
  const destino = zonaDeKey(input.destino, c);
  const categoria = catDeCodigo(input.categoria, c);
  if (!origen) throw new Error(`El origen "${input.origen}" no está en el catálogo de zonas.`);
  if (!destino) throw new Error(`El destino "${input.destino}" no está en el catálogo de zonas.`);
  if (!categoria) {
    throw new Error(`La categoría "${input.categoria}" no está en el catálogo de servicios.`);
  }

  const payload: Record<string, unknown> = {
    origen: origen.id,
    destino: destino.id,
    categoria_servicio: categoria.id,
    precio_proveedor: monto(input.tarifaProveedor),
    moneda_proveedor: MONEDA,
    moneda_cliente: MONEDA,
    activo: input.activo,
  };
  // El precio al cliente se OMITE si no viene cargado, en vez de mandarse en
  // null: un usuario proveedor no lo ve (el formulario ni lo muestra), así que
  // mandarlo vacío desde su pantalla borraría el precio de venta que puso el
  // admin. Omitido, el PATCH lo deja como estaba.
  if (input.tarifaCliente > 0) payload.precio_cliente = monto(input.tarifaCliente);
  // El dueño solo se manda si el front lo tiene resuelto a un id numérico. A un
  // usuario proveedor el backend se lo fuerza al suyo igual, así que omitirlo es
  // más seguro que mandar un valor inventado.
  const proveedor = Number(input.proveedorId);
  if (Number.isFinite(proveedor) && proveedor > 0) payload.proveedor = proveedor;
  return payload;
}

// ── Tarifas (CRUD) ───────────────────────────────────────────────────────────
// El endpoint filtra server-side por proveedor/origen/destino/categoría/activo,
// pero las vistas ya tienen los filtros en memoria sobre la lista completa: el
// tarifario es chico y así el filtrado es instantáneo.
export async function listTarifasBase(): Promise<TarifaBase[]> {
  const [c, rows] = await Promise.all([catalogo(), fetchAll<TarifaCRUD>(TARIFAS_PATH)]);
  return rows.map((t) => toTarifaBase(t, c));
}

export async function createTarifaBase(input: TarifaBaseInput): Promise<TarifaBase> {
  const c = await catalogo();
  const created = await request<TarifaCRUD>(TARIFAS_PATH, {
    method: "POST",
    body: JSON.stringify(toPayload(input, c)),
  });
  return toTarifaBase(created, c);
}

export async function updateTarifaBase(t: TarifaBase): Promise<TarifaBase> {
  const c = await catalogo();
  // PATCH y no PUT: así no se pisan los campos que el front no modela (las
  // vigencias desde/hasta de la tarifa).
  const saved = await request<TarifaCRUD>(`${TARIFAS_PATH}${t.id}/`, {
    method: "PATCH",
    body: JSON.stringify(toPayload(t, c)),
  });
  return toTarifaBase(saved, c);
}

export async function deleteTarifaBase(id: string): Promise<void> {
  await request<void>(`${TARIFAS_PATH}${id}/`, { method: "DELETE" });
}

// ── Catálogo de proveedores ──────────────────────────────────────────────────
// El backend ya expone /tarifarios/proveedores/ (antes no, y el catálogo había
// que reconstruirlo cotizando rutas del tarifario solo para descubrir nombres).
export async function listProveedores(): Promise<Proveedor[]> {
  const rows = await fetchAll<ProveedorApi>(PROVEEDORES_PATH);
  return rows
    .map((p) => ({ id: String(p.id), nombre: p.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ── Extras del proveedor ─────────────────────────────────────────────────────
// El backend los guarda en el propio proveedor, en dos columnas: `valor_espera`
// y `valor_hora_dispo` son POR HORA y `valor_km_adicional` por km; los
// `*_cliente` son lo mismo pero facturado al cliente.
//
// El front modela la espera POR MINUTO (es como se carga en el viaje: minutos de
// espera × valor) y el backend la guarda POR HORA: el schema lo dice explícito
// ("Valor por hora de espera del proveedor" / "…cobrado al cliente", verificado
// el 05/08/2026). La conversión es esta constante y nada más.
const MINUTOS_POR_HORA = 60;

// El set completo (las dos columnas) sale del proveedor: `valor_*` es lo que
// cobra y `valor_*_cliente` lo que se le factura al cliente.
function toExtras(p: ProveedorApi): TarifaExtras {
  return {
    proveedorId: String(p.id),
    esperaProveedor: num(p.valor_espera) / MINUTOS_POR_HORA,
    esperaCliente: num(p.valor_espera_cliente) / MINUTOS_POR_HORA,
    horaDispoProveedor: num(p.valor_hora_dispo),
    horaDispoCliente: num(p.valor_hora_dispo_cliente),
    kmProveedor: num(p.valor_km_adicional),
    kmCliente: num(p.valor_km_adicional_cliente),
  };
}

export async function getExtrasProveedor(proveedorId: string): Promise<TarifaExtras> {
  return toExtras(await request<ProveedorApi>(`${PROVEEDORES_PATH}${proveedorId}/`));
}

export async function updateExtrasProveedor(
  proveedorId: string,
  patch: Partial<TarifaExtras>,
): Promise<TarifaExtras> {
  // Solo viaja lo que venga en el patch: la vista manda únicamente las columnas
  // que el usuario puede editar (un proveedor nunca toca los valores cliente).
  const body: ProveedorValoresPatch = {};
  if (patch.esperaProveedor != null) {
    body.valor_espera = monto(patch.esperaProveedor * MINUTOS_POR_HORA);
  }
  if (patch.horaDispoProveedor != null) body.valor_hora_dispo = monto(patch.horaDispoProveedor);
  if (patch.kmProveedor != null) body.valor_km_adicional = monto(patch.kmProveedor);
  if (patch.esperaCliente != null) {
    body.valor_espera_cliente = monto(patch.esperaCliente * MINUTOS_POR_HORA);
  }
  if (patch.horaDispoCliente != null) {
    body.valor_hora_dispo_cliente = monto(patch.horaDispoCliente);
  }
  if (patch.kmCliente != null) body.valor_km_adicional_cliente = monto(patch.kmCliente);
  const p = await request<ProveedorApi>(`${PROVEEDORES_PATH}${proveedorId}/`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return toExtras(p);
}
