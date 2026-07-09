// Capa de API de TARIFAS. Hoy es 100% mock (localStorage): el backend todavía no
// expone endpoints de tarifas. Está aislada acá para que, cuando el backend los
// publique, se reemplace el cuerpo de cada función por un `request(...)` (igual
// que api/viajes.ts) sin tocar las vistas ni el wizard.

import {
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

function loadBase(): TarifaBase[] {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    if (raw) return JSON.parse(raw) as TarifaBase[];
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

function loadExtras(): TarifaExtras {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY);
    if (raw) return { ...SEED_TARIFAS_EXTRAS, ...(JSON.parse(raw) as Partial<TarifaExtras>) };
  } catch {
    /* ignore */
  }
  return { ...SEED_TARIFAS_EXTRAS };
}

function saveExtras(e: TarifaExtras) {
  try {
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(e));
  } catch {
    /* ignore */
  }
}

let base: TarifaBase[] = loadBase();

// ── Validaciones (reglas del deck) ───────────────────────────────────────────
const norm = (s: string) => s.trim().toLowerCase();

function assertMontos(input: TarifaBaseInput) {
  if (!(input.tarifaProveedor > 0) || !(input.tarifaCliente > 0)) {
    throw new Error("Los montos deben ser mayores a 0.");
  }
}

// "No se permiten duplicados exactos (misma combinación origen/destino/vehículo)".
function assertNoDuplicado(input: TarifaBaseInput, excludeId?: string) {
  const dup = base.some(
    (t) =>
      t.id !== excludeId &&
      norm(t.origen) === norm(input.origen) &&
      norm(t.destino) === norm(input.destino) &&
      norm(t.categoria) === norm(input.categoria),
  );
  if (dup) {
    throw new Error("Ya existe una tarifa para ese origen, destino y categoría.");
  }
}

// ── Catálogos ─────────────────────────────────────────────────────────────────
export async function listLugares(): Promise<string[]> {
  await wait(60);
  return [...TARIFA_LUGARES];
}

// ── Tarifas base (CRUD) ─────────────────────────────────────────────────────
export async function listTarifasBase(): Promise<TarifaBase[]> {
  await wait(120);
  base = loadBase();
  return [...base];
}

export async function createTarifaBase(input: TarifaBaseInput): Promise<TarifaBase> {
  await wait(180);
  assertMontos(input);
  assertNoDuplicado(input);
  const id = `T-${String(Date.now()).slice(-6)}`;
  const created: TarifaBase = { ...input, id };
  base = [created, ...base];
  saveBase(base);
  return created;
}

export async function updateTarifaBase(t: TarifaBase): Promise<TarifaBase> {
  await wait(180);
  assertMontos(t);
  assertNoDuplicado(t, t.id);
  base = base.map((x) => (x.id === t.id ? t : x));
  saveBase(base);
  return t;
}

export async function deleteTarifaBase(id: string): Promise<void> {
  await wait(150);
  base = base.filter((t) => t.id !== id);
  saveBase(base);
}

// ── Tarifas de extras (set único) ────────────────────────────────────────────
export async function getTarifasExtras(): Promise<TarifaExtras> {
  await wait(120);
  return loadExtras();
}

export async function updateTarifasExtras(patch: Partial<TarifaExtras>): Promise<TarifaExtras> {
  await wait(180);
  const next = { ...loadExtras(), ...patch };
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
  saveExtras(next);
  return next;
}

// ── Categorías tarifadas por ruta (consume el paso "Tarifa" del wizard) ──────
// Cruza las 4 categorías de vehículo con las tarifas base ACTIVAS de la ruta.
// Devuelve precio null cuando no hay tarifa activa para esa combinación (así el
// wizard puede mostrar la card deshabilitada en vez de omitirla).
export async function getCategoriasTarifadas(
  origen: string,
  destino: string,
): Promise<CategoriaTarifada[]> {
  await wait(120);
  const rows = loadBase();
  return [...VEHICLE_CATEGORIAS]
    .sort((a, b) => a.orden - b.orden)
    .map((c) => {
      const match = rows.find(
        (t) =>
          t.activo &&
          norm(t.origen) === norm(origen) &&
          norm(t.destino) === norm(destino) &&
          norm(t.categoria) === norm(c.codigo),
      );
      return {
        ...c,
        origen,
        destino,
        tarifaProveedor: match?.tarifaProveedor ?? null,
        tarifaCliente: match?.tarifaCliente ?? null,
      };
    });
}
