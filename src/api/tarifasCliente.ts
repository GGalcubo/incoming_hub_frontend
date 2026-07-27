// Capa de API del tarifario de CLIENTE. Espejo de api/tarifas.ts (que es el del
// proveedor): hoy es 100% mock (localStorage) porque el backend todavía no expone
// endpoints de tarifas. Cuando los publique, se reemplaza el cuerpo de cada
// función por un `request(...)` sin tocar las vistas.
//
// SCOPING: cada tarifa pertenece a un cliente (agencia). Las funciones reciben
// `scope`: el id del cliente logueado, o null cuando es admin (opera sobre
// cualquiera). El rol proveedor NO llega hasta acá: nunca puede ver el costo al
// cliente y se corta antes, en api/client.ts y en la ruta.

import { seedClienteExtrasFor, seedTarifasClienteFor } from "../data/tarifasSeed";
import type { TarifaCliente, TarifaClienteExtras, TarifaClienteInput } from "../types/tarifas";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Persistencia mock ────────────────────────────────────────────────────────
const BASE_KEY = "proxy:tarifasClienteBase";
const EXTRAS_KEY = "proxy:tarifasClienteExtras";
// Clientes a los que ya se les provisionó un tarifario inicial. Se guarda aparte
// para no volver a sembrar si el cliente quedó sin tarifas a propósito.
const SEEDED_KEY = "proxy:tarifasClienteSeeded";

function loadBase(): TarifaCliente[] {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    if (raw) return JSON.parse(raw) as TarifaCliente[];
  } catch {
    /* almacenamiento no disponible o dato inválido */
  }
  return [];
}

function saveBase(list: TarifaCliente[]) {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// Los extras son un registro por cliente: { [clienteId]: TarifaClienteExtras }.
type ExtrasStore = Record<string, TarifaClienteExtras>;

function loadExtrasStore(): ExtrasStore {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY);
    if (raw) return JSON.parse(raw) as ExtrasStore;
  } catch {
    /* ignore */
  }
  return {};
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
  return [];
}

function markSeeded(clienteId: string) {
  const list = loadSeeded();
  if (list.includes(clienteId)) return;
  try {
    localStorage.setItem(SEEDED_KEY, JSON.stringify([...list, clienteId]));
  } catch {
    /* ignore */
  }
}

// Provisión inicial (solo mock): la primera vez que se abre el tarifario de un
// cliente le clonamos los precios de arranque para que haya con qué trabajar.
// Después queda a cargo del admin: si borra todo, no se vuelve a sembrar.
function ensureSeed(clienteId: string) {
  if (!clienteId || loadSeeded().includes(clienteId)) return;
  base = [...seedTarifasClienteFor(clienteId), ...loadBase()];
  saveBase(base);
  const store = loadExtrasStore();
  if (!store[clienteId]) {
    store[clienteId] = seedClienteExtrasFor(clienteId);
    saveExtrasStore(store);
  }
  markSeeded(clienteId);
}

let base: TarifaCliente[] = loadBase();

// ── Validaciones (mismas reglas que el tarifario de proveedor) ───────────────
const norm = (s: string) => s.trim().toLowerCase();

function assertMonto(input: TarifaClienteInput) {
  if (!(input.tarifa > 0)) throw new Error("El monto debe ser mayor a 0.");
}

// "No se permiten duplicados exactos (misma combinación origen/destino/vehículo)".
// El chequeo es DENTRO del tarifario de cada cliente.
function assertNoDuplicado(input: TarifaClienteInput, excludeId?: string) {
  const dup = base.some(
    (t) =>
      t.id !== excludeId &&
      t.clienteId === input.clienteId &&
      norm(t.origen) === norm(input.origen) &&
      norm(t.destino) === norm(input.destino) &&
      norm(t.categoria) === norm(input.categoria),
  );
  if (dup) {
    throw new Error("Ya existe una tarifa para ese origen, destino y categoría.");
  }
}

// Solo el admin (`scope === null`) escribe. Un cliente consulta su tarifario pero
// no lo edita: si igual llegara una escritura, la cortamos acá.
function assertPuedeEscribir(scope: string | null) {
  if (scope !== null) throw new Error("Solo el administrador puede modificar el tarifario.");
}

function assertCliente(clienteId: string) {
  if (!clienteId) throw new Error("Elegí el cliente de la tarifa.");
}

// ── Tarifas de cliente (CRUD) ────────────────────────────────────────────────
// `scope`: id del cliente logueado (ve solo lo suyo) o null (admin: ve todo).
// `clientes`: catálogo con el que se siembra el tarifario de arranque cuando el
// admin mira todo (si no, un cliente nuevo aparecería sin ninguna fila).
export async function listTarifasCliente(
  scope: string | null,
  clientes: string[] = [],
): Promise<TarifaCliente[]> {
  await wait(120);
  if (scope !== null) ensureSeed(scope);
  else clientes.forEach(ensureSeed);
  base = loadBase();
  return scope === null ? [...base] : base.filter((t) => t.clienteId === scope);
}

export async function createTarifaCliente(
  input: TarifaClienteInput,
  scope: string | null,
): Promise<TarifaCliente> {
  await wait(180);
  assertPuedeEscribir(scope);
  assertCliente(input.clienteId);
  assertMonto(input);
  assertNoDuplicado(input);
  const id = `TC-${String(Date.now()).slice(-6)}`;
  const created: TarifaCliente = { ...input, id };
  base = [created, ...base];
  saveBase(base);
  return created;
}

export async function updateTarifaCliente(
  t: TarifaCliente,
  scope: string | null,
): Promise<TarifaCliente> {
  await wait(180);
  assertPuedeEscribir(scope);
  if (!base.some((x) => x.id === t.id)) throw new Error("La tarifa ya no existe.");
  assertCliente(t.clienteId);
  assertMonto(t);
  assertNoDuplicado(t, t.id);
  base = base.map((x) => (x.id === t.id ? t : x));
  saveBase(base);
  return t;
}

export async function deleteTarifaCliente(id: string, scope: string | null): Promise<void> {
  await wait(150);
  assertPuedeEscribir(scope);
  base = base.filter((t) => t.id !== id);
  saveBase(base);
}

// ── Extras del cliente (un set por cliente) ──────────────────────────────────
export async function getTarifasClienteExtras(clienteId: string): Promise<TarifaClienteExtras> {
  await wait(120);
  assertCliente(clienteId);
  ensureSeed(clienteId);
  return loadExtrasStore()[clienteId] ?? seedClienteExtrasFor(clienteId);
}

export async function updateTarifasClienteExtras(
  patch: Partial<TarifaClienteExtras>,
  clienteId: string,
  scope: string | null,
): Promise<TarifaClienteExtras> {
  await wait(180);
  assertPuedeEscribir(scope);
  assertCliente(clienteId);
  const store = loadExtrasStore();
  const actual = store[clienteId] ?? seedClienteExtrasFor(clienteId);
  const next: TarifaClienteExtras = { ...actual, ...patch, clienteId };
  if ([next.espera, next.horaDispo, next.km].some((m) => !(m > 0))) {
    throw new Error("Todos los valores de extras deben ser mayores a 0.");
  }
  store[clienteId] = next;
  saveExtrasStore(store);
  return next;
}
