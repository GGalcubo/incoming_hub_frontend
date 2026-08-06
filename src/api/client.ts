// Fachada de API que consumen las vistas. TODO sale del backend: no hay modo
// demo ni datos de ejemplo. Si el backend no está configurado o falla, la
// llamada falla y la pantalla lo muestra — preferimos un error visible a un dato
// inventado.

import type {
  ChangePasswordWrite,
  MeProfile,
  MeWrite,
  Paginated,
  Persona,
} from "./backend";
import type { PassengersAccess, PersonasQuery } from "./viajes";
import { decodeJwt } from "../lib/jwt";
import type { ExcelRow, HistoryEntry, Trip, TripStatus, User } from "../types/domain";
import type {
  Proveedor,
  TarifaBase,
  TarifaBaseInput,
  TarifaExtras,
  VehicleCategoria,
} from "../types/tarifas";
import * as historial from "./historial";
import {
  assertBase,
  AUTH_URL,
  drfErrorMessage,
  request,
  safeFetch,
  setOnUnauthorized,
} from "./http";
import * as tarifario from "./tarifario";
import * as tarifasCrud from "./tarifasCrud";
import * as viajes from "./viajes";

export { setOnUnauthorized };

// ── Cotización de la ruta (paso "Tarifa" del wizard) ─────────────────────────
// Una tarifa ofrecida para la ruta elegida: la categoría de vehículo con su
// precio de las dos columnas y el proveedor dueño del tarifario. `tarifaId` es el
// id del backend: es lo que se guarda en el tramo del viaje y lo que define su
// costo.
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

function buildUser(user: string, token: string, refresh?: string): User {
  const payload = decodeJwt(token);
  return { user, token, refresh, exp: payload?.exp };
}

