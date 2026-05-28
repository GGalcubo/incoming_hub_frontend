// Capa de traducción entre el modelo de dominio del frontend (`Trip`) y el
// esquema del backend (`Viaje` + catálogos). Toda la lógica de red de viajes
// vive acá; client.ts solo decide entre este módulo y el mock.

import type { LegType, Trip, TripCosts, TripStatus } from "../types/domain";
import type {
  Agencia,
  CategoriaServicio,
  Paginated,
  Persona,
  Solicitante,
  TipoServicio,
  Tramo,
  TramoWrite,
  Viaje,
  ViajeWrite,
} from "./backend";
import { request } from "./http";

// ── Estados ────────────────────────────────────────────────────────────────
// El backend expone `estado` como entero pero NO publica un endpoint de
// catálogo de estados. Este mapeo sigue el orden del catálogo de producto
// (data/seed STATUSES). Si el backend usa otros IDs, ajustar solo esta tabla.
const ESTADO_TO_STATUS: Record<number, TripStatus> = {
  1: "PENDIENTE",
  2: "CONFIRMADO",
  3: "EN_CURSO",
  4: "FINALIZADO",
  5: "CANCELADO",
  6: "NO_SHOW",
  7: "REPROGRAMADO",
  8: "EN_ESPERA",
  9: "MODIFICADO",
};
const STATUS_TO_ESTADO: Record<TripStatus, number> = Object.fromEntries(
  Object.entries(ESTADO_TO_STATUS).map(([id, st]) => [st, Number(id)]),
) as Record<TripStatus, number>;

function estadoToStatus(estado: number): TripStatus {
  return ESTADO_TO_STATUS[estado] ?? "PENDIENTE";
}
function statusToEstado(status: TripStatus): number {
  return STATUS_TO_ESTADO[status] ?? 1;
}

// ── Tipo de servicio ⟷ tipo de tramo ────────────────────────────────────────
const TIPO_TO_LEG: Record<TipoServicio, LegType> = {
  IN: "in",
  OUT: "out",
  HDS: "disposicion",
  OTR: "otro",
};
const LEG_TO_TIPO: Record<LegType, TipoServicio> = {
  in: "IN",
  out: "OUT",
  disposicion: "HDS",
  otro: "OTR",
};

// ── Catálogos (cache en memoria por sesión) ─────────────────────────────────
export interface Catalogs {
  agencies: Agencia[];
  categorias: CategoriaServicio[];
  solicitantes: Solicitante[];
  personas: Persona[];
}

let catalogsPromise: Promise<Catalogs> | null = null;

async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  // Recorre la paginación de DRF hasta que `next` sea null.
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await request<Paginated<T>>(`${path}${sep}page=${page}`);
    out.push(...data.results);
    if (!data.next) break;
    page += 1;
  }
  return out;
}

export function loadCatalogs(): Promise<Catalogs> {
  if (!catalogsPromise) {
    catalogsPromise = Promise.all([
      fetchAll<Agencia>("/agencies/"),
      fetchAll<CategoriaServicio>("/services/"),
      fetchAll<Solicitante>("/agencies/solicitantes/"),
      fetchAll<Persona>("/personas/"),
    ])
      .then(([agencies, categorias, solicitantes, personas]) => ({
        agencies,
        categorias,
        solicitantes,
        personas,
      }))
      .catch((err) => {
        catalogsPromise = null; // permite reintentar tras un fallo
        throw err;
      });
  }
  return catalogsPromise;
}

