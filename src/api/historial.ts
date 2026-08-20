// Historial / auditoría de un viaje (GET /viajes/{id}/historial/) traducido al
// modelo del front (`HistoryEntry`).
//
// El backend devuelve un renglón por cambio, del más reciente al más antiguo,
// con el modelo tocado (viaje, tramo, pasajero, costo, comentario), la acción
// (insert/update/delete) y el diff campo por campo. Acá se le pone nombre en
// castellano a todo eso: los nombres crudos del modelo de datos no se le
// muestran a un operador.

import type { HistorialEntrada } from "./backend";
import { request } from "./http";
import type { HistoryChange, HistoryEntry } from "../types/domain";

// ⚠️ El historial NO viene paginado: el servidor devuelve la lista pelada, aunque
// el schema OpenAPI la declare como `PaginatedHistorialEntradaList`. Con
// `fetchAll` la pantalla moría con "results is not iterable", así que acá se
// aceptan las dos formas: si viene envuelta se recorre la paginación, y si viene
// plana se usa tal cual (vale también para /solicitantes/, que sí pagina).
interface Page<T> {
  next: string | null;
  results: T[];
}

async function fetchLista<T>(path: string): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const primera = await request<T[] | Page<T>>(`${path}${sep}page=1`);
  if (Array.isArray(primera)) return primera;
  const out = [...primera.results];
  let next = primera.next;
  let page = 2;
  while (next) {
    const data = await request<Page<T>>(`${path}${sep}page=${page}`);
    out.push(...data.results);
    next = data.next;
    page += 1;
  }
  return out;
}

// ── Usuarios ─────────────────────────────────────────────────────────────────
// La entrada del historial trae el ID del autor, no su nombre, así que hay que
// resolverlo contra el padrón (/solicitantes/ devuelve Users). Se cachea por
// sesión; si el rol logueado no tiene permiso para listarlo, el catálogo queda
// vacío y cada autor se muestra como "Usuario #id" (mejor eso que romper la
// pantalla por un 403).
interface UsuarioMin {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
}

let usuariosPromise: Promise<Map<number, string>> | null = null;

function loadUsuarios(): Promise<Map<number, string>> {
  if (!usuariosPromise) {
    usuariosPromise = fetchLista<UsuarioMin>("/solicitantes/")
      .then((us) => new Map(us.map((u) => [u.id, nombreDeUsuario(u)])))
      .catch(() => new Map<number, string>());
  }
  return usuariosPromise;
}

function nombreDeUsuario(u: UsuarioMin): string {
  return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username;
}

// ── Etiquetas ────────────────────────────────────────────────────────────────
// De qué objeto del viaje habla la entrada. La clave es el nombre del modelo
// normalizado (sin app, sin guiones bajos, en minúscula): no sabemos con qué
// forma exacta lo manda el backend, así que se aceptan las variantes probables y
// lo desconocido se muestra tal cual vino.
const MODELO_LABEL: Record<string, string> = {
  viaje: "viaje",
  tramo: "tramo",
  pasajero: "pasajero",
  pasajeroviaje: "pasajero",
  viajepasajero: "pasajero",
  persona: "pasajero",
  costo: "costos",
  costoviaje: "costos",
  comentario: "comentario",
  comentariocosto: "comentario",
};

const ACCION_LABEL: Record<string, string> = {
  insert: "Alta",
  create: "Alta",
  created: "Alta",
  update: "Modificación",
  updated: "Modificación",
  delete: "Baja",
  deleted: "Baja",
};

