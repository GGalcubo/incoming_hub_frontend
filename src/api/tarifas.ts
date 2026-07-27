// Capa de API de TARIFAS. Hoy es 100% mock (localStorage): el backend todavía no
// expone endpoints de tarifas. Está aislada acá para que, cuando el backend los
// publique, se reemplace el cuerpo de cada función por un `request(...)` (igual
// que api/viajes.ts) sin tocar las vistas ni el wizard.
//
// SCOPING: cada tarifa (base y extras) pertenece a un proveedor. Las funciones
// de escritura reciben `scope`: el id del proveedor logueado, o `null` cuando es
// admin (puede operar sobre cualquiera). Un proveedor solo puede leer y tocar lo
// suyo; cuando el backend publique los endpoints, esta misma regla tiene que
// aplicarse del lado del servidor (acá es solo defensa de UI).

import {
  seedExtrasFor,
  seedTarifasBaseFor,
  SEED_TARIFAS_BASE,
  SEED_TARIFAS_EXTRAS,
  TARIFA_LUGARES,
  VEHICLE_CATEGORIAS,
} from "../data/tarifasSeed";
import type {
  CategoriaTarifada,
  TarifaBase,
  TarifaBaseInput,
  TarifaExtras,
} from "../types/tarifas";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Persistencia mock ────────────────────────────────────────────────────────
const BASE_KEY = "proxy:tarifasBase";
const EXTRAS_KEY = "proxy:tarifasExtras";
// Proveedores a los que ya se les provisionó un tarifario inicial. Se guarda
// aparte para no volver a sembrar si el proveedor borró todas sus tarifas.
const SEEDED_KEY = "proxy:tarifasSeeded";

function loadBase(): TarifaBase[] {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    if (raw) {
      // Migración: las tarifas guardadas antes del scoping no tienen dueño.
      // Quedan con el proveedor del seed.
      return (JSON.parse(raw) as TarifaBase[]).map((t) => ({
        ...t,
        proveedorId: t.proveedorId || SEED_TARIFAS_EXTRAS.proveedorId,
      }));
    }
  } catch {
    /* almacenamiento no disponible o dato inválido */
  }
  return [...SEED_TARIFAS_BASE];
}

