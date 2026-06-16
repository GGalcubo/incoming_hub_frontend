// Capa de traducción entre el modelo de dominio del frontend (`Trip`) y el
// esquema del backend (`Viaje` + catálogos). Toda la lógica de red de viajes
// vive acá; client.ts solo decide entre este módulo y el mock.

import type { LegType, Trip, TripCosts, TripStatus } from "../types/domain";
import type {
  Agencia,
  CategoriaServicio,
  MeProfile,
  Paginated,
  PasajeroWrite,
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

// ── Pasajeros (personas) con paginación/búsqueda server-side ─────────────────
// La vista /pasajeros consulta /personas/ directamente (page-number pagination,
// `search` y filtro `agencia` resueltos en el backend) en vez de derivar de los
// viajes. Devuelve la página cruda para alimentar el infinite scroll.
export interface PersonasQuery {
  page?: number;
  search?: string;
  agencia?: number | null;
}

export function listPersonasPage(q: PersonasQuery): Promise<Paginated<Persona>> {
  const params = new URLSearchParams();
  params.set("page", String(q.page ?? 1));
  params.set("ordering", "nombre");
  if (q.search?.trim()) params.set("search", q.search.trim());
  if (q.agencia != null) params.set("agencia", String(q.agencia));
  return request<Paginated<Persona>>(`/personas/?${params.toString()}`);
}

// Agencias mínimas (id + nombre) para el dropdown de la vista de pasajeros y
// para resolver el nombre de agencia de cada fila. Reusa el cache de catálogos.
export interface AgenciaMin {
  id: number;
  nombre: string;
}

export async function listAgenciasMin(): Promise<AgenciaMin[]> {
  // Consulta SOLO /agencies/ (no loadCatalogs(), que arrastraría todas las
  // personas/solicitantes y reintroduciría el problema de performance).
  const agencies = await fetchAll<Agencia>("/agencies/");
  return agencies
    .filter((a) => a.activo)
    .map((a) => ({ id: a.id, nombre: agencyName(a) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Acceso a la vista de pasajeros según el rol: el admin ve todas las agencias y
// puede filtrar libremente; el no-admin queda restringido a su propia agencia.
// La agencia propia se infiere cruzando el email del perfil con los solicitantes
// (el backend no la expone en /auth/me/), igual que loadWizardIdentity.
export interface PassengersAccess {
  isAdmin: boolean;
  agencies: AgenciaMin[];
  ownAgencyId: number | null;
}

export async function loadPassengersAccess(me: MeProfile): Promise<PassengersAccess> {
  const isAdmin = me.role === "admin";
  const agencies = await listAgenciasMin();
  let ownAgencyId: number | null = null;
  if (!isAdmin) {
    const email = (me.email ?? "").trim().toLowerCase();
    if (email) {
      const solicitantes = await fetchAll<Solicitante>("/agencies/solicitantes/");
      const mySol = solicitantes.find(
        (s) => (s.email ?? "").trim().toLowerCase() === email,
      );
      ownAgencyId = mySol?.agencia ?? null;
    }
  }
  return { isAdmin, agencies, ownAgencyId };
}

// Nombres de categorías de servicio activas, ordenadas, para poblar el dropdown
// del wizard. Reusa el cache de catálogos de la sesión.
export async function listCategorias(): Promise<string[]> {
  const c = await loadCatalogs();
  return c.categorias
    .filter((x) => x.activo)
    .sort((a, b) => a.orden - b.orden)
    .map((x) => x.nombre);
}

// Identidad para el wizard: lista de agencias y la agencia propia del usuario
// logueado. La agencia propia se infiere cruzando el email del perfil con el
// catálogo de solicitantes (el backend no la expone en /auth/me/).
export interface WizardIdentity {
  agencies: string[];
  ownAgency: string | null;
  // Solicitantes activos por nombre de agencia (para que el admin pueda elegir).
  solicitantesByAgency: Record<string, string[]>;
}

export async function loadWizardIdentity(me: MeProfile): Promise<WizardIdentity> {
  const c = await loadCatalogs();
  const activeAgencies = c.agencies.filter((a) => a.activo);
  const agencies = activeAgencies.map(agencyName);
  const email = (me.email ?? "").trim().toLowerCase();
  const mySol = email
    ? c.solicitantes.find((s) => (s.email ?? "").trim().toLowerCase() === email)
    : undefined;
  const ag = mySol ? c.agencies.find((a) => a.id === mySol.agencia) : undefined;

  const solicitantesByAgency: Record<string, string[]> = {};
  for (const a of activeAgencies) {
    solicitantesByAgency[agencyName(a)] = c.solicitantes
      .filter((s) => s.agencia === a.id && s.activo)
      .map((s) => s.nombre);
  }

  return { agencies, ownAgency: ag ? agencyName(ag) : null, solicitantesByAgency };
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

  // Los pasajeros vienen embebidos en el viaje (`v.pasajeros`) con nombre,
  // teléfono y email ya resueltos por el backend. Ordenamos el principal primero.
  let passengers = [...(v.pasajeros ?? [])]
    .sort((a, b) => Number(b.es_principal) - Number(a.es_principal))
    .map((p) => ({ ...splitName(p.nombre), phone: p.telefono ?? "", email: p.email ?? undefined }));

  // Fallback (viajes viejos sin `pasajeros`): reconstruir desde el principal y
  // los pasajeros embebidos en los tramos, resolviendo el nombre vía catálogo.
  if (passengers.length === 0) {
    const passengerIds: number[] = [];
    if (v.pasajero_principal != null) passengerIds.push(v.pasajero_principal);
    for (const tr of tramos) {
      for (const pt of tr.pasajeros_tramo ?? []) {
        if (pt.pasajero != null && !passengerIds.includes(pt.pasajero)) {
          passengerIds.push(pt.pasajero);
        }
      }
    }
    passengers = passengerIds
      .map((id) => c.personas.find((p) => p.id === id))
      .filter((p): p is Persona => p != null)
      .map((p) => ({ ...splitName(p.nombre), phone: p.telefono ?? "", email: p.email ?? undefined }));
  }
  if (passengers.length === 0)
    passengers.push({ firstName: "", lastName: "", phone: "", email: undefined });

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

function resolvePasajeroPrincipal(t: Trip, c: Catalogs, agenciaId: number): number | undefined {
  const p = t.passengers[0];
  if (!p) return undefined;
  const full = `${p.firstName} ${p.lastName}`.trim().toLowerCase();
  if (!full) return undefined;
  const byName = c.personas.filter((x) => x.nombre.trim().toLowerCase() === full);
  const match = byName.find((x) => x.agencia === agenciaId) ?? byName[0];
  return match?.id;
}

// Mapea los pasajeros del wizard al formato embebido del backend. El primero con
// nombre válido queda como `es_principal`. Se omiten teléfono/email vacíos.
function buildPasajerosPayload(t: Trip): PasajeroWrite[] {
  const valid = t.passengers
    .map((p) => ({ p, nombre: `${p.firstName} ${p.lastName}`.trim() }))
    .filter((x) => x.nombre);
  return valid.map(({ p, nombre }, i) => ({
    nombre,
    ...(p.phone ? { telefono: p.phone } : {}),
    ...(p.email ? { email: p.email } : {}),
    es_principal: i === 0,
  }));
}

export function buildViajePayload(
  t: Trip,
  c: Catalogs,
  opts: { includeEstado: boolean; includePasajeros?: boolean },
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
  if (opts.includePasajeros) {
    // En creación el backend da de alta los pasajeros y fija el principal a
    // partir de `es_principal`, así que no resolvemos `pasajero_principal`.
    const pasajeros = buildPasajerosPayload(t);
    if (pasajeros.length) payload.pasajeros = pasajeros;
  } else {
    const principal = resolvePasajeroPrincipal(t, c, agencia);
    if (principal != null) payload.pasajero_principal = principal;
  }
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
// El solicitante lo asigna el backend (usuario logueado), no se envía. Las
// personas/pasajeros sí son entidades propias: si el nombre cargado en el
// wizard no existe, lo creamos y lo dejamos en el cache para que
// buildViajePayload lo resuelva.
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
  // Los pasajeros viajan dentro del mismo POST: el backend crea las Personas y
  // asigna el pasajero principal, no hace falta pre-crearlas con ensurePersonas.
  const payload = buildViajePayload(trip, catalogs, {
    includeEstado: false,
    includePasajeros: true,
  });
  const created = await request<Viaje>("/viajes/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  // Las personas recién creadas por el backend no están en el cache; lo
  // invalidamos para que getTrip resuelva el nombre del pasajero principal.
  invalidateCatalogs();
  await syncTramos(trip, created.id, []);
  return getTrip(String(created.id));
}

export async function updateTrip(trip: Trip): Promise<Trip> {
  const catalogs = await loadCatalogs();
  const agenciaId = resolveAgencia(trip, catalogs);
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
