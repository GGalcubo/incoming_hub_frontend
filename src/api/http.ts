import type { User } from "../types/domain";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const AUTH_URL = (import.meta.env.VITE_AUTH_URL as string | undefined) ?? "";

// Los viajes viven en el mismo Django que el login (.../api/v1). Si hay un
// VITE_API_URL explícito lo respetamos; si no, reusamos el base de auth.
export const VIAJES_BASE = API_URL || AUTH_URL;

const USER_STORAGE_KEY = "proxy:user";

let onUnauthorized: () => void = () => {};
export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

export function getToken(): string | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

// Extrae un mensaje legible de las respuestas de error de Django REST Framework.
export function drfErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body) return body;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) parts.push(...value.map((v) => `${key}: ${v}`));
      else if (typeof value === "string") parts.push(`${key}: ${value}`);
    }
    if (parts.length) return parts.join(" · ");
  }
  return fallback;
}

// Mensaje cuando el servidor no responde (caído, sin red o CORS): fetch rechaza
// con un TypeError genérico ("Failed to fetch") que no sirve para el usuario.
export const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.";

// Envuelve fetch para traducir las fallas de red en un mensaje legible. Los
// errores HTTP (4xx/5xx) sí devuelven una Response y se manejan más abajo.
export async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

async function parseError(res: Response): Promise<never> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* respuesta sin cuerpo JSON (p. ej. un 500 que devuelve HTML) */
  }
  throw new Error(drfErrorMessage(body, `${res.status} ${res.statusText}`));
}

// Llamada autenticada contra el backend de viajes. `path` arranca con "/".
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await safeFetch(`${VIAJES_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