function saveBase(list: TarifaBase[]) {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// Los extras son un registro por proveedor: { [proveedorId]: TarifaExtras }.
type ExtrasStore = Record<string, TarifaExtras>;

function loadExtrasStore(): ExtrasStore {
  const seed: ExtrasStore = { [SEED_TARIFAS_EXTRAS.proveedorId]: { ...SEED_TARIFAS_EXTRAS } };
  try {
    const raw = localStorage.getItem(EXTRAS_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as ExtrasStore | TarifaExtras;
    // Migración del formato viejo (un único set global, sin scoping).
    if (typeof (parsed as TarifaExtras).esperaProveedor === "number") {
      const old = parsed as TarifaExtras;
      return { [SEED_TARIFAS_EXTRAS.proveedorId]: { ...old, proveedorId: SEED_TARIFAS_EXTRAS.proveedorId } };
    }
    return { ...seed, ...(parsed as ExtrasStore) };
  } catch {
    return seed;
  }
}

function saveExtrasStore(store: ExtrasStore) {
  try {
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function loadSeeded(): string[] {
  try {
    const raw = localStorage.getItem(SEEDED_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return [SEED_TARIFAS_EXTRAS.proveedorId];
}

function markSeeded(proveedorId: string) {
  const list = loadSeeded();
  if (list.includes(proveedorId)) return;
  try {
    localStorage.setItem(SEEDED_KEY, JSON.stringify([...list, proveedorId]));
  } catch {
    /* ignore */
  }
}

// Provisión inicial (solo mock): la primera vez que un proveedor entra a sus
// tarifas le clonamos el tarifario del seed para que tenga con qué trabajar.
// Después queda a su cargo: si borra todo, no se vuelve a sembrar.
function ensureSeed(proveedorId: string) {
  if (!proveedorId || loadSeeded().includes(proveedorId)) return;
  base = [...seedTarifasBaseFor(proveedorId), ...loadBase()];
  saveBase(base);
  const store = loadExtrasStore();
  if (!store[proveedorId]) {
    store[proveedorId] = seedExtrasFor(proveedorId);
    saveExtrasStore(store);
  }
  markSeeded(proveedorId);
}

let base: TarifaBase[] = loadBase();

// ── Validaciones (reglas del deck) ───────────────────────────────────────────
const norm = (s: string) => s.trim().toLowerCase();

// El proveedor no ve ni carga el valor al cliente, así que solo se le exige el
// suyo: la tarifa cliente queda en 0 ("a definir") hasta que la complete el admin.
// Con `scope === null` (admin) se exigen las dos.
function assertMontos(input: TarifaBaseInput, scope: string | null) {
  if (!(input.tarifaProveedor > 0)) {
    throw new Error("La tarifa de proveedor debe ser mayor a 0.");
  }
  if (scope === null && !(input.tarifaCliente > 0)) {
    throw new Error("La tarifa de cliente debe ser mayor a 0.");
  }
}

// "No se permiten duplicados exactos (misma combinación origen/destino/vehículo)".
// El chequeo es DENTRO del tarifario de cada proveedor: dos proveedores pueden
// tener su propia tarifa para la misma ruta y categoría.
function assertNoDuplicado(input: TarifaBaseInput, excludeId?: string) {
  const dup = base.some(
    (t) =>
      t.id !== excludeId &&
      t.proveedorId === input.proveedorId &&
      norm(t.origen) === norm(input.origen) &&
      norm(t.destino) === norm(input.destino) &&
      norm(t.categoria) === norm(input.categoria),
  );
  if (dup) {
    throw new Error("Ya existe una tarifa para ese origen, destino y categoría.");
  }
}

// Un proveedor solo escribe sobre su propio tarifario. `scope === null` = admin.
function assertPropia(proveedorId: string, scope: string | null) {
  if (scope !== null && proveedorId !== scope) {
    throw new Error("Solo podés modificar tu propio tarifario.");
  }
}

function assertProveedor(proveedorId: string) {
  if (!proveedorId) throw new Error("Elegí el proveedor de la tarifa.");
}

// ── Catálogos ─────────────────────────────────────────────────────────────────
export async function listLugares(): Promise<string[]> {
  await wait(60);
  return [...TARIFA_LUGARES];
}

// ── Tarifas base (CRUD) ─────────────────────────────────────────────────────
// `scope`: id del proveedor logueado (ve solo lo suyo) o null (admin/agencia:
// ve todo el tarifario).
export async function listTarifasBase(scope: string | null): Promise<TarifaBase[]> {
  await wait(120);
  base = loadBase();
  if (scope === null) return [...base];
  ensureSeed(scope);
  return base.filter((t) => t.proveedorId === scope);
}

export async function createTarifaBase(
  input: TarifaBaseInput,
  scope: string | null,
): Promise<TarifaBase> {
  await wait(180);
  // El proveedor no elige dueño: siempre es él.
  const owned: TarifaBaseInput = { ...input, proveedorId: scope ?? input.proveedorId };
  assertProveedor(owned.proveedorId);
  assertPropia(owned.proveedorId, scope);
  assertMontos(owned, scope);
  assertNoDuplicado(owned);
  const id = `T-${String(Date.now()).slice(-6)}`;
  const created: TarifaBase = { ...owned, id };
  base = [created, ...base];
  saveBase(base);
  return created;
}

export async function updateTarifaBase(t: TarifaBase, scope: string | null): Promise<TarifaBase> {
  await wait(180);
  const actual = base.find((x) => x.id === t.id);
  if (!actual) throw new Error("La tarifa ya no existe.");
  // No se puede cambiar de dueño ni tocar la de otro.
  assertPropia(actual.proveedorId, scope);
  const next: TarifaBase = {
    ...t,
    proveedorId: scope ?? t.proveedorId,
    // El proveedor no ve la tarifa cliente: se conserva la guardada pase lo que
    // pase, así una edición suya nunca la pisa.
    tarifaCliente: scope === null ? t.tarifaCliente : actual.tarifaCliente,
  };
  assertProveedor(next.proveedorId);
  assertPropia(next.proveedorId, scope);
  assertMontos(next, scope);
  assertNoDuplicado(next, next.id);
  base = base.map((x) => (x.id === next.id ? next : x));
  saveBase(base);
  return next;
}

export async function deleteTarifaBase(id: string, scope: string | null): Promise<void> {
  await wait(150);
  const actual = base.find((x) => x.id === id);
  if (!actual) return;
  assertPropia(actual.proveedorId, scope);
  base = base.filter((t) => t.id !== id);
  saveBase(base);
}

// ── Tarifas de extras (un set por proveedor) ─────────────────────────────────
export async function getTarifasExtras(proveedorId: string): Promise<TarifaExtras> {
  await wait(120);
  ensureSeed(proveedorId);
  return loadExtrasStore()[proveedorId] ?? seedExtrasFor(proveedorId);
}

export async function updateTarifasExtras(
  patch: Partial<TarifaExtras>,
  proveedorId: string,
  scope: string | null,
): Promise<TarifaExtras> {
  await wait(180);
  assertProveedor(proveedorId);
  assertPropia(proveedorId, scope);
  const store = loadExtrasStore();
  const actual = store[proveedorId] ?? seedExtrasFor(proveedorId);
  const next: TarifaExtras = { ...actual, ...patch, proveedorId };
  // Regla del deck: todos los montos numéricos y > 0.
  const montos = [
    next.esperaProveedor,
    next.esperaCliente,
    next.horaDispoProveedor,
    next.horaDispoCliente,
    next.kmProveedor,
    next.kmCliente,
  ];
  if (montos.some((m) => !(m > 0))) {
    throw new Error("Todos los valores de extras deben ser mayores a 0.");
  }
  store[proveedorId] = next;
  saveExtrasStore(store);
  return next;
}

// ── Categorías tarifadas por ruta (consume el paso "Tarifa" del wizard) ──────
// Cruza las 4 categorías de vehículo con las tarifas base ACTIVAS de la ruta,
// dentro del tarifario del proveedor asignado al viaje. Devuelve precio null
// cuando no hay tarifa activa para esa combinación (así el wizard puede mostrar
// la card deshabilitada en vez de omitirla).
export async function getCategoriasTarifadas(
  origen: string,
  destino: string,
  proveedorId: string,
): Promise<CategoriaTarifada[]> {
  await wait(120);
  ensureSeed(proveedorId);
  const rows = loadBase();
  return [...VEHICLE_CATEGORIAS]
    .sort((a, b) => a.orden - b.orden)
    .map((c) => {
      const match = rows.find(
        (t) =>
          t.activo &&
          t.proveedorId === proveedorId &&
          norm(t.origen) === norm(origen) &&
          norm(t.destino) === norm(destino) &&
          norm(t.categoria) === norm(c.codigo),
      );
      // Un monto en 0 es "sin cargar" (el proveedor no completa el valor
      // cliente): vale lo mismo que no tener tarifa.
      const monto = (n: number | undefined) => (n && n > 0 ? n : null);
      return {
        ...c,
        origen,
        destino,
        tarifaProveedor: monto(match?.tarifaProveedor),
        tarifaCliente: monto(match?.tarifaCliente),
      };
    });
}
