import type { MeProfile, MeWrite } from "./backend";
import { CATEGORIES, EXCEL_SAMPLE, SEED_TRIPS } from "../data/seed";
import { decodeJwt, mockJwt } from "../lib/jwt";
import type { ExcelRow, Trip, TripStatus, User } from "../types/domain";
import { drfErrorMessage, getToken, request, setOnUnauthorized, VIAJES_BASE } from "./http";
import * as viajes from "./viajes";

export { setOnUnauthorized };

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

  async listTrips(): Promise<Trip[]> {
    if (USE_VIAJES_MOCK) {
      await wait(150);
      return [...mockTrips];
    }
    return viajes.listTrips();
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

  async syncExcelRows(rows: number[]): Promise<{ count: number }> {
    if (USE_EXCEL_MOCK) {
      await wait(500);
      return { count: rows.length };
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