// Nombres de campo del backend → etiqueta de pantalla. Cubre los campos del
// viaje, del tramo y del costo; lo que no esté se muestra prolijado
// ("hora_servicio" → "Hora servicio").
const CAMPO_LABEL: Record<string, string> = {
  // Viaje
  numero_viaje: "Nº de viaje",
  referencia_externa: "Referencia",
  agencia: "Agencia",
  solicitante: "Solicitante",
  categoria_servicio: "Categoría",
  proveedor: "Proveedor",
  estado: "Estado",
  fecha_servicio: "Fecha del servicio",
  hora_servicio: "Hora del servicio",
  tipo_servicio: "Tipo de servicio",
  cantidad_pasajeros: "Cantidad de pasajeros",
  cantidad_valijas: "Valijas",
  observaciones: "Observaciones",
  observaciones_chofer: "Observaciones del chofer",
  datos_vuelo: "Datos de vuelo",
  unidad_asignada: "Unidad asignada",
  puede_modificar: "Se puede modificar",
  horas_minimas_cancelacion: "Horas mínimas de cancelación",
  sincronizado_externo: "Sincronizado con central",
  fecha_sincronizacion: "Fecha de sincronización",
  error_sincronizacion: "Error de sincronización",
  creado_por: "Creado por",
  modificado_por: "Modificado por",
  // Tramo
  numero_tramo: "Nº de tramo",
  origen_direccion: "Origen",
  origen_lugar_nombre: "Origen (lugar)",
  origen_latitud: "Latitud de origen",
  origen_longitud: "Longitud de origen",
  origen_es_aeropuerto: "Origen es aeropuerto",
  origen_iata: "IATA de origen",
  destino_direccion: "Destino",
  destino_lugar_nombre: "Destino (lugar)",
  destino_latitud: "Latitud de destino",
  destino_longitud: "Longitud de destino",
  destino_es_aeropuerto: "Destino es aeropuerto",
  destino_iata: "IATA de destino",
  distancia_km: "Distancia (km)",
  duracion_estimada_minutos: "Duración estimada (min)",
  tarifa: "Tarifa",
  // Costos
  costo_viaje_proveedor: "Viaje (proveedor)",
  costo_espera_proveedor: "Espera (proveedor)",
  costo_peajes_proveedor: "Peajes (proveedor)",
  costo_estacionamiento_proveedor: "Estacionamiento (proveedor)",
  costo_otros_proveedor: "Otros (proveedor)",
  costo_total_proveedor: "Total (proveedor)",
  moneda_proveedor: "Moneda (proveedor)",
  costo_viaje_cliente: "Viaje (cliente)",
  costo_espera_cliente: "Espera (cliente)",
  costo_peajes_cliente: "Peajes (cliente)",
  costo_estacionamiento_cliente: "Estacionamiento (cliente)",
  costo_otros_cliente: "Otros (cliente)",
  costo_total_cliente: "Total (cliente)",
  moneda_cliente: "Moneda (cliente)",
  horas_disponibles: "Horas a disposición",
  // Pasajeros / comentarios
  persona: "Pasajero",
  nombre: "Nombre",
  telefono: "Teléfono",
  dni: "DNI",
  email: "Email",
  es_principal: "Pasajero principal",
  texto: "Texto",
  autor: "Autor",
};

// Campos que no aportan nada al leer el historial: la clave primaria, el FK al
// propio viaje y las marcas de tiempo que cambian en TODA modificación.
const CAMPOS_OCULTOS = new Set(["id", "viaje", "created_at", "updated_at"]);

function normalizar(s: string): string {
  return s.split(".").pop()!.replace(/[_\s-]/g, "").toLowerCase();
}

