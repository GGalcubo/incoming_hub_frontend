// Capa de traducción entre el modelo de dominio del frontend (`Trip`) y el
// esquema del backend (`Viaje` + catálogos). Toda la lógica de red de viajes
// vive acá; client.ts solo expone la fachada que consumen las vistas.

import type {
  ExcelRow,
  Leg,
  LegType,
  Trip,
  TripCosts,
  TripStatus,
  TripTarifa,
} from "../types/domain";
import type {
  Agencia,
  CategoriaServicio,
  CostoViaje,
  CostoViajePatch,
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
import { ApiError, drfErrorMessage, fetchAll, request } from "./http";
import { patchCostos, setTramoTarifa } from "./tarifario";

// ── Estados ────────────────────────────────────────────────────────────────
// El backend expone `estado` como entero. Este mapeo sigue el orden del catálogo
// de producto (data/catalogos STATUSES). Si el backend usa otros IDs, ajustar solo
// esta tabla.
//
// PENDIENTE: el backend YA publica el catálogo real en `GET /estados/`
// (`{ id, codigo, nombre, color, es_final, visible_agencia }`, 15 códigos: NUE,
// PRE, ASI, CON, PRO, FIN, CER, ELI, CAN, NSH, MOD, CXL, CLX, REV, WEB). Hay que
// migrar a él: acá cualquier id fuera de 1–9 cae silenciosamente a PENDIENTE.
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
// NO incluye personas: los pasajeros de un viaje vienen embebidos en la lectura
// (`viaje.pasajeros`) y la vista /pasajeros pagina contra /personas/, así que no
// hace falta traerse el padrón completo al arrancar.
export interface Catalogs {
  agencies: Agencia[];
  categorias: CategoriaServicio[];
  solicitantes: Solicitante[];
}

let catalogsPromise: Promise<Catalogs> | null = null;

export function loadCatalogs(): Promise<Catalogs> {
  if (!catalogsPromise) {
    catalogsPromise = Promise.all([
      fetchAll<Agencia>("/agencies/"),
      fetchAll<CategoriaServicio>("/services/"),
      fetchAll<Solicitante>("/agencies/solicitantes/"),
    ])
      .then(([agencies, categorias, solicitantes]) => ({
        agencies,
        categorias,
        solicitantes,
      }))
      .catch((err) => {
        catalogsPromise = null; // permite reintentar tras un fallo
        throw err;
      });
  }
  return catalogsPromise;
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
  // Consulta SOLO /agencies/ (no loadCatalogs(), que arrastraría además todos los
  // solicitantes).
  const agencies = await fetchAll<Agencia>("/agencies/");
  return agencies
    .filter((a) => a.activo)
    .map((a) => ({ id: a.id, nombre: agencyName(a) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Acceso a la vista de pasajeros según el rol: el admin ve todas las agencias y
// puede filtrar libremente; el no-admin queda restringido a su propia agencia.
// La agencia propia se infiere cruzando el email del perfil con los solicitantes,
// igual que loadWizardIdentity. PENDIENTE: `/auth/me/` ya devuelve `agencia`
// resuelta, así que esta inferencia (y su fetchAll de solicitantes) sobra.
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
// catálogo de solicitantes. PENDIENTE: `/auth/me/` ya devuelve `agencia` resuelta;
// el cruce por email solo hace falta para `ownSolicitante`.
export interface WizardIdentity {
  agencies: string[];
  ownAgency: string | null;
  // Nombre del usuario logueado TAL COMO figura en el catálogo de solicitantes.
  // Es el que hay que usar como default: el nombre de /auth/me/ puede no coincidir
  // y entonces no se podría resolver el id al guardar.
  ownSolicitante: string | null;
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

  return {
    agencies,
    ownAgency: ag ? agencyName(ag) : null,
    ownSolicitante: mySol?.nombre ?? null,
    solicitantesByAgency,
  };
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

// Monto para el backend: decimal con 2 lugares (patrón ^-?\d{0,8}(?:\.\d{0,2})?$).
function money(n: number): string {
  return (Math.round((Number.isFinite(n) ? n : 0) * 100) / 100).toFixed(2);
}

// Texto visible de un extremo del tramo. Combina nombre del lugar + dirección
// ("Obelisco, Av. 9 de Julio") cuando el backend los devuelve por separado, sin
// repetir si uno ya contiene al otro. Si faltan (tramos viejos guardados solo con
// coordenadas), cae a la localidad que resolvió el backend y, como último
// recurso, a las coordenadas (así el campo nunca queda vacío y el tramo no se
// pierde al editar).
function placeOf(
  direccion: string,
  lugar: string,
  localidad?: string,
  coords?: { lat: number; lng: number },
): string {
  const name = lugar?.trim() ?? "";
  const addr = direccion?.trim() ?? "";
  let combined = "";
  if (name && addr) {
    combined = addr.includes(name) ? addr : name.includes(addr) ? name : `${name}, ${addr}`;
  } else {
    combined = name || addr;
  }
  return (
    combined ||
    localidad ||
    (coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "")
  );
}

// ── Viaje → Trip ──────────────────────────────────────────────────────────────
export function viajeToTrip(v: Viaje, c: Catalogs): Trip {
  const agencia = c.agencies.find((a) => a.id === v.agencia);
  const categoria = c.categorias.find((x) => x.id === v.categoria_servicio);
  const solicitante = c.solicitantes.find((s) => s.id === v.solicitante);

  const tramos = [...(v.tramos ?? [])].sort((a, b) => a.numero_tramo - b.numero_tramo);
  // La tarifa del viaje se guarda en el tramo principal (ver buildTramosInput).
  const tarifaId = tramos[0]?.tarifa ?? undefined;
  // Horas a disposición: el backend las guarda con el costo. > 0 ⇒ el viaje se
  // tarifó por horas, no por traslado. En el front las carga (y las edita) el
  // primer destino, así que se las devolvemos a ese tramo.
  const horasDispo = v.costo?.horas_disponibles ?? 0;
  const legs = tramos.map((tr, i) => {
    const originCoords = coordsOf(tr.origen_latitud, tr.origen_longitud);
    const destinationCoords = coordsOf(tr.destino_latitud, tr.destino_longitud);
    return {
      type: i === 0 ? TIPO_TO_LEG[v.tipo_servicio] : ("otro" as LegType),
      origin: placeOf(
        tr.origen_direccion,
        tr.origen_lugar_nombre,
        tr.localidad_origen_central,
        originCoords,
      ),
      destination: placeOf(
        tr.destino_direccion,
        tr.destino_lugar_nombre,
        tr.localidad_destino_central,
        destinationCoords,
      ),
      flight: i === 0 ? v.datos_vuelo : "",
      obs: "",
      ...(i === 0 && horasDispo > 0 ? { hours: horasDispo } : {}),
      // Guardamos el desglose que devuelve el backend para poder reenviarlo tal
      // cual si el usuario edita el viaje sin volver a tocar este extremo.
      ...(tr.origen_lugar_nombre ? { originName: tr.origen_lugar_nombre } : {}),
      ...(tr.origen_direccion ? { originAddress: tr.origen_direccion } : {}),
      ...(tr.destino_lugar_nombre ? { destinationName: tr.destino_lugar_nombre } : {}),
      ...(tr.destino_direccion ? { destinationAddress: tr.destino_direccion } : {}),
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
      ...(horasDispo > 0 ? { hours: horasDispo } : {}),
    });
  }

  // Los pasajeros vienen embebidos en el viaje (`v.pasajeros`) con nombre,
  // teléfono y email ya resueltos por el backend. Ordenamos el principal primero.
  // Es la única fuente: el backend ya no expone `pasajero_principal` en el viaje
  // ni `pasajeros_tramo` en el tramo (antes había un fallback por catálogo).
  const passengers = [...(v.pasajeros ?? [])]
    .sort((a, b) => Number(b.es_principal) - Number(a.es_principal))
    .map((p) => ({ ...splitName(p.nombre), phone: p.telefono ?? "", email: p.email ?? undefined }));

  if (passengers.length === 0)
    passengers.push({ firstName: "", lastName: "", phone: "", email: undefined });

  const costs = costoToTripCosts(v.costo);
  const tarifa: TripTarifa | undefined =
    tarifaId != null || horasDispo > 0
      ? {
          ...(tarifaId != null ? { tarifaId } : {}),
          ...(horasDispo > 0 ? { modalidad: "horas" as const, horas: horasDispo } : {}),
        }
      : undefined;

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
    // El proveedor lo asigna el backend con el viaje (antes vivía en un overlay
    // local). Se guarda como string porque es la clave de scoping del front.
    ...(v.proveedor ? { proveedorId: String(v.proveedor.id) } : {}),
    // La tarifa del viaje es la del tramo principal: es la que le da la base al
    // costo. La ruta no la guarda el backend; el paso Tarifa la reconstruye a
    // partir de esta tarifa.
    ...(tarifa ? { tarifa } : {}),
  };
}

// CostoViaje (dos columnas del backend) → TripCosts (modelo del front). Los
// totales vienen calculados por el backend; `esperaMin` no se persiste (el
// backend guarda el monto, no los minutos) y lo deriva la vista de costos.
//
// Horas a disposición: el backend guarda la base PLANA (la tarifa del tramo) y
// las horas aparte, pero la regla de negocio del front es que en esa modalidad la
// tarifa es el valor de la hora y se cobra horas × tarifa (es lo que cotiza el
// wizard). Como la base no es escribible desde el front (ver CostoViajePatch), la
// multiplicación se rehace acá al leer, y con ella los totales: así el viaje
// guardado muestra lo mismo que la cotización. Si algún día el backend multiplica,
// hay que sacar esto de una pieza o los montos quedan al cuadrado.
function costoToTripCosts(costo: CostoViaje | null): TripCosts {
  if (!costo) {
    return { total: 0, viaje: 0, espera: 0, peajes: 0, estacionamiento: 0, otros: 0 };
  }
  const horas = costo.horas_disponibles > 0 ? costo.horas_disponibles : 1;
  const viaje = +(num(costo.costo_viaje_cliente) * horas).toFixed(2);
  const tarifaProveedor = +(num(costo.costo_viaje_proveedor) * horas).toFixed(2);
  const espera = num(costo.costo_espera_cliente);
  const peajes = num(costo.costo_peajes_cliente);
  const estacionamiento = num(costo.costo_estacionamiento_cliente);
  const otros = num(costo.costo_otros_cliente);
  const esperaProveedor = num(costo.costo_espera_proveedor);
  const peajesProveedor = num(costo.costo_peajes_proveedor);
  const estacionamientoProveedor = num(costo.costo_estacionamiento_proveedor);
  const otrosProveedor = num(costo.costo_otros_proveedor);
  return {
    // Con horas a disposición el total del backend quedó armado con la base
    // plana: se rehace con la base multiplicada.
    total:
      horas > 1
        ? +(viaje + espera + peajes + estacionamiento + otros).toFixed(2)
        : num(costo.costo_total_cliente),
    viaje,
    espera,
    peajes,
    estacionamiento,
    otros,
    totalProveedor:
      horas > 1
        ? +(
            tarifaProveedor +
            esperaProveedor +
            peajesProveedor +
            estacionamientoProveedor +
            otrosProveedor
          ).toFixed(2)
        : num(costo.costo_total_proveedor),
    tarifaProveedor,
    esperaProveedor,
    peajesProveedor,
    estacionamientoProveedor,
    otrosProveedor,
    moneda: costo.moneda_cliente || costo.moneda_proveedor || undefined,
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

// El solicitante del viaje es quien lo generó y se guarda en el backend (hasta
// ahora no se mandaba nunca: el viaje quedaba con `solicitante: null` y el paso 1
// lo rellenaba con el usuario que estuviera abriendo el viaje). Se busca por
// nombre dentro de la agencia del viaje; si no se puede resolver devuelve null y
// el campo no se toca (mejor dejarlo como está que pisarlo con un id equivocado).
function resolveSolicitante(t: Trip, c: Catalogs, agencia: number): number | null {
  const target = (t.solicitante ?? "").trim().toLowerCase();
  if (!target) return null;
  const inAgency = c.solicitantes.find(
    (s) => s.agencia === agencia && s.nombre.trim().toLowerCase() === target,
  );
  return inAgency?.id ?? null;
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

// Un destino del wizard (Leg) → tramo del backend. Origen y destino van en el
// mismo objeto; cada par lat/lng se incluye solo si está completo (el backend
// rechaza una coordenada suelta). Además de las coordenadas se manda el texto del
// lugar elegido en el autocomplete, desglosado: el nombre del lugar como
// lugar_nombre y la dirección como direccion. Si el punto se marcó a mano o en el
// mapa (sin desglose), cae al texto visible del campo en ambos. Así, al modificar
// el viaje, se recupera nombre y dirección en vez de las coordenadas crudas.
function buildTramoInput(l: Leg): TramoInput {
  const t: TramoInput = {};
  const oLat = fmtCoord(l.originCoords?.lat);
  const oLng = fmtCoord(l.originCoords?.lng);
  const dLat = fmtCoord(l.destinationCoords?.lat);
  const dLng = fmtCoord(l.destinationCoords?.lng);
  const oName = l.originName?.trim() || l.origin?.trim();
  const oAddr = l.originAddress?.trim() || l.origin?.trim();
  const dName = l.destinationName?.trim() || l.destination?.trim();
  const dAddr = l.destinationAddress?.trim() || l.destination?.trim();
  if (oLat && oLng) {
    t.origen_latitud = oLat;
    t.origen_longitud = oLng;
  }
  if (oName) t.origen_lugar_nombre = oName;
  if (oAddr) t.origen_direccion = oAddr;
  if (dLat && dLng) {
    t.destino_latitud = dLat;
    t.destino_longitud = dLng;
  }
  if (dName) t.destino_lugar_nombre = dName;
  if (dAddr) t.destino_direccion = dAddr;
  return t;
}

// Tramos a enviar: un objeto por destino con datos (origen o destino). El orden
// define el numero_tramo; el primero es el principal. Un tramo cuenta si tiene
// texto O coordenadas: en edición el texto puede venir vacío del backend y
// descartar esos tramos disparaba un DELETE de todo (incluido el principal).
//
// La tarifa elegida en el paso Tarifa se cuelga SOLO del tramo principal: el
// backend suma la tarifa de cada tramo al costo del viaje, y el wizard cotiza
// una única ruta (primer origen → último destino) para todo el viaje. Ponerla en
// todos los tramos multiplicaría el costo.
function buildTramosInput(t: Trip): TramoInput[] {
  const bodies = t.legs
    .filter((l) => l.origin || l.destination || l.originCoords || l.destinationCoords)
    .map(buildTramoInput);
  const tarifa = t.tarifa?.tarifaId;
  if (bodies.length && tarifa != null) bodies[0].tarifa = tarifa;
  return bodies;
}

// Id numérico del proveedor del viaje. El dominio lo guarda como string; es el
// id de /auth/me/ o del viaje. Devuelve undefined si no es numérico: en ese caso
// el campo no se manda.
function proveedorId(t: Trip): number | undefined {
  const n = Number(t.proveedorId);
  return t.proveedorId && Number.isInteger(n) ? n : undefined;
}

// Cuerpo del POST de creación. Los pasajeros van embebidos: el backend los da de
// alta como Personas y fija el principal según `es_principal`. La modificación NO
// pasa por acá: usa diffViajePatch + syncTramos + syncPasajeros (PATCH por pestaña).
export function buildViajePayload(t: Trip, c: Catalogs): ViajeWrite {
  const agencia = resolveAgencia(t, c);
  const firstLeg = t.legs[0];
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
  if (pasajeros.length) payload.pasajeros = pasajeros;
  const solicitante = resolveSolicitante(t, c, agencia);
  if (solicitante != null) payload.solicitante = solicitante;
  const proveedor = proveedorId(t);
  if (proveedor != null) payload.proveedor = proveedor;
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

// Una página de la lista de viajes. `count` es el total del filtro (todas las
// páginas), no el de esta.
export interface TripsPage {
  trips: Trip[];
  count: number;
  page: number;
  pages: number;
}

export interface TripsQuery {
  // Día a mostrar (YYYY-MM-DD). Lo filtra el SERVIDOR: antes se traían todos los
  // viajes página por página y se filtraba en el navegador, así que cada carga
  // bajaba el historial entero para mostrar un día.
  date?: string;
  page?: number;
}

// Total de páginas. Con `next` cargado, `results.length` ES el tamaño de página
// del backend (no lo publica el schema ni deja elegirlo), así que el total sale
// exacto; sin `next` estamos en la última y no hay nada más que contar.
function totalPages(data: Paginated<unknown>, page: number): number {
  if (!data.next) return page;
  return Math.max(page + 1, Math.ceil(data.count / Math.max(data.results.length, 1)));
}

export async function listTrips(q: TripsQuery = {}): Promise<TripsPage> {
  const pedida = Math.max(1, q.page ?? 1);
  const traer = async (page: number) => {
    const params = new URLSearchParams({ page: String(page) });
    if (q.date) params.set("fecha_servicio", q.date);
    return request<Paginated<Viaje>>(`/viajes/?${params}`);
  };

  const catalogs = await loadCatalogs();
  let page = pedida;
  let data: Paginated<Viaje>;
  try {
    data = await traer(page);
  } catch (e) {
    // DRF responde 404 "Invalid page" cuando la página se fue de rango (cambió
    // el día, se borraron viajes). En vez de dejar la lista vacía con un error,
    // se vuelve a la primera; quien llama se entera por el `page` devuelto.
    if (!(e instanceof ApiError && e.status === 404) || pedida === 1) throw e;
    page = 1;
    data = await traer(page);
  }
  return {
    trips: data.results.map((v) => viajeToTrip(v, catalogs)),
    count: data.count,
    page,
    pages: totalPages(data, page),
  };
}

// Cuántos viajes hay un día, para los contadores de "hoy / mañana". Se usa solo
// el `count` de la respuesta paginada: el backend no acepta `page_size`, así que
// igual manda la primera página de resultados y se descarta.
export async function countTrips(date: string): Promise<number> {
  const data = await request<Paginated<Viaje>>(`/viajes/?fecha_servicio=${date}`);
  return data.count;
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
  const payload = buildViajePayload(trip, catalogs);
  const tramos = buildTramosInput(trip);
  if (tramos.length) payload.tramos = tramos;
  const created = await request<Viaje>("/viajes/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return getTrip(String(created.id));
}

// Alta en LOTE (`POST /viajes/bulk/`), la que usa la carga por Excel. Cada viaje
// lleva el mismo payload que el alta individual más un `id_temporal` que pone el
// front (acá, el número de fila del Excel) para poder correlacionar la respuesta.
//
// Es TODO O NADA: si una fila no valida, el backend no crea ninguna y contesta
// 400 con `{ errores: [{ id_temporal, errores }] }`. Eso es lo que se devuelve
// acá fila por fila, en vez de la importación a medio hacer que dejaba el alta de
// a un viaje por vez.
interface LoteError {
  id_temporal?: string;
  errores?: unknown;
}

export async function createTripsBulk(
  items: { idTemporal: string; trip: Trip }[],
): Promise<{ creados: number; errores: { idTemporal: string; message: string }[] }> {
  if (!items.length) return { creados: 0, errores: [] };
  const catalogs = await loadCatalogs();
  const payload = items.map(({ idTemporal, trip }) => {
    const viaje = buildViajePayload(trip, catalogs);
    const tramos = buildTramosInput(trip);
    if (tramos.length) viaje.tramos = tramos;
    return { ...viaje, id_temporal: idTemporal };
  });

  try {
    // El 201 trae `{ creados: [{ id_temporal, viaje }] }`. Si algún día cambia de
    // forma, no se pierde el alta: se cuentan los que se mandaron.
    const res = await request<{ creados?: unknown[] }>("/viajes/bulk/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { creados: res?.creados?.length ?? items.length, errores: [] };
  } catch (e) {
    const body = e instanceof ApiError && e.status === 400 ? e.body : null;
    const lista = (body as { errores?: LoteError[] } | null)?.errores;
    if (!Array.isArray(lista) || !lista.length) throw e;
    return {
      creados: 0,
      errores: lista.map((item, i) => ({
        idTemporal: item.id_temporal ?? items[i]?.idTemporal ?? "",
        message: drfErrorMessage(item.errores, "No se pudo crear el viaje."),
      })),
    };
  }
}

// Campos del viaje que el wizard edita, comparados contra el estado actual del
// servidor. El PATCH de modificación lleva SOLO lo que cambió (contrato nuevo:
// cada pestaña tiene su PATCH); mandar el payload completo pisaba campos que el
// wizard no toca (valijas, obs. del chofer, horas de cancelación).
function diffViajePatch(t: Trip, c: Catalogs, current: Viaje): Partial<ViajeWrite> {
  const firstLeg = t.legs[0];
  const out: Partial<ViajeWrite> = {};

  const ref = t.ref ?? "";
  if (ref !== (current.referencia_externa ?? "")) out.referencia_externa = ref;

  const agencia = resolveAgencia(t, c);
  if (agencia !== current.agencia) out.agencia = agencia;

  // Solo se manda si se resolvió y cambió: un viaje viejo sin solicitante queda
  // como está en vez de quedar atribuido a quien lo esté editando.
  const solicitante = resolveSolicitante(t, c, agencia);
  if (solicitante != null && solicitante !== current.solicitante) out.solicitante = solicitante;

  const categoria = resolveCategoria(t, c);
  if (categoria !== current.categoria_servicio) out.categoria_servicio = categoria;

  // Proveedor asignado. Solo se manda si se pudo resolver a un id numérico y
  // cambió; nunca se limpia solo (quitarlo es una acción explícita del admin,
  // que hoy no existe en la UI).
  const proveedor = proveedorId(t);
  if (proveedor != null && proveedor !== (current.proveedor?.id ?? null)) {
    out.proveedor = proveedor;
  }

  const estado = statusToEstado(t.est);
  if (estado !== current.estado) out.estado = estado;

  if (t.date !== current.fecha_servicio) out.fecha_servicio = t.date;

  // El backend devuelve "HH:MM:SS"; el wizard maneja "HH:MM".
  if (t.time !== (current.hora_servicio ?? "").slice(0, 5)) out.hora_servicio = t.time;

  const tipo = firstLeg ? LEG_TO_TIPO[firstLeg.type] : "IN";
  if (tipo !== current.tipo_servicio) out.tipo_servicio = tipo;

  const cantidad = buildPasajerosPayload(t).length || t.pax || 1;
  if (cantidad !== current.cantidad_pasajeros) out.cantidad_pasajeros = cantidad;

  const obs = t.obs ?? "";
  if (obs !== (current.observaciones ?? "")) out.observaciones = obs;

  const vuelo = firstLeg?.flight ?? "";
  if (vuelo !== (current.datos_vuelo ?? "")) out.datos_vuelo = vuelo;

  return out;
}

export async function updateTrip(trip: Trip): Promise<Trip> {
  const catalogs = await loadCatalogs();
  // Modificación por pestaña: PATCH del viaje solo con los campos que cambiaron
  // (se omite si no cambió ninguno), tramos vía /tramos/ y pasajeros vía
  // /pasajeros-viaje/. Partimos del estado actual del servidor para diffear:
  // así editar una pestaña no genera requests (ni DELETEs) sobre las otras.
  const current = await request<Viaje>(`/viajes/${trip.id}/`);
  const changes = diffViajePatch(trip, catalogs, current);
  if (Object.keys(changes).length) {
    await request<Viaje>(`/viajes/${trip.id}/`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  }
  await syncTramos(trip, current.id, current.tramos);
  // La tarifa del tramo va ANTES que los costos: cambiarla hace que el backend
  // recalcule la base y resetee los ajustes manuales, así que si la tocamos hay
  // que reenviarlos todos (por eso el flag `force`).
  const tarifaCambio = await syncTarifaTramo(trip, current.tramos);
  await syncCostos(trip, current.id, current.costo, tarifaCambio);
  await syncPasajeros(trip, current.id, current.pasajeros ?? []);
  return getTrip(String(trip.id));
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
// true si el body trae alguna coordenada distinta a la que ya tiene el tramo.
// Compara numéricamente ("-34.60370" ≡ "-34.6037000"). Un extremo ausente en el
// body (sin coords en el wizard) no cuenta como cambio: se conserva el del server.
function tramoChanged(body: TramoInput, tr: Tramo): boolean {
  const pairs: [string | null | undefined, string | null][] = [
    [body.origen_latitud, tr.origen_latitud],
    [body.origen_longitud, tr.origen_longitud],
    [body.destino_latitud, tr.destino_latitud],
    [body.destino_longitud, tr.destino_longitud],
  ];
  const coordsChanged = pairs.some(
    ([next, prev]) => next != null && (prev == null || Number(next) !== Number(prev)),
  );
  // También cuenta como cambio el texto del lugar: si el usuario editó la
  // dirección (aunque no toque las coordenadas), hay que persistirla. Un campo
  // ausente en el body no cuenta: se conserva el del server.
  const texts: [string | undefined, string | null][] = [
    [body.origen_lugar_nombre, tr.origen_lugar_nombre],
    [body.origen_direccion, tr.origen_direccion],
    [body.destino_lugar_nombre, tr.destino_lugar_nombre],
    [body.destino_direccion, tr.destino_direccion],
  ];
  const textChanged = texts.some(
    ([next, prev]) => next != null && next !== (prev ?? ""),
  );
  return coordsChanged || textChanged;
}

async function syncTramos(trip: Trip, viajeId: number, existing: Tramo[]): Promise<void> {
  const bodies = buildTramosInput(trip);
  const current = [...existing].sort((a, b) => a.numero_tramo - b.numero_tramo);
  for (let i = 0; i < bodies.length; i++) {
    const tramo = current[i];
    if (tramo) {
      if (!tramoChanged(bodies[i], tramo)) continue;
      // La tarifa no se toca acá (es de solo lectura en este endpoint): tiene el
      // suyo propio, ver syncTarifaTramo.
      const body = { ...bodies[i] };
      delete body.tarifa;
      await request<Tramo>(`/tramos/${tramo.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
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

// Cambia la tarifa del tramo principal cuando el paso Tarifa eligió otra. Va por
// el endpoint dedicado (/tramos/{id}/tarifa/) porque en el PATCH normal del
// tramo la tarifa es de solo lectura. Devuelve true si hubo cambio: el backend
// recalcula la base del costo y resetea los ajustes manuales.
// Si el tramo principal todavía no existe (viaje sin tramos) no hay dónde
// colgarla: la tarifa viaja en el POST del tramo (ver buildTramosInput).
async function syncTarifaTramo(trip: Trip, existing: Tramo[]): Promise<boolean> {
  const principal = [...existing].sort((a, b) => a.numero_tramo - b.numero_tramo)[0];
  const next = trip.tarifa?.tarifaId;
  if (!principal || next == null || next === principal.tarifa) return false;
  await setTramoTarifa(principal.id, next);
  return true;
}

// Ajustes manuales de los costos (espera, peajes, estacionamiento, otros de las
// dos columnas, moneda y horas a disposición). Los totales no se mandan: los
// calcula el backend. La base tampoco, salvo que la hayan escrito a mano (ver
// abajo): normalmente sale de la tarifa del tramo.
//
// Solo viajan los rubros que cambiaron contra el estado del servidor, así una
// edición del proveedor no toca los montos del cliente (ni al revés).
function diffCostosPatch(t: Trip, current: CostoViaje | null, force: boolean): CostoViajePatch {
  const c = t.costs;
  const out: CostoViajePatch = {};
  // Rubros manuales (decimales) de las dos columnas.
  type CampoMonto =
    | "costo_espera_cliente"
    | "costo_peajes_cliente"
    | "costo_estacionamiento_cliente"
    | "costo_otros_cliente"
    | "costo_espera_proveedor"
    | "costo_peajes_proveedor"
    | "costo_estacionamiento_proveedor"
    | "costo_otros_proveedor";
  const montos: { campo: CampoMonto; valor: number }[] = [
    { campo: "costo_espera_cliente", valor: c.espera ?? 0 },
    { campo: "costo_peajes_cliente", valor: c.peajes ?? 0 },
    { campo: "costo_estacionamiento_cliente", valor: c.estacionamiento ?? 0 },
    { campo: "costo_otros_cliente", valor: c.otros ?? 0 },
    { campo: "costo_espera_proveedor", valor: c.esperaProveedor ?? 0 },
    { campo: "costo_peajes_proveedor", valor: c.peajesProveedor ?? 0 },
    { campo: "costo_estacionamiento_proveedor", valor: c.estacionamientoProveedor ?? 0 },
    { campo: "costo_otros_proveedor", valor: c.otrosProveedor ?? 0 },
  ];
  // Sin registro de costos todavía (el PATCH lo crea) solo mandamos lo que tenga
  // algún valor: si no, editar cualquier viaje sin costos generaría uno en cero.
  const cambio = (previo: string | undefined, valor: number) =>
    force || (current ? num(previo) !== valor : valor !== 0);

  for (const { campo, valor } of montos) {
    if (cambio(current?.[campo], valor)) out[campo] = money(valor);
  }
  if (c.moneda) {
    if (force || (current?.moneda_cliente ?? "") !== c.moneda) out.moneda_cliente = c.moneda;
    if (force || (current?.moneda_proveedor ?? "") !== c.moneda) out.moneda_proveedor = c.moneda;
  }
  // Horas a disposición: 0 cuando el viaje se tarifó por traslado.
  const horas =
    t.tarifa?.modalidad === "horas" ? Math.max(0, Math.round(t.tarifa.horas ?? 0)) : 0;
  if (force || (current ? current.horas_disponibles !== horas : horas !== 0)) {
    out.horas_disponibles = horas;
  }

  // Base escrita a mano en el paso Costos: es la única que viaja, y va SIN el
  // `force` (que existe para reenviar los ajustes después de cambiar la tarifa).
  // Un monto que sale del tarifario lo calcula el servidor y no tiene sentido
  // pisárselo con la previsualización del wizard.
  //
  // El front guarda la base ya multiplicada por las horas a disposición y el
  // backend la guarda plana (ver costoToTripCosts), así que se divide al mandar.
  // Con horas > 1 el redondeo a dos decimales puede correr algún centavo al
  // releer el viaje.
  if (c.viajeManual) {
    const porHora = horas > 0 ? horas : 1;
    const base: { campo: "costo_viaje_cliente" | "costo_viaje_proveedor"; valor: number }[] = [
      { campo: "costo_viaje_cliente", valor: +(c.viaje / porHora).toFixed(2) },
      { campo: "costo_viaje_proveedor", valor: +((c.tarifaProveedor ?? 0) / porHora).toFixed(2) },
    ];
    for (const { campo, valor } of base) {
      if (current ? num(current[campo]) !== valor : valor !== 0) out[campo] = money(valor);
    }
  }
  return out;
}

async function syncCostos(
  trip: Trip,
  viajeId: number,
  current: CostoViaje | null,
  force: boolean,
): Promise<void> {
  const patch = diffCostosPatch(trip, current, force);
  if (!Object.keys(patch).length) return;
  await patchCostos(viajeId, patch);
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
