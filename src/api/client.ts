import { EXCEL_SAMPLE, SEED_TRIPS } from "../data/seed";
import { decodeJwt, mockJwt } from "../lib/jwt";
import type { ExcelRow, Trip, User } from "../types/domain";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const USE_MOCK = !API_URL;
// El login puede apuntar a la API real aunque el resto siga en mock.
const AUTH_URL = (import.meta.env.VITE_AUTH_URL as string | undefined) ?? "";
const USE_AUTH_MOCK = !AUTH_URL;
const USER_STORAGE_KEY = "proxy:user";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let mockTrips: Trip[] = [...SEED_TRIPS];

let onUnauthorized: () => void = () => {};
export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function buildUser(user: string, token: string, refresh?: string): User {
  const payload = decodeJwt(token);
  return { user, token, refresh, exp: payload?.exp };
}

// Extrae un mensaje legible de las respuestas de error de Django REST Framework.
function drfErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body) return body;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    const parts: string[] = [];
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) parts.push(...value.map(String));
      else if (typeof value === "string") parts.push(value);
    }
    if (parts.length) return parts.join(" ");
  }
  return fallback;
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

  async listTrips(): Promise<Trip[]> {
    if (USE_MOCK) {
      await wait(150);
      return [...mockTrips];
    }
    return http<Trip[]>("/trips");
  },

  async createTrip(trip: Partial<Trip>): Promise<Trip> {
    if (USE_MOCK) {
      await wait(250);
      const id = "RX-0" + (8420 + mockTrips.length + 1);
      const created = { ...(trip as Trip), id, est: trip.est ?? "PENDIENTE" };
      mockTrips = [created, ...mockTrips];
      return created;
    }
    return http<Trip>("/trips", { method: "POST", body: JSON.stringify(trip) });
  },

  async updateTrip(trip: Trip): Promise<Trip> {
    if (USE_MOCK) {
      await wait(200);
      mockTrips = mockTrips.map((t) => (t.id === trip.id ? trip : t));
      return trip;
    }
    return http<Trip>(`/trips/${trip.id}`, {
      method: "PUT",
      body: JSON.stringify(trip),
    });
  },

  async cancelTrip(id: string, reason: string): Promise<Trip> {
    if (USE_MOCK) {
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
    return http<Trip>(`/trips/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async parseExcel(_file: File): Promise<ExcelRow[]> {
    if (USE_MOCK) {
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
    if (res.status === 401) {
      onUnauthorized();
      throw new Error("Sesión expirada");
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as ExcelRow[];
  },

  async syncExcelRows(rows: number[]): Promise<{ count: number }> {
    if (USE_MOCK) {
      await wait(500);
      return { count: rows.length };
    }
    return http<{ count: number }>("/trips/excel/sync", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
  },
};
