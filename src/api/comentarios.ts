// Comentarios de un viaje.
//
// El backend todavía no los modela (el viaje no tiene ni campo ni sub-recurso
// de comentarios), así que viven en el frontend: localStorage indexado por id
// de viaje, igual que la asignación de proveedor (ver api/proveedores.ts). Así
// funciona tanto contra el mock como contra el backend real, porque el id del
// viaje es estable en los dos casos.
//
// Cuando el backend publique el recurso, se reemplaza el cuerpo de estas dos
// funciones por `request(...)` y las vistas quedan igual.

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
