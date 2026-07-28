import type { MeProfile, MeWrite, Paginated, Persona, RoleEnum } from "./backend";
import type { PassengersAccess, PersonasQuery } from "./viajes";
import { AGENCIES, CATEGORIES, SEED_TRIPS } from "../data/seed";
import { decodeJwt, mockJwt } from "../lib/jwt";
import type { ExcelRow, Trip, TripComentario, TripStatus, User } from "../types/domain";
import type {
  CategoriaTarifada,
  Cliente,
  Proveedor,
  TarifaBase,
  TarifaBaseInput,
  TarifaCliente,
  TarifaClienteExtras,
  TarifaClienteInput,
  TarifaExtras,
} from "../types/tarifas";
import * as comentarios from "./comentarios";
import { drfErrorMessage, request, safeFetch, setOnUnauthorized, VIAJES_BASE } from "./http";
import * as proveedores from "./proveedores";
import * as tarifario from "./tarifario";
import * as tarifas from "./tarifas";
import * as tarifasCliente from "./tarifasCliente";
import * as viajes from "./viajes";

export { setOnUnauthorized };

// ── Cotización de la ruta (paso "Tarifa" del wizard) ─────────────────────────
// Una tarifa ofrecida para la ruta elegida: la categoría de vehículo con su
// precio de las dos columnas y el proveedor dueño del tarifario. `tarifaId` es el
// id del backend: es lo que se guarda en el tramo del viaje y lo que define su
// costo. Sin backend real queda sin definir (el mock no tiene ids de tarifa).
export interface TarifaOpcion {
  tarifaId?: number;
  proveedorId: string;
  proveedorNombre: string;
  codigo: string; // código de la categoría (STD/EJE/VVIP/VAN)
  nombre: string;
  vehiculo: string;
  precioCliente: number | null;
  precioProveedor: number | null;
  moneda: string;
}

export interface CotizacionRuta {
  // Proveedores con tarifa para la ruta (los que puede elegir el admin).
  proveedores: Proveedor[];
  opciones: TarifaOpcion[];
  // Mensaje del backend cuando no hay tarifa vigente para el tramo.
  detalle: string;
}

// Identidad que consume el wizard para los dropdowns de agencia y solicitante.
export interface WizardIdentity {
  agencies: string[];
  ownAgency: string | null;
  solicitante: string;
  isAdmin: boolean;
  // Solicitantes disponibles por agencia (el admin puede elegir uno).
  solicitantesByAgency: Record<string, string[]>;
}

const AUTH_URL = (import.meta.env.VITE_AUTH_URL as string | undefined) ?? "";
const USE_AUTH_MOCK = !AUTH_URL;
// Los viajes (y el guardado de la carga por Excel) usan el backend real si hay
// base (VITE_API_URL o, por defecto, el de auth); si no, quedan en mock local.
const USE_VIAJES_MOCK = !VIAJES_BASE;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Persistimos los viajes mock en localStorage para que sobrevivan a un refresh
// del navegador. Sin esto, cada recarga reinicia al seed y "se pierde" lo guardado.
const MOCK_TRIPS_KEY = "proxy:mockTrips";

function loadMockTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(MOCK_TRIPS_KEY);
    if (raw) return JSON.parse(raw) as Trip[];
  } catch {
    /* almacenamiento no disponible o dato inválido */
  }
  return [...SEED_TRIPS];
}

function saveMockTrips() {
  try {
    localStorage.setItem(MOCK_TRIPS_KEY, JSON.stringify(mockTrips));
  } catch {
    /* ignore */
  }
}

let mockTrips: Trip[] = loadMockTrips();

const MOCK_ME_KEY = "proxy:mockMe";

// Sin backend de auth, derivamos el rol del username para poder probar cada rol:
// "prov…" → proveedor, "agen…"/"cliente…"/"oper…" → operador de agencia, resto → admin.
function mockRoleFromUsername(username: string): RoleEnum {
  const u = username.trim().toLowerCase();
  if (u.startsWith("prov")) return "proveedor";
  if (u.startsWith("agen") || u.startsWith("cliente") || u.startsWith("oper")) {
    return "agency_operator";
  }
  return "admin";
}

