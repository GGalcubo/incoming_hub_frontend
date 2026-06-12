import type { MeProfile, MeWrite, Paginated, Persona } from "./backend";
import type { PassengersAccess, PersonasQuery } from "./viajes";
import { AGENCIES, CATEGORIES, EXCEL_SAMPLE, SEED_TRIPS } from "../data/seed";
import { decodeJwt, mockJwt } from "../lib/jwt";
import type { ExcelRow, Trip, TripStatus, User } from "../types/domain";
import { drfErrorMessage, getToken, request, setOnUnauthorized, VIAJES_BASE } from "./http";
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

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const AUTH_URL = (import.meta.env.VITE_AUTH_URL as string | undefined) ?? "";
const USE_AUTH_MOCK = !AUTH_URL;
// Los viajes usan el backend real si hay base (VITE_API_URL o, por defecto, el de auth).
const USE_VIAJES_MOCK = !VIAJES_BASE;
// El parser de Excel tiene su propio endpoint; mientras no haya VITE_API_URL, mock.
const USE_EXCEL_MOCK = !API_URL;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let mockTrips: Trip[] = [...SEED_TRIPS];

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
    const res = await fetch(`${AUTH_URL}/auth/login/`, {
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
      return created;
    }
    return viajes.createTrip(trip as Trip);
  },

  async updateTrip(trip: Trip): Promise<Trip> {
    if (USE_VIAJES_MOCK) {
      await wait(200);
      mockTrips = mockTrips.map((t) => (t.id === trip.id ? trip : t));
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
      return updated;
    }
    return viajes.cancelTrip(id, reason);
  },

  async deleteTrip(id: string): Promise<void> {
    if (USE_VIAJES_MOCK) {
      await wait(150);
      mockTrips = mockTrips.filter((t) => t.id !== id);
      return;
    }
    return viajes.deleteTrip(id);
  },

  async parseExcel(_file: File): Promise<ExcelRow[]> {
    if (USE_EXCEL_MOCK) {
      await wait(600);
      return EXCEL_SAMPLE;
    }
    const token = getToken();
    const fd = new FormData();
    fd.append("file", _file);
    const res = await fetch(`${API_URL}/trips/excel/parse`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    if (res.status === 401) throw new Error("Sesión expirada");
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as ExcelRow[];
  },

  // Recibe las filas EDITADAS del modal (no solo los números de fila), para que
  // los cambios hechos en la tabla de pre-carga se persistan al sincronizar.
  async syncExcelRows(rows: ExcelRow[]): Promise<{ count: number }> {
    if (USE_EXCEL_MOCK) {
      await wait(500);
      const created = rows.map((r, i) => excelRowToTrip(r, i));
      mockTrips = [...created, ...mockTrips];
      return { count: created.length };
    }
    const token = getToken();
    const res = await fetch(`${API_URL}/trips/excel/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ rows }),
    });
    if (res.status === 401) throw new Error("Sesión expirada");
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as { count: number };
  },
};

// Convierte una fila de Excel (editada) en un viaje del catálogo mock.
function excelRowToTrip(r: ExcelRow, index: number): Trip {
  const named = r.passengers.filter((p) => p.name.trim());
  return {
    id: "RX-0" + (8420 + mockTrips.length + index + 1),
    date: r.date,
    time: r.time,
    pax: named.length,
    cat: r.cat,
    ori: r.legs[0]?.origin ?? "",
    dst: r.legs[r.legs.length - 1]?.destination ?? "",
    est: "PENDIENTE",
    agc: "",
    ref: r.tripRef,
    obs: "",
    unit: "",
    passengers: named.map((p) => {
      const parts = p.name.trim().split(/\s+/);
      return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" "), phone: p.phone };
    }),
    legs: r.legs.map((l) => ({
      type: l.type ?? "otro",
      origin: l.origin,
      destination: l.destination,
      flight: l.flight ?? "",
      obs: "",
    })),
    costs: { total: 0, viaje: 0, espera: 0, peajes: 0, estacionamiento: 0, otros: 0 },
    history: [{ ts: r.date, user: "excel-import", action: "Importado desde Excel" }],
  };
}
