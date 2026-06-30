// Capa de traducción entre el modelo de dominio del frontend (`Trip`) y el
// esquema del backend (`Viaje` + catálogos). Toda la lógica de red de viajes
// vive acá; client.ts solo decide entre este módulo y el mock.

import type { ExcelRow, Leg, LegType, Trip, TripCosts, TripStatus } from "../types/domain";
import type {
  Agencia,
  CategoriaServicio,
  MeProfile,
  Paginated,
  PasajeroRead,
  PasajeroWrite,
  Persona,
  Solicitante,
  TipoServicio,
  Tramo,
  TramoInput,
  Viaje,
  ViajePersonaWrite,
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

  const tramos = [...(v.tramos ?? [])].sort((a, b) => a.numero_tramo - b.numero_tramo);
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

// Un destino del wizard (Leg) → tramo coords-only del backend. Origen y destino
// van en el mismo objeto; cada par lat/lng se incluye solo si está completo (el
// backend rechaza una coordenada suelta). Las direcciones de texto NO se envían:
// el backend resuelve la localidad por las coordenadas.
function buildTramoInput(l: Leg): TramoInput {
  const t: TramoInput = {};
  const oLat = fmtCoord(l.originCoords?.lat);
  const oLng = fmtCoord(l.originCoords?.lng);
  const dLat = fmtCoord(l.destinationCoords?.lat);
  const dLng = fmtCoord(l.destinationCoords?.lng);
  if (oLat && oLng) {
    t.origen_latitud = oLat;
    t.origen_longitud = oLng;
  }
  if (dLat && dLng) {
    t.destino_latitud = dLat;
    t.destino_longitud = dLng;
  }
  return t;
}

// Tramos a enviar: un objeto por destino con datos (origen o destino). El orden
// define el numero_tramo; el primero es el principal.
function buildTramosInput(t: Trip): TramoInput[] {
  return t.legs.filter((l) => l.origin || l.destination).map(buildTramoInput);
}

export function buildViajePayload(
  t: Trip,
  c: Catalogs,
  opts: { includeEstado: boolean; includePasajeros?: boolean },
): ViajeWrite {
  const agencia = resolveAgencia(t, c);
  const firstLeg = t.legs[0];
  // En edición el wizard carga la lista completa de pasajeros (viajeToTrip mapea
  // todos los `pasajeros` del backend), así que el conteo real siempre es la
  // cantidad de pasajeros con nombre válido (tanto en alta como en modificación).
  const pasajeros = buildPasajerosPayload(t);
  const payload: ViajeWrite = {
    referencia_externa: t.ref ?? "",
    agencia,
    categoria_servicio: resolveCategoria(t, c),
    fecha_servicio: t.date,
    hora_servicio: t.time,
    tipo_servicio: firstLeg ? LEG_TO_TIPO[firstLeg.type] : "IN",
    cantidad_pasajeros: pasajeros.length || t.pax || 1,
    cantidad_valijas: 0,
    observaciones: t.obs ?? "",
    observaciones_chofer: "",
    datos_vuelo: firstLeg?.flight ?? "",
    puede_modificar: true,
    horas_minimas_cancelacion: 24,
  };
  // En creación el backend da de alta los pasajeros y fija el principal a partir
  // de `es_principal`. En edición los pasajeros se sincronizan aparte vía
  // /pasajeros-viaje/ (ver syncPasajeros), no embebidos en el PATCH del viaje.
  if (opts.includePasajeros && pasajeros.length) payload.pasajeros = pasajeros;
  if (opts.includeEstado) payload.estado = statusToEstado(t.est);
  return payload;
}

// ── Excel → Trip ────────────────────────────────────────────────────────────
// Convierte una fila ya parseada y validada del Excel en un Trip de dominio,
// listo para createTrip (mismo pipeline que el wizard). La agencia y el
// solicitante salen de la identidad del usuario logueado: el Excel no los trae.
export function excelRowToTrip(r: ExcelRow, agc: string, solicitante: string): Trip {
  const passengers = r.passengers.length
    ? r.passengers.map((nombre, i) => ({
        ...splitName(nombre),
        // Teléfonos alineados por posición con los pasajeros.
        phone: r.phones?.[i] ?? "",
      }))
    : [{ firstName: "", lastName: "", phone: r.phones?.[0] ?? "" }];

  const legs = (r.legs.length
    ? r.legs
    : [{ origin: "", destination: "", type: "otro" as LegType }]
  ).map((l) => ({
    type: l.type ?? ("otro" as LegType),
    origin: l.origin,
    destination: l.destination,
    flight: l.flight ?? "",
    obs: "",
    ...("originCoords" in l && l.originCoords ? { originCoords: l.originCoords } : {}),
    ...("destinationCoords" in l && l.destinationCoords
      ? { destinationCoords: l.destinationCoords }
      : {}),
  }));

  return {
    id: "RX-NEW",
    date: r.date,
    time: r.time,
    pax: passengers.length,
    cat: r.cat,
    ori: legs[0]?.origin ?? "",
    dst: legs[legs.length - 1]?.destination ?? "",
    est: "PENDIENTE",
    agc,
    ref: "",
    obs: r.obs ?? "",
    unit: "",
    passengers,
    legs,
    costs: { total: 0, viaje: 0, espera: 0, peajes: 0, estacionamiento: 0, otros: 0 },
    history: [],
    solicitante,
  };
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
  // Pasajeros y tramos viajan dentro del mismo POST: el backend crea las Personas
  // (fijando el principal) y los tramos en una sola llamada.
  const payload = buildViajePayload(trip, catalogs, {
    includeEstado: false,
    includePasajeros: true,
  });
  const tramos = buildTramosInput(trip);
  if (tramos.length) payload.tramos = tramos;
  const created = await request<Viaje>("/viajes/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  // Las personas recién creadas por el backend no están en el cache; lo
  // invalidamos para que getTrip resuelva los nombres.
  invalidateCatalogs();
  return getTrip(String(created.id));
}

export async function updateTrip(trip: Trip): Promise<Trip> {
  const catalogs = await loadCatalogs();
  // En la modificación viaje, tramos y pasajeros van separados: PATCH del viaje
  // (solo sus campos) + sync de tramos (/tramos/) + sync de pasajeros
  // (/pasajeros-viaje/). El backend ya no acepta el principal embebido acá.
  const payload = buildViajePayload(trip, catalogs, { includeEstado: true });
  const updated = await request<Viaje>(`/viajes/${trip.id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  await syncTramos(trip, updated.id, updated.tramos);
  await syncPasajeros(trip, updated.id, updated.pasajeros ?? []);
  // Pudo haberse creado/editado/quitado alguna Persona: refrescamos el cache.
  invalidateCatalogs();
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

// Sincroniza los tramos del viaje con los del Trip editado. Actualiza in-place
// los que ya existen (PATCH), crea los nuevos (POST, sin numero_tramo: lo asigna
// el backend) y elimina los sobrantes (DELETE). Evitamos el viejo enfoque de
// borrar-todo-y-recrear porque el backend protege el tramo principal y el último:
// ese DELETE fallaba y hacía abortar todo el guardado.
async function syncTramos(trip: Trip, viajeId: number, existing: Tramo[]): Promise<void> {
  const bodies = buildTramosInput(trip);
  const current = [...existing].sort((a, b) => a.numero_tramo - b.numero_tramo);
  for (let i = 0; i < bodies.length; i++) {
    const tramo = current[i];
    if (tramo) {
      await request<Tramo>(`/tramos/${tramo.id}/`, {
        method: "PATCH",
        body: JSON.stringify(bodies[i]),
      });
    } else {
      await request<Tramo>("/tramos/", {
        method: "POST",
        body: JSON.stringify({ viaje: viajeId, ...bodies[i] }),
      });
    }
  }
  // Elimina los tramos que sobran cuando el viaje pasó a tener menos destinos
  // (siempre desde el final: nunca toca el tramo principal mientras quede ≥1).
  for (let i = bodies.length; i < current.length; i++) {
    await request<void>(`/tramos/${current[i].id}/`, { method: "DELETE" });
  }
}

// Sincroniza los pasajeros del viaje con los del Trip editado, vía
// /pasajeros-viaje/. El modelo de dominio no guarda el id del vínculo, así que
// emparejamos por nombre (normalizado) contra los pasajeros que el backend
// devolvió: los que coinciden se editan (PATCH) si cambió teléfono/email/
// principal, los nuevos se asocian (POST) y los que ya no están se desasocian
// (DELETE). Orden: primero borrar, luego degradar el principal viejo (es_principal
// false antes que true, para no tener dos principales a la vez) y por último crear.
async function syncPasajeros(
  trip: Trip,
  viajeId: number,
  existing: PasajeroRead[],
): Promise<void> {
  const norm = (s: string) => s.trim().toLowerCase();
  const desired = trip.passengers
    .map((p, i) => ({
      nombre: `${p.firstName} ${p.lastName}`.trim(),
      telefono: p.phone ?? "",
      email: p.email ?? "",
      es_principal: i === 0,
    }))
    .filter((d) => d.nombre);

  const matched = new Set<number>();
  const deletes: number[] = [];
  const patches: { id: number; body: Partial<ViajePersonaWrite> }[] = [];
  const posts: ViajePersonaWrite[] = [];

  for (const d of desired) {
    const e = existing.find((x) => !matched.has(x.id) && norm(x.nombre) === norm(d.nombre));
    if (e) {
      matched.add(e.id);
      const body: Partial<ViajePersonaWrite> = {};
      if ((e.telefono ?? "") !== d.telefono) body.telefono = d.telefono;
      if ((e.email ?? "") !== d.email) body.email = d.email || null;
      if (e.es_principal !== d.es_principal) body.es_principal = d.es_principal;
      if (Object.keys(body).length) patches.push({ id: e.id, body });
    } else {
      posts.push({
        viaje: viajeId,
        nombre: d.nombre,
        ...(d.telefono ? { telefono: d.telefono } : {}),
        ...(d.email ? { email: d.email } : {}),
        es_principal: d.es_principal,
      });
    }
  }
  for (const e of existing) if (!matched.has(e.id)) deletes.push(e.id);

  for (const id of deletes) {
    await request<void>(`/pasajeros-viaje/${id}/`, { method: "DELETE" });
  }
  patches.sort(
    (a, b) => Number(a.body.es_principal ?? false) - Number(b.body.es_principal ?? false),
  );
  for (const p of patches) {
    await request<void>(`/pasajeros-viaje/${p.id}/`, {
      method: "PATCH",
      body: JSON.stringify(p.body),
    });
  }
  for (const body of posts) {
    await request<void>("/pasajeros-viaje/", { method: "POST", body: JSON.stringify(body) });
  }
}