export const api = {
  async login(user: string, pass: string): Promise<User> {
    const res = await safeFetch(`${assertBase(AUTH_URL)}/auth/login/`, {
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
    return request<MeProfile>("/auth/me/");
  },

  async updateMe(patch: MeWrite): Promise<MeProfile> {
    return request<MeProfile>("/auth/me/", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  // Cambio de contraseña del usuario logueado. La sesión no se corta: los tokens
  // que ya tiene el navegador siguen siendo válidos.
  async changePassword(actual: string, nueva: string): Promise<void> {
    const body: ChangePasswordWrite = { password_actual: actual, password_nueva: nueva };
    await request<void>("/auth/change-password/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async listCategorias(): Promise<string[]> {
    return viajes.listCategorias();
  },

  // Datos de identidad para el wizard: agencias disponibles, agencia propia del
  // usuario, su nombre como solicitante y si puede cambiar de agencia (admin).
  async getWizardIdentity(): Promise<WizardIdentity> {
    const me = await this.getMe();
    const solicitante = `${me.first_name} ${me.last_name}`.trim() || me.username;
    const { agencies, ownAgency, ownSolicitante, solicitantesByAgency } =
      await viajes.loadWizardIdentity(me);
    return {
      agencies,
      ownAgency,
      // Preferimos el nombre del catálogo: es el que después se puede resolver a
      // un id para guardar el solicitante en el viaje.
      solicitante: ownSolicitante ?? solicitante,
      isAdmin: me.role === "admin",
      solicitantesByAgency,
    };
  },

  // Una página de la lista de viajes, ya con su proveedor. El día y la página los
  // resuelve el servidor (ver viajes.listTrips): la lista NO se trae entera.
  //
  // El BACKEND ya recorta por rol (admin: todos; agencia: los de su agencia;
  // proveedor: los suyos; sin agencia/proveedor asignado: ninguno), así que acá
  // no se filtra nada: hacerlo de nuevo vaciaba la lista del proveedor cuando su
  // perfil no traía el proveedor resuelto.
  async listTrips(q: viajes.TripsQuery = {}): Promise<viajes.TripsPage> {
    return viajes.listTrips(q);
  },

  // Cuántos viajes hay un día (los contadores de "hoy / mañana" del encabezado).
  async countTrips(date: string): Promise<number> {
    return viajes.countTrips(date);
  },

  // Catálogo de proveedores (para asignar el viaje y elegir tarifario).
  async listProveedores(): Promise<Proveedor[]> {
    return tarifasCrud.listProveedores();
  },

  // Una página del catálogo de pasajeros (búsqueda/filtro/paginación server-side).
  async listPersonas(q: PersonasQuery): Promise<Paginated<Persona>> {
    return viajes.listPersonasPage(q);
  },

  // Acceso a la vista de pasajeros según rol: agencias visibles y, si no es
  // admin, la agencia propia a la que queda restringido.
  async passengersAccess(): Promise<PassengersAccess> {
    return viajes.loadPassengersAccess(await this.getMe());
  },

  // El backend devuelve el proveedor con el viaje (`viaje.proveedor`).
  async getTrip(id: string): Promise<Trip> {
    return viajes.getTrip(id);
  },

  async createTrip(trip: Partial<Trip>): Promise<Trip> {
    return viajes.createTrip(trip as Trip);
  },

  async updateTrip(trip: Trip): Promise<Trip> {
    return viajes.updateTrip(trip);
  },

  async setStatus(id: string, est: TripStatus): Promise<Trip> {
    return viajes.setStatus(id, est);
  },

  async cancelTrip(id: string, reason: string): Promise<Trip> {
    return viajes.cancelTrip(id, reason);
  },

  async deleteTrip(id: string): Promise<void> {
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

  // Crea los viajes seleccionados del Excel con el mismo pipeline que el wizard
  // (pasajeros y tramos anidados en el alta). La agencia y el solicitante salen
  // de la identidad del usuario.
  //
  // Va en LOTE (`POST /viajes/bulk/`): una sola llamada, todo o nada, con los
  // errores devueltos por fila. Antes se creaba de a un viaje y una fila mala
  // dejaba la importación por la mitad.
  async importExcelRows(
    rows: ExcelRow[],
  ): Promise<{ count: number; errors: { row: number; message: string }[] }> {
    const identity = await this.getWizardIdentity();
    const agc = identity.ownAgency ?? identity.agencies[0] ?? "";
    const solicitante = identity.solicitante;

    // El `id_temporal` es el número de fila del Excel: es lo que después se le
    // muestra al usuario ("Fila 7: …").
    const res = await viajes.createTripsBulk(
      rows.map((r) => ({
        idTemporal: String(r.row),
        trip: viajes.excelRowToTrip(r, agc, solicitante),
      })),
    );
    return {
      count: res.creados,
      errors: res.errores.map((e) => ({ row: Number(e.idTemporal) || 0, message: e.message })),
    };
  },

  // ── Comentarios del viaje ──────────────────────────────────────────────────
  // Los ve y los deja cualquier rol (es el canal para discutir diferencias de
  // costos). Cuelgan del COSTO del viaje: se leen embebidos en el GET de costos
  // y se escriben por su propio sub-recurso. El autor lo fija el backend con el
  // usuario logueado, así que nadie puede firmar con otro nombre.
  async listComentarios(tripId: string) {
    return tarifario.listComentariosCosto(tripId);
  },

  async addComentario(tripId: string, texto: string) {
    return tarifario.addComentarioCosto(tripId, texto);
  },

  // ── Historial del viaje ────────────────────────────────────────────────────
  // Auditoría del servidor (GET /viajes/{id}/historial/): incluye los cambios
  // del viaje y los de sus tramos, pasajeros, costos y comentarios.
  //
  // Lo que devuelve va recortado por rol (ver historial.filtrarPorVista): el
  // admin ve la auditoría entera, la agencia y el proveedor solo los cambios de
  // costos de su columna.
  async listHistorial(tripId: string): Promise<HistoryEntry[]> {
    const [vista, entries] = await Promise.all([
      this.historialVista(),
      historial.listHistorial(tripId),
    ]);
    return historial.filtrarPorVista(entries, vista);
  },

  // Qué parte del historial le toca al rol logueado. Se resuelve acá contra
  // /auth/me/ y no en la pantalla, para que ninguna vista pueda pedir la
  // auditoría completa. El reparto es el mismo que el de las columnas de
  // StepCostos: proveedor → la suya, admin → las dos, el resto → cliente.
  async historialVista(): Promise<historial.HistorialVista> {
    const me = await this.getMe();
    if (me.role === "provider") return "proveedor";
    if (me.role === "admin") return "todo";
    return "cliente";
  },

  // ── Tarifas ────────────────────────────────────────────────────────────────
  // Van contra el tarifario del backend (/tarifarios/tarifas/), donde cada tarifa
  // es (proveedor, origen, destino, categoría) con sus dos precios. El scoping
  // por proveedor lo hace el servidor.
  async listTarifasBase(): Promise<TarifaBase[]> {
    return tarifasCrud.listTarifasBase();
  },
  async createTarifaBase(input: TarifaBaseInput): Promise<TarifaBase> {
    return tarifasCrud.createTarifaBase(input);
  },
  async updateTarifaBase(t: TarifaBase): Promise<TarifaBase> {
    return tarifasCrud.updateTarifaBase(t);
  },
  async deleteTarifaBase(id: string): Promise<void> {
    return tarifasCrud.deleteTarifaBase(id);
  },

  // Extras (espera / hora a disposición / km). Las DOS columnas se guardan en el
  // propio proveedor (/tarifarios/proveedores/{id}/, `valor_*` y `valor_*_cliente`)
  // y además vienen anidadas en el viaje. Sin proveedor no hay extras que pedir:
  // quien llama tiene que resolverlo antes.
  async getTarifasExtras(proveedorId: string): Promise<TarifaExtras> {
    return tarifasCrud.getExtrasProveedor(proveedorId);
  },
  async updateTarifasExtras(
    patch: Partial<TarifaExtras>,
    proveedorId: string,
  ): Promise<TarifaExtras> {
    return tarifasCrud.updateExtrasProveedor(proveedorId, patch);
  },

  // Lugares (códigos de zona) y categorías de vehículo con los que se arma una
  // tarifa.
  listTarifaLugares(): Promise<string[]> {
    return tarifasCrud.listLugares();
  },
  async listCategoriasTarifa(): Promise<VehicleCategoria[]> {
    return tarifasCrud.listCategorias();
  },

  // ── Cotización de la ruta del viaje ────────────────────────────────────────
  // Sale del tarifario del servidor (/tarifarios/): las zonas pueblan los
  // selectores de origen/destino y la cotización devuelve las tarifas vigentes de
  // esa ruta, con su id (lo que después se guarda en el tramo).

  // Lugares tarifados con los que se arma la ruta del viaje.
  async listLugaresRuta(): Promise<string[]> {
    const zonas = await tarifario.listZonas();
    return Array.from(new Set(zonas.map(tarifario.zonaKey).filter(Boolean))).sort();
  },

  // Tarifas disponibles para una ruta: las de todos los proveedores que tengan
  // tarifa vigente para el tramo.
  async cotizarRuta(origen: string, destino: string): Promise<CotizacionRuta> {
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
};