export function invalidateCatalogs() {
  catalogsPromise = null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const agencyName = (a: Agencia) => a.razon_social_cliente || a.nombre_centro_costo || `Agencia ${a.id}`;

function splitName(nombre: string): { firstName: string; lastName: string } {
  const parts = nombre.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function parseCoord(s: string | null): number | undefined {
  if (s == null || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// El backend valida lat/lng con ^-?\d{0,3}(?:\.\d{0,7})?$
function fmtCoord(n: number | undefined): string | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return n.toFixed(7);
}

function num(s: string | null | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function placeOf(direccion: string, lugar: string): string {
  return lugar || direccion || "";
}

// ── Viaje → Trip ──────────────────────────────────────────────────────────────
export function viajeToTrip(v: Viaje, c: Catalogs): Trip {
  const agencia = c.agencies.find((a) => a.id === v.agencia);
  const categoria = c.categorias.find((x) => x.id === v.categoria_servicio);
  const solicitante = c.solicitantes.find((s) => s.id === v.solicitante);
  const principal = c.personas.find((p) => p.id === v.pasajero_principal);

  const tramos = [...v.tramos].sort((a, b) => a.numero_tramo - b.numero_tramo);
  const legs = tramos.map((tr, i) => {
    const originCoords = coordsOf(tr.origen_latitud, tr.origen_longitud);
    const destinationCoords = coordsOf(tr.destino_latitud, tr.destino_longitud);
    return {
      type: i === 0 ? TIPO_TO_LEG[v.tipo_servicio] : ("otro" as LegType),
      origin: placeOf(tr.origen_direccion, tr.origen_lugar_nombre),
      destination: placeOf(tr.destino_direccion, tr.destino_lugar_nombre),
      flight: i === 0 ? v.datos_vuelo : "",
      obs: "",
      ...(originCoords ? { originCoords } : {}),
      ...(destinationCoords ? { destinationCoords } : {}),
    };
  });
  if (legs.length === 0) {
    legs.push({
      type: TIPO_TO_LEG[v.tipo_servicio],
      origin: "",
      destination: "",
      flight: v.datos_vuelo ?? "",
      obs: "",
    });
  }

  const passengers = principal
    ? [{ ...splitName(principal.nombre), phone: principal.telefono ?? "", email: principal.email ?? undefined }]
    : [{ firstName: "", lastName: "", phone: "" }];

  const costs: TripCosts = v.costo
    ? {
        total: num(v.costo.costo_total),
        viaje: num(v.costo.costo_viaje),
        espera: num(v.costo.costo_espera),
        peajes: num(v.costo.costo_peajes),
        estacionamiento: num(v.costo.costo_estacionamiento),
        otros: num(v.costo.costo_otros),
      }
    : { total: 0, viaje: 0, espera: 0, peajes: 0, estacionamiento: 0, otros: 0 };

  return {
    id: String(v.id),
    numero: v.numero_viaje,
    date: v.fecha_servicio,
    time: (v.hora_servicio ?? "").slice(0, 5),
    pax: v.cantidad_pasajeros,
    cat: categoria?.nombre ?? "",
    ori: legs[0]?.origin ?? "",
    dst: legs[legs.length - 1]?.destination ?? "",
    est: estadoToStatus(v.estado),
    agc: agencia ? agencyName(agencia) : "",
    ref: v.referencia_externa ?? "",
    obs: v.observaciones ?? "",
    unit: v.unidad_asignada ?? "",
    passengers,
    legs,
    costs,
    history: [],
    solicitante: solicitante?.nombre ?? "",
  };
}

function coordsOf(lat: string | null, lng: string | null) {
  const la = parseCoord(lat);
  const ln = parseCoord(lng);
  return la != null && ln != null ? { lat: la, lng: ln } : undefined;
}

// ── Trip → Viaje (cuerpo escribible) ────────────────────────────────────────
function resolveAgencia(t: Trip, c: Catalogs): number {
  const byName = c.agencies.find((a) => agencyName(a) === t.agc);
  return byName?.id ?? c.agencies[0]?.id ?? 0;
}

function resolveCategoria(t: Trip, c: Catalogs): number {
  const target = t.cat.trim().toLowerCase();
  const match = c.categorias.find((x) => x.nombre.trim().toLowerCase() === target);
  return match?.id ?? c.categorias[0]?.id ?? 0;
}

function resolveSolicitante(t: Trip, c: Catalogs, agenciaId: number): number | undefined {
  const name = (t.solicitante ?? "").trim().toLowerCase();
  if (!name) return undefined;
  const byName = c.solicitantes.filter((s) => s.nombre.trim().toLowerCase() === name);
  const match = byName.find((s) => s.agencia === agenciaId) ?? byName[0];
  return match?.id;
}

function resolvePasajeroPrincipal(t: Trip, c: Catalogs, agenciaId: number): number | undefined {
  const p = t.passengers[0];
  if (!p) return undefined;
  const full = `${p.firstName} ${p.lastName}`.trim().toLowerCase();
  if (!full) return undefined;
  const byName = c.personas.filter((x) => x.nombre.trim().toLowerCase() === full);
  const match = byName.find((x) => x.agencia === agenciaId) ?? byName[0];
  return match?.id;
}

export function buildViajePayload(
  t: Trip,
  c: Catalogs,
  opts: { includeEstado: boolean },
): ViajeWrite {
  const agencia = resolveAgencia(t, c);
  const firstLeg = t.legs[0];
  const payload: ViajeWrite = {
    referencia_externa: t.ref ?? "",
    agencia,
    categoria_servicio: resolveCategoria(t, c),
    fecha_servicio: t.date,
    hora_servicio: t.time,
    tipo_servicio: firstLeg ? LEG_TO_TIPO[firstLeg.type] : "IN",
    cantidad_pasajeros: t.pax || t.passengers.length || 1,
    cantidad_valijas: 0,
    observaciones: t.obs ?? "",
    observaciones_chofer: "",
    datos_vuelo: firstLeg?.flight ?? "",
    puede_modificar: true,
    horas_minimas_cancelacion: 24,
  };
  const solicitante = resolveSolicitante(t, c, agencia);
  if (solicitante != null) payload.solicitante = solicitante;
  const principal = resolvePasajeroPrincipal(t, c, agencia);
  if (principal != null) payload.pasajero_principal = principal;
  if (opts.includeEstado) payload.estado = statusToEstado(t.est);
  return payload;
}

export function buildTramoPayloads(t: Trip, viajeId: number): TramoWrite[] {
  return t.legs
    .filter((l) => l.origin || l.destination)
    .map((l, i) => ({
      viaje: viajeId,
      numero_tramo: i + 1,
      origen_direccion: l.origin,
      origen_lugar_nombre: l.origin,
      origen_latitud: fmtCoord(l.originCoords?.lat) ?? null,
      origen_longitud: fmtCoord(l.originCoords?.lng) ?? null,
      destino_direccion: l.destination,
      destino_lugar_nombre: l.destination,
      destino_latitud: fmtCoord(l.destinationCoords?.lat) ?? null,
      destino_longitud: fmtCoord(l.destinationCoords?.lng) ?? null,
    }));
}

// ── Upsert de catálogos al guardar ──────────────────────────────────────────
// El backend no acepta solicitante/pasajeros inline en el viaje: son entidades
// propias. Si el nombre cargado en el wizard no existe, lo creamos y lo dejamos
// en el cache para que buildViajePayload lo resuelva.
async function ensureSolicitante(t: Trip, c: Catalogs, agenciaId: number): Promise<void> {
  const name = (t.solicitante ?? "").trim();
  if (!name) return;
  if (resolveSolicitante(t, c, agenciaId) != null) return;
  const created = await request<Solicitante>("/agencies/solicitantes/", {
    method: "POST",
    body: JSON.stringify({ agencia: agenciaId, nombre: name }),
  });
  c.solicitantes.push(created);
}

async function ensurePersonas(t: Trip, c: Catalogs, agenciaId: number): Promise<void> {
  for (const p of t.passengers) {
    const nombre = `${p.firstName} ${p.lastName}`.trim();
    if (!nombre) continue;
    const exists = c.personas.some(
      (x) => x.nombre.trim().toLowerCase() === nombre.toLowerCase() && x.agencia === agenciaId,
    );
    if (exists) continue;
    const created = await request<Persona>("/personas/", {
      method: "POST",
      body: JSON.stringify({ agencia: agenciaId, nombre, telefono: p.phone ?? "" }),
    });
    c.personas.push(created);
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function listTrips(): Promise<Trip[]> {
  const [catalogs, viajes] = await Promise.all([loadCatalogs(), fetchAll<Viaje>("/viajes/")]);
  return viajes.map((v) => viajeToTrip(v, catalogs));
}

export async function getTrip(id: string): Promise<Trip> {
  const [catalogs, viaje] = await Promise.all([
    loadCatalogs(),
    request<Viaje>(`/viajes/${id}/`),
  ]);
  return viajeToTrip(viaje, catalogs);
}

export async function createTrip(trip: Trip): Promise<Trip> {
  const catalogs = await loadCatalogs();
  const agenciaId = resolveAgencia(trip, catalogs);
  await ensureSolicitante(trip, catalogs, agenciaId);
  await ensurePersonas(trip, catalogs, agenciaId);
  const payload = buildViajePayload(trip, catalogs, { includeEstado: false });
  const created = await request<Viaje>("/viajes/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await syncTramos(trip, created.id, []);
  return getTrip(String(created.id));
}

export async function updateTrip(trip: Trip): Promise<Trip> {
  const catalogs = await loadCatalogs();
  const agenciaId = resolveAgencia(trip, catalogs);
  await ensureSolicitante(trip, catalogs, agenciaId);
  await ensurePersonas(trip, catalogs, agenciaId);
  const payload = buildViajePayload(trip, catalogs, { includeEstado: true });
  const updated = await request<Viaje>(`/viajes/${trip.id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  await syncTramos(trip, updated.id, updated.tramos);
  return getTrip(String(updated.id));
}

export async function setStatus(id: string, est: TripStatus): Promise<Trip> {
  const [catalogs, updated] = await Promise.all([
    loadCatalogs(),
    request<Viaje>(`/viajes/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ estado: statusToEstado(est) }),
    }),
  ]);
  return viajeToTrip(updated, catalogs);
}

export async function cancelTrip(id: string, reason: string): Promise<Trip> {
  const catalogs = await loadCatalogs();
  const current = await request<Viaje>(`/viajes/${id}/`);
  const observaciones =
    (current.observaciones ?? "") +
    (current.observaciones ? " · " : "") +
    "Cancelado: " +
    reason;
  const updated = await request<Viaje>(`/viajes/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ estado: statusToEstado("CANCELADO"), observaciones }),
  });
  return viajeToTrip(updated, catalogs);
}

export async function deleteTrip(id: string): Promise<void> {
  await request<void>(`/viajes/${id}/`, { method: "DELETE" });
}

// Reemplaza los tramos del viaje por los del Trip editado (delete + recreate).
async function syncTramos(trip: Trip, viajeId: number, existing: Tramo[]): Promise<void> {
  for (const tr of existing) {
    await request<void>(`/tramos/${tr.id}/`, { method: "DELETE" });
  }
  const payloads = buildTramoPayloads(trip, viajeId);
  for (const body of payloads) {
    await request<Tramo>("/tramos/", { method: "POST", body: JSON.stringify(body) });
  }
}