function campoLabel(campo: string): string {
  const label = CAMPO_LABEL[campo];
  if (label) return label;
  const limpio = campo.replace(/_/g, " ");
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function accionLabel(entrada: HistorialEntrada): string {
  const modelo = MODELO_LABEL[normalizar(entrada.modelo)] ?? entrada.modelo;
  const accion = ACCION_LABEL[entrada.accion.toLowerCase()];
  if (!accion) {
    // Acción desconocida: se muestra cruda antes que inventarle un nombre.
    return `${entrada.accion} · ${modelo}`;
  }
  return `${accion} de ${modelo}`;
}

// Valor de un campo listo para mostrar. El backend manda JSON crudo (números,
// booleanos, nulls, ids de FK), no texto.
function valorLabel(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// `cambios` es `{ campo: [antes, después] }`. En el alta y en la baja el valor
// puede venir solo (sin par): ahí queda como "después" si es un alta y como
// "antes" si es una baja.
function toChanges(entrada: HistorialEntrada): HistoryChange[] {
  const esBaja = normalizar(entrada.accion) === "delete";
  const out: HistoryChange[] = [];
  for (const [campo, valor] of Object.entries(entrada.cambios ?? {})) {
    if (CAMPOS_OCULTOS.has(campo)) continue;
    const par = Array.isArray(valor);
    const antes = par ? valor[0] : esBaja ? valor : null;
    const despues = par ? valor[1] : esBaja ? null : valor;
    // Un "cambio" que no cambió nada (mismo antes y después) es ruido.
    if (valorLabel(antes) === valorLabel(despues)) continue;
    out.push({ field: campoLabel(campo), from: valorLabel(antes), to: valorLabel(despues) });
  }
  return out;
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Exportada para poder testear la traducción sin tocar la red.
export function entradaToHistoryEntry(
  e: HistorialEntrada,
  usuarios: Map<number, string>,
): HistoryEntry {
  // Sin usuario: el cambio no vino de un request (import, tarea programada o
  // consola del backend).
  const user =
    e.usuario == null
      ? "Sistema"
      : (usuarios.get(e.usuario) ?? `Usuario #${e.usuario}`);
  const changes = toChanges(e);
  return {
    ts: fmtFecha(e.fecha),
    user,
    action: accionLabel(e),
    ...(changes.length ? { changes } : {}),
  };
}

// ── Recorte por rol ──────────────────────────────────────────────────────────
// Qué parte de la auditoría ve cada rol. El admin la ve entera; la agencia y el
// proveedor ven SOLO las entradas de costos, y dentro de ellas solo su columna:
// la agencia lo que se le factura al cliente, el proveedor lo que él cobra. Es
// la misma regla que StepCostos aplica a la grilla, acá sobre el diff — sin
// esto, el historial era la puerta de atrás para ver el costo del otro lado.
//
// El backend NO recorta el historial (devuelve el diff completo), así que el
// filtro es del front: quién lo pide se resuelve en client.ts contra /auth/me/,
// no con un prop de la vista.
export type HistorialVista = "todo" | "cliente" | "proveedor";

// De qué lado del mostrador es un campo, mirando su etiqueta ya traducida. Los
// campos de costo se etiquetan "Espera (proveedor)" / "Total (cliente)"; un
// campo que el backend agregue y no esté en CAMPO_LABEL cae al prolijado
// ("… cliente"), y también se reconoce. Lo que no matchea ninguno de los dos es
// neutro (p. ej. "Horas a disposición") y lo ven ambos: no revela precios.
const MARCA_LADO: Record<Exclude<HistorialVista, "todo">, RegExp> = {
  cliente: /\(cliente\)|\bcliente$/i,
  proveedor: /\(proveedor\)|\bproveedor$/i,
};

// Una entrada habla de costos si su modelo se tradujo a "costos" (ver
// MODELO_LABEL); vale también para la forma cruda "accion · costos".
function esDeCostos(action: string): boolean {
  return action.toLowerCase().includes(MODELO_LABEL.costo);
}

// Recorta el historial a lo que le toca ver a un rol. Hace DOS cosas:
//
// 1. Deja solo las entradas de costos. Esto sigue siendo del front: el backend
//    le manda a la agencia y al proveedor la auditoría entera del viaje (tramos,
//    pasajeros, direcciones, horarios), y en su pantalla solo va lo de plata.
// 2. Saca los campos de la columna ajena. Esto el backend ya lo hace desde el
//    08/08/2026 —al proveedor no le llega ningún `*_cliente` y viceversa—, así
//    que en la práctica no encuentra nada que sacar. Se queda de red: es un
//    filtro por regex sobre campos ya traducidos, no cuesta nada, y si el
//    servidor volviera atrás el precio ajeno no se dibuja igual.
export function filtrarPorVista(
  entries: HistoryEntry[],
  vista: HistorialVista,
): HistoryEntry[] {
  if (vista === "todo") return entries;
  const ajeno = MARCA_LADO[vista === "cliente" ? "proveedor" : "cliente"];
  const out: HistoryEntry[] = [];
  for (const e of entries) {
    if (!esDeCostos(e.action)) continue;
    const changes = (e.changes ?? []).filter((c) => !ajeno.test(c.field));
    // Si después del recorte no queda nada del lado propio, la entrada es ruido:
    // una "Modificación de costos" sin un solo campo visible no dice nada.
    if (!changes.length) continue;
    out.push({ ...e, changes });
  }
  return out;
}

// Historial completo del viaje, ya ordenado por el backend (del más reciente al
// más antiguo). Un viaje fuera del scope del usuario da 404, igual que su detalle.
export async function listHistorial(viajeId: string | number): Promise<HistoryEntry[]> {
  const [entradas, usuarios] = await Promise.all([
    fetchLista<HistorialEntrada>(`/viajes/${viajeId}/historial/`),
    loadUsuarios(),
  ]);
  return entradas.map((e) => entradaToHistoryEntry(e, usuarios));
}
