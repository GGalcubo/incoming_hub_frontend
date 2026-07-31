// ⚠️ MOCK (localStorage) de los comentarios de un viaje. Solo se usa cuando NO
// hay backend configurado (modo demo local).
//
// Con backend los comentarios son REALES: cuelgan del costo del viaje y se leen
// y escriben por /viajes/{id}/costos/comentarios/ (ver api/tarifario.ts,
// listComentariosCosto / addComentarioCosto).
//
// Lo único que este mock guarda y el backend no es el ROL del autor, con el que
// la vista dibuja la chapita de "de qué lado del mostrador vino".

import type { TripComentario } from "../types/domain";

const KEY = "proxy:tripComentarios";

// Mapa { idViaje: comentarios[] }, del más viejo al más nuevo.
type Store = Record<string, TripComentario[]>;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* almacenamiento no disponible o dato inválido */
  }
  return {};
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function listComentarios(tripId: string): TripComentario[] {
  return load()[tripId] ?? [];
}

export function addComentario(
  tripId: string,
  input: { autor: string; rol: string | null; texto: string },
): TripComentario {
  const texto = input.texto.trim();
  if (!texto) throw new Error("El comentario está vacío.");
  const store = load();
  const previos = store[tripId] ?? [];
  const nuevo: TripComentario = {
    id: `${tripId}-${previos.length + 1}-${Date.now()}`,
    autor: input.autor,
    rol: input.rol,
    texto,
    fecha: new Date().toISOString(),
  };
  store[tripId] = [...previos, nuevo];
  save(store);
  return nuevo;
}
