// Capa de API de las pantallas de TARIFAS contra el backend REAL
// (/api/v1/tarifarios/tarifas/). El mock de api/tarifas.ts queda solo para el
// modo sin backend configurado (ver USE_TARIFAS_MOCK en api/client.ts).
//
// MODELO DEL BACKEND: hay UNA tarifa por (proveedor, origen, destino, categoría)
// y trae las dos columnas de precio adentro (`precio_proveedor` y
// `precio_cliente`). NO existe un tarifario por cliente: las dos pantallas
// (Tarifas Proveedor y Tarifas Cliente) leen de acá y lo único que cambia es qué
// columna de precio muestran.
//
// SCOPING: lo hace el SERVIDOR. Un usuario proveedor solo ve y edita las suyas
// (el backend le fuerza el `proveedor`); el admin ve todas. Acá no repetimos ese
// chequeo: el mock lo hacía porque no había nadie más que lo hiciera.

import type { CategoriaServicio, MeProfile, TarifaCRUD, Zona } from "./backend";
import { fetchAll, request } from "./http";
import { cotizar, listZonas, zonaKey } from "./tarifario";
import type {
  Proveedor,
  TarifaBase,
  TarifaBaseInput,
  VehicleCategoria,
} from "../types/tarifas";

// "Los costos son en dólares": el tarifario del front trabaja en USD.
const MONEDA = "USD";

const TARIFAS_PATH = "/tarifarios/tarifas/";

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

// Categorías de vehículo para el selector de una tarifa, en el mismo formato que
// ya consumen las vistas (`VEHICLE_CATEGORIAS` del mock tiene esta forma).
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
// El backend NO expone /proveedores/. Los únicos dos lugares donde un proveedor
// viene con NOMBRE (y no solo con id) son el perfil del usuario logueado y la
// cotización de una ruta, así que el catálogo se arma con eso: cotizamos rutas
// del propio tarifario y cortamos apenas tenemos nombre para todos los que
// aparecen en las tarifas (en la práctica alcanza con una o dos llamadas).
// El que no se resuelva —p. ej. si solo tiene tarifas sin vigencia— queda con su
// id a la vista en vez de desaparecer del selector.
const MAX_COTIZACIONES = 4;

export async function listProveedores(me: MeProfile | null): Promise<Proveedor[]> {
  const [c, rows] = await Promise.all([catalogo(), fetchAll<TarifaCRUD>(TARIFAS_PATH)]);

  const nombres = new Map<string, string>();
  if (me?.proveedor) nombres.set(String(me.proveedor.id), me.proveedor.nombre);

  const ids = new Set(rows.map((t) => String(t.proveedor)));
  const faltan = new Set([...ids].filter((id) => !nombres.has(id)));

  // Rutas distintas del tarifario, en el formato con el que se cotiza (código de
  // zona). Las que apuntan a una zona fuera del catálogo no se pueden cotizar.
  const rutas: [string, string][] = [];
  const vistas = new Set<string>();
  for (const t of rows) {
    const key = `${t.origen}→${t.destino}`;
    if (vistas.has(key)) continue;
    vistas.add(key);
    const o = zonaDeId(t.origen, c);
    const d = zonaDeId(t.destino, c);
    if (o && d) rutas.push([zonaKey(o), zonaKey(d)]);
  }

  for (const [origen, destino] of rutas.slice(0, MAX_COTIZACIONES)) {
    if (!faltan.size) break;
    try {
      const out = await cotizar(origen, destino);
      for (const p of out.proveedores) {
        nombres.set(String(p.proveedor.id), p.proveedor.nombre);
        faltan.delete(String(p.proveedor.id));
      }
    } catch {
      /* una ruta sin cotización vigente no puede romper el catálogo */
    }
  }

  for (const id of nombres.keys()) ids.add(id);
  return Array.from(ids)
    .map((id) => ({ id, nombre: nombres.get(id) ?? `Proveedor #${id}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