function loadMockMe(): MeProfile {
  let username = "usuario";
  try {
    const raw = localStorage.getItem("proxy:user");
    if (raw) username = (JSON.parse(raw) as Partial<User>).user ?? username;
  } catch {
    /* sin sesión */
  }
  const defaults: MeProfile = {
    id: 0,
    username,
    email: "",
    first_name: "",
    last_name: "",
    role: mockRoleFromUsername(username),
    phone: "",
  };
  try {
    const raw = localStorage.getItem(MOCK_ME_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<MeProfile>), username };
  } catch {
    return defaults;
  }
}

function saveMockMe(me: MeProfile) {
  try {
    localStorage.setItem(MOCK_ME_KEY, JSON.stringify(me));
  } catch {
    /* ignore */
  }
}

const MOCK_PERSONAS_PAGE_SIZE = 20;

// Deriva un catálogo de personas (mock) a partir de los pasajeros de los viajes
// seed, deduplicado por nombre. Solo se usa cuando no hay backend real.
function mockPersonas(): Persona[] {
  const byName = new Map<string, Persona>();
  let id = 1;
  for (const t of mockTrips) {
    const agIdx = AGENCIES.indexOf(t.agc);
    for (const p of t.passengers) {
      const nombre = `${p.firstName} ${p.lastName}`.trim();
      if (!nombre || byName.has(nombre.toLowerCase())) continue;
      byName.set(nombre.toLowerCase(), {
        id: id++,
        agencia: agIdx >= 0 ? agIdx + 1 : 0,
        nombre,
        telefono: p.phone ?? "",
        dni: null,
        email: p.email ?? null,
        fecha_creacion: t.date,
      });
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ── Overlay de proveedor (solo modo mock) ────────────────────────────────────
// El backend real ya devuelve el proveedor con el viaje (`viaje.proveedor`), así
// que estas dos funciones solo actúan cuando el viaje viene SIN proveedor: es el
// caso del mock, donde la asignación se guarda en localStorage por id de viaje.
function withProveedor(t: Trip): Trip {
  if (t.proveedorId) return t;
  const asignado = proveedores.loadAsignaciones()[t.id];
  return asignado ? { ...t, proveedorId: asignado } : t;
}

function persistProveedor(t: Trip): Trip {
  if (!USE_VIAJES_MOCK) return t;
  proveedores.setAsignacion(t.id, t.proveedorId);
  return t;
}

function buildUser(user: string, token: string, refresh?: string): User {
  const payload = decodeJwt(token);
  return { user, token, refresh, exp: payload?.exp };
}

export const api = {
  async login(user: string, pass: string): Promise<User> {
    if (USE_AUTH_MOCK) {
      await wait(400);
      if (!user || !pass) throw new Error("Usuario y contraseña requeridos");
      return buildUser(user, mockJwt(user));
    }
    const res = await safeFetch(`${AUTH_URL}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        /* respuesta sin cuerpo JSON */
      }
      throw new Error(drfErrorMessage(body, "Credenciales inválidas"));
    }
    const data = (await res.json()) as { access: string; refresh?: string };
    return buildUser(user, data.access, data.refresh);
  },

  async getMe(): Promise<MeProfile> {
    if (USE_AUTH_MOCK) {
      await wait(150);
      return loadMockMe();
    }
    return request<MeProfile>("/auth/me/");
  },

  async updateMe(patch: MeWrite): Promise<MeProfile> {
    if (USE_AUTH_MOCK) {
      await wait(200);
      const next = { ...loadMockMe(), ...patch } as MeProfile;
      saveMockMe(next);
      return next;
    }
    return request<MeProfile>("/auth/me/", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async listCategorias(): Promise<string[]> {
    if (USE_VIAJES_MOCK) {
      await wait(100);
      return [...CATEGORIES];
    }
    return viajes.listCategorias();
  },

  // Datos de identidad para el wizard: agencias disponibles, agencia propia del
  // usuario, su nombre como solicitante y si puede cambiar de agencia (admin).
  async getWizardIdentity(): Promise<WizardIdentity> {
    const me = await this.getMe();
    const solicitante = `${me.first_name} ${me.last_name}`.trim() || me.username;
    const isAdmin = me.role === "admin";
    if (USE_VIAJES_MOCK) {
      await wait(100);
      // Sin backend: cada agencia muestra al usuario logueado como solicitante.
      const solicitantesByAgency = Object.fromEntries(
        AGENCIES.map((a) => [a, [solicitante]]),
      );
      return {
        agencies: [...AGENCIES],
        ownAgency: AGENCIES[0] ?? null,
        solicitante,
        isAdmin,
        solicitantesByAgency,
      };
    }
    const { agencies, ownAgency, ownSolicitante, solicitantesByAgency } =
      await viajes.loadWizardIdentity(me);
    return {
      agencies,
      ownAgency,
      // Preferimos el nombre del catálogo: es el que después se puede resolver a
      // un id para guardar el solicitante en el viaje.
      solicitante: ownSolicitante ?? solicitante,
      isAdmin,
      solicitantesByAgency,
    };
  },

  // Lista de viajes ya con su proveedor. El proveedor logueado ve SOLO los que
  // tiene asignados: es el mismo recorte que después habilita la edición de
  // costos. (Con backend real esto sigue siendo un filtro de front: el scoping
  // definitivo tiene que hacerlo el servidor cuando modele el proveedor.)
  async listTrips(): Promise<Trip[]> {
    const scope = proveedores.proveedorIdOf(await this.getMe().catch(() => null));
    let list: Trip[];
    if (USE_VIAJES_MOCK) {
      await wait(150);
      list = [...mockTrips];
    } else {
      list = await viajes.listTrips();
    }
    const conProveedor = list.map(withProveedor);
    return scope ? conProveedor.filter((t) => t.proveedorId === scope) : conProveedor;
  },

  // Catálogo de proveedores (para asignar el viaje y elegir tarifario).
  async listProveedores(): Promise<Proveedor[]> {
    return proveedores.listProveedores(await this.getMe().catch(() => null));
  },

  // Una página del catálogo de pasajeros (búsqueda/filtro/paginación server-side).
  async listPersonas(q: PersonasQuery): Promise<Paginated<Persona>> {
    if (USE_VIAJES_MOCK) {
      await wait(150);
      let all = mockPersonas();
      if (q.agencia != null) all = all.filter((p) => p.agencia === q.agencia);
      const s = q.search?.trim().toLowerCase();
      if (s) {
        all = all.filter(
          (p) =>
            p.nombre.toLowerCase().includes(s) ||
            (p.telefono ?? "").toLowerCase().includes(s) ||
            (p.email ?? "").toLowerCase().includes(s),
        );
      }
      const page = q.page ?? 1;
      const start = (page - 1) * MOCK_PERSONAS_PAGE_SIZE;
      const results = all.slice(start, start + MOCK_PERSONAS_PAGE_SIZE);
      const hasNext = start + MOCK_PERSONAS_PAGE_SIZE < all.length;
      return {
        count: all.length,
        next: hasNext ? `mock?page=${page + 1}` : null,
        previous: page > 1 ? `mock?page=${page - 1}` : null,
        results,
      };
    }
    return viajes.listPersonasPage(q);
  },

  // Acceso a la vista de pasajeros según rol: agencias visibles y, si no es
  // admin, la agencia propia a la que queda restringido.
  async passengersAccess(): Promise<PassengersAccess> {
    const me = await this.getMe();
    if (USE_VIAJES_MOCK) {
      await wait(80);
      const isAdmin = me.role === "admin";
      return {
        isAdmin,
        agencies: AGENCIES.map((nombre, i) => ({ id: i + 1, nombre })),
        ownAgencyId: isAdmin ? null : 1,
      };
    }
    return viajes.loadPassengersAccess(me);
  },

  async getTrip(id: string): Promise<Trip> {
    if (USE_VIAJES_MOCK) {
      await wait(100);
      const t = mockTrips.find((x) => x.id === id);
      if (!t) throw new Error("Viaje no encontrado");
      return withProveedor(t);
    }
    return withProveedor(await viajes.getTrip(id));
  },

  async createTrip(trip: Partial<Trip>): Promise<Trip> {
    let created: Trip;
    if (USE_VIAJES_MOCK) {
      await wait(250);
      const id = "RX-0" + (8420 + mockTrips.length + 1);
      created = { ...(trip as Trip), id, est: trip.est ?? "PENDIENTE" };
      mockTrips = [created, ...mockTrips];
      saveMockTrips();
    } else {
      // El backend devuelve el viaje ya con su proveedor: no se pisa con el
      // local (podría venir vacío y borrar el que asignó el servidor).
      return viajes.createTrip(trip as Trip);
    }
    // Mock: el proveedor se guarda en el overlay contra el id ya definitivo.
    return persistProveedor({ ...created, proveedorId: trip.proveedorId });
  },

  async updateTrip(trip: Trip): Promise<Trip> {
    if (USE_VIAJES_MOCK) {
      await wait(200);
      mockTrips = mockTrips.map((t) => (t.id === trip.id ? trip : t));
      saveMockTrips();
      return persistProveedor(trip);
    }
    return viajes.updateTrip(trip);
  },

  async setStatus(id: string, est: TripStatus): Promise<Trip> {
    if (USE_VIAJES_MOCK) {
      await wait(150);
      let next: Trip | undefined;
      mockTrips = mockTrips.map((t) => (t.id === id ? (next = { ...t, est }) : t));
      if (!next) throw new Error("Viaje no encontrado");
      saveMockTrips();
      return withProveedor(next);
    }
    return withProveedor(await viajes.setStatus(id, est));
  },

  async cancelTrip(id: string, reason: string): Promise<Trip> {
    if (USE_VIAJES_MOCK) {
      await wait(200);
      const next = mockTrips.find((t) => t.id === id);
      if (!next) throw new Error("Viaje no encontrado");
      const updated: Trip = {
        ...next,
        est: "CANCELADO",
        obs: next.obs + (next.obs ? " · " : "") + "Cancelado: " + reason,
      };
      mockTrips = mockTrips.map((t) => (t.id === id ? updated : t));
      saveMockTrips();
      return withProveedor(updated);
    }
    return withProveedor(await viajes.cancelTrip(id, reason));
  },

  async deleteTrip(id: string): Promise<void> {
    proveedores.setAsignacion(id, undefined);
    if (USE_VIAJES_MOCK) {
      await wait(150);
      mockTrips = mockTrips.filter((t) => t.id !== id);
      saveMockTrips();
      return;
    }
    return viajes.deleteTrip(id);
  },

  async parseExcel(file: File): Promise<ExcelRow[]> {
    // Se parsea y valida en el browser (SheetJS), reusando el mismo dominio que
    // el wizard. Ya no hay endpoint de backend para esto. Import dinámico para
    // que SheetJS (pesado) se cargue recién al abrir el modal de Excel.
    const { parseExcelFile } = await import("../lib/excelParse");
    const rows = await parseExcelFile(file);
    // Geocodifica con Google (coords + dirección completa). Sin API key, deja el
    // texto del Excel tal cual.
    const { geocodeRows } = await import("../lib/geocode");
    return geocodeRows(rows);
  },

  // Crea los viajes seleccionados del Excel reusando createTrip (el mismo
  // pipeline que el wizard: un único POST /viajes/ con pasajeros y tramos
  // anidados). La agencia y el solicitante salen de la identidad del usuario.
  async importExcelRows(
    rows: ExcelRow[],
  ): Promise<{ count: number; errors: { row: number; message: string }[] }> {
    const identity = await this.getWizardIdentity();
    const agc = identity.ownAgency ?? identity.agencies[0] ?? "";
    const solicitante = identity.solicitante;
    let count = 0;
    const errors: { row: number; message: string }[] = [];
    for (const r of rows) {
      try {
        await this.createTrip(viajes.excelRowToTrip(r, agc, solicitante));
        count += 1;
      } catch (e) {
        errors.push({ row: r.row, message: e instanceof Error ? e.message : String(e) });
      }
    }
    return { count, errors };
  },

  // ── Comentarios del viaje ──────────────────────────────────────────────────
  // Los ve y los deja cualquier rol (es el canal para discutir diferencias de
  // costos). El autor NO lo manda la vista: se resuelve acá contra /auth/me/
  // para que nadie pueda firmar un comentario con otro nombre.
  async listComentarios(tripId: string): Promise<TripComentario[]> {
    await wait(80);
    return comentarios.listComentarios(tripId);
  },

  async addComentario(tripId: string, texto: string): Promise<TripComentario> {
    const me = await this.getMe().catch(() => null);
    const autor = me
      ? `${me.first_name} ${me.last_name}`.trim() || me.username
      : "Usuario";
    await wait(120);
    return comentarios.addComentario(tripId, { autor, rol: me?.role ?? null, texto });
  },

  // ── Tarifas ────────────────────────────────────────────────────────────────
  // El backend aún no expone tarifas: siempre van contra el mock (localStorage).
  // Cuando publique los endpoints, se cambia el cuerpo de api/tarifas.ts y esto
  // sigue igual.
  //
  // El `scope` (id del proveedor logueado, o null para admin/agencia) NO viene de
  // la vista: se resuelve acá contra /auth/me/ para que ninguna pantalla pueda
  // pedir el tarifario de otro proveedor cambiando un prop.
  async tarifaScope(): Promise<string | null> {
    return proveedores.proveedorIdOf(await this.getMe().catch(() => null));
  },
  async listTarifasBase(): Promise<TarifaBase[]> {
    return tarifas.listTarifasBase(await this.tarifaScope());
  },
  async createTarifaBase(input: TarifaBaseInput): Promise<TarifaBase> {
    return tarifas.createTarifaBase(input, await this.tarifaScope());
  },
  async updateTarifaBase(t: TarifaBase): Promise<TarifaBase> {
    return tarifas.updateTarifaBase(t, await this.tarifaScope());
  },
  async deleteTarifaBase(id: string): Promise<void> {
    return tarifas.deleteTarifaBase(id, await this.tarifaScope());
  },
  // Extras de un proveedor concreto (el del viaje, o el que eligió el admin).
  // Sin proveedor caen al tarifario general.
  getTarifasExtras(proveedorId?: string): Promise<TarifaExtras> {
    return tarifas.getTarifasExtras(proveedorId);
  },
  async updateTarifasExtras(
    patch: Partial<TarifaExtras>,
    proveedorId: string,
  ): Promise<TarifaExtras> {
    return tarifas.updateTarifasExtras(patch, proveedorId, await this.tarifaScope());
  },
  listTarifaLugares(): Promise<string[]> {
    return tarifas.listLugares();
  },
  getCategoriasTarifadas(
    origen: string,
    destino: string,
    proveedorId?: string,
  ): Promise<CategoriaTarifada[]> {
    return tarifas.getCategoriasTarifadas(origen, destino, proveedorId);
  },

  // ── Cotización de la ruta del viaje ────────────────────────────────────────
  // Con backend real sale del tarifario del servidor (/tarifarios/): las zonas
  // pueblan los selectores de origen/destino y la cotización devuelve las
  // tarifas vigentes de esa ruta, con su id (lo que después se guarda en el
  // tramo). Sin backend cae al tarifario mock, con el mismo formato.

  // Lugares tarifados con los que se arma la ruta del viaje.
  async listLugaresRuta(): Promise<string[]> {
    if (!VIAJES_BASE) return tarifas.listLugares();
    const zonas = await tarifario.listZonas();
    return Array.from(new Set(zonas.map(tarifario.zonaKey).filter(Boolean))).sort();
  },

  // Tarifas disponibles para una ruta. `proveedorId` solo lo usa el mock (su
  // tarifario es por proveedor); el backend devuelve los de todos los que tengan
  // tarifa vigente para el tramo.
  async cotizarRuta(
    origen: string,
    destino: string,
    proveedorId?: string,
  ): Promise<CotizacionRuta> {
    if (!VIAJES_BASE) {
      const [provs, cats] = await Promise.all([
        this.listProveedores(),
        tarifas.getCategoriasTarifadas(origen, destino, proveedorId),
      ]);
      const nombre = provs.find((p) => p.id === proveedorId)?.nombre ?? "";
      return {
        proveedores: provs,
        // El mock ya resuelve los precios contra el tarifario del proveedor
        // elegido: las opciones se le atribuyen a ese mismo (así el filtro por
        // proveedor del paso Tarifa las encuentra).
        opciones: cats.map((c) => ({
          proveedorId: proveedorId ?? "",
          proveedorNombre: nombre,
          codigo: c.codigo,
          nombre: c.nombre,
          vehiculo: c.vehiculo,
          precioCliente: c.tarifaCliente,
          precioProveedor: c.tarifaProveedor,
          moneda: "USD",
        })),
        detalle: "",
      };
    }
    const out = await tarifario.cotizar(origen, destino);
    return {
      proveedores: out.proveedores.map((p) => ({
        id: String(p.proveedor.id),
        nombre: p.proveedor.nombre,
      })),
      opciones: out.proveedores.flatMap(({ proveedor, tarifas: rows }) =>
        rows.map((r) => ({
          tarifaId: r.id,
          proveedorId: String(proveedor.id),
          proveedorNombre: proveedor.nombre,
          codigo: r.categoria_servicio.codigo,
          nombre: r.categoria_servicio.nombre,
          vehiculo: r.categoria_servicio.descripcion ?? "",
          precioCliente: r.precio_cliente != null ? Number(r.precio_cliente) : null,
          precioProveedor: r.precio_proveedor != null ? Number(r.precio_proveedor) : null,
          moneda: r.moneda_cliente || r.moneda_proveedor || "USD",
        })),
      ),
      detalle: out.tarifa_encontrada ? "" : out.detalle,
    };
  },

  // Ruta (códigos de zona) de una tarifa ya elegida. Se usa al reabrir un viaje:
  // del tramo solo viene el id de la tarifa, y el paso Tarifa necesita el origen
  // y el destino para volver a cotizar y marcar la selección.
  async rutaDeTarifa(tarifaId: number): Promise<{ origen: string; destino: string } | null> {
    if (!VIAJES_BASE) return null;
    const [tarifa, zonas] = await Promise.all([
      tarifario.getTarifa(tarifaId),
      tarifario.listZonas(),
    ]);
    const key = (id: number) => {
      const z = zonas.find((x) => x.id === id);
      return z ? tarifario.zonaKey(z) : "";
    };
    const origen = key(tarifa.origen);
    const destino = key(tarifa.destino);
    return origen && destino ? { origen, destino } : null;
  },

  // ── Tarifas de cliente ─────────────────────────────────────────────────────
  // Mismo esquema que las de proveedor, del otro lado del mostrador. El catálogo
  // de clientes son las agencias que ya expone el backend: las tomamos de
  // passengersAccess(), que además resuelve la agencia propia del usuario.

  // Catálogo de clientes (agencias) visibles para el usuario logueado.
  async listClientes(): Promise<Cliente[]> {
    const { agencies } = await this.passengersAccess();
    return agencies.map((a) => ({ id: a.nombre, nombre: a.nombre }));
  },

  // Scope del tarifario de cliente: null = admin (ve y edita todos); un id = la
  // agencia propia (solo consulta la suya). El proveedor NO tiene acceso: no
  // puede ver lo que se le factura al cliente.
  async clienteScope(): Promise<string | null> {
    const me = await this.getMe();
    if (me.role === "proveedor") throw new Error("Sin acceso al tarifario de clientes.");
    if (me.role === "admin") return null;
    const { agencies, ownAgencyId } = await this.passengersAccess();
    // Si no se pudo resolver la agencia del usuario, queda con un scope vacío:
    // no ve tarifas de nadie (mejor que caer al de admin y verlas todas).
    return agencies.find((a) => a.id === ownAgencyId)?.nombre ?? "";
  },

  async listTarifasCliente(): Promise<TarifaCliente[]> {
    const scope = await this.clienteScope();
    // El admin ve todos los tarifarios: le pasamos el catálogo para que los
    // clientes que todavía no tienen tarifas arranquen con las de referencia.
    const clientes = scope === null ? (await this.listClientes()).map((c) => c.id) : [];
    return tarifasCliente.listTarifasCliente(scope, clientes);
  },
  async createTarifaCliente(input: TarifaClienteInput): Promise<TarifaCliente> {
    return tarifasCliente.createTarifaCliente(input, await this.clienteScope());
  },
  async updateTarifaCliente(t: TarifaCliente): Promise<TarifaCliente> {
    return tarifasCliente.updateTarifaCliente(t, await this.clienteScope());
  },
  async deleteTarifaCliente(id: string): Promise<void> {
    return tarifasCliente.deleteTarifaCliente(id, await this.clienteScope());
  },
  async getTarifasClienteExtras(clienteId: string): Promise<TarifaClienteExtras> {
    // Un cliente solo puede pedir los suyos; el admin, los de cualquiera.
    const scope = await this.clienteScope();
    if (scope !== null && scope !== clienteId) {
      throw new Error("Solo podés consultar tu propio tarifario.");
    }
    return tarifasCliente.getTarifasClienteExtras(clienteId);
  },
  async updateTarifasClienteExtras(
    patch: Partial<TarifaClienteExtras>,
    clienteId: string,
  ): Promise<TarifaClienteExtras> {
    return tarifasCliente.updateTarifasClienteExtras(patch, clienteId, await this.clienteScope());
  },
};
