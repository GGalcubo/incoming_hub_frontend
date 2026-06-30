import type { MeProfile, MeWrite, Paginated, Persona } from "./backend";
import type { PassengersAccess, PersonasQuery } from "./viajes";
import { AGENCIES, CATEGORIES, SEED_TRIPS } from "../data/seed";
import { decodeJwt, mockJwt } from "../lib/jwt";
import type { ExcelRow, Trip, TripStatus, User } from "../types/domain";
import { drfErrorMessage, request, safeFetch, setOnUnauthorized, VIAJES_BASE } from "./http";
import * as viajes from "./viajes";

export { setOnUnauthorized };

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
    role: "admin",
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
    const { agencies, ownAgency, solicitantesByAgency } = await viajes.loadWizardIdentity(me);
    return { agencies, ownAgency, solicitante, isAdmin, solicitantesByAgency };
  },

  async listTrips(): Promise<Trip[]> {
    if (USE_VIAJES_MOCK) {
      await wait(150);
      return [...mockTrips];
    }
    return viajes.listTrips();
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
      return t;
    }
    return viajes.getTrip(id);
  },

  async createTrip(trip: Partial<Trip>): Promise<Trip> {
    if (USE_VIAJES_MOCK) {
      await wait(250);
      const id = "RX-0" + (8420 + mockTrips.length + 1);
      const created = { ...(trip as Trip), id, est: trip.est ?? "PENDIENTE" };
      mockTrips = [created, ...mockTrips];
      saveMockTrips();
      return created;
    }
    return viajes.createTrip(trip as Trip);
  },

  async updateTrip(trip: Trip): Promise<Trip> {
    if (USE_VIAJES_MOCK) {
      await wait(200);
      mockTrips = mockTrips.map((t) => (t.id === trip.id ? trip : t));
      saveMockTrips();
      return trip;
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
      return next;
    }
    return viajes.setStatus(id, est);
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
      return updated;
    }
    return viajes.cancelTrip(id, reason);
  },

  async deleteTrip(id: string): Promise<void> {
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
};
