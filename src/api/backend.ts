// Tipos que reflejan el esquema OpenAPI del backend (Incoming Hub API, /api/v1).
// La UI sigue trabajando con el modelo `Trip` de types/domain; estos tipos solo
// viven en la capa de API y se traducen en api/viajes.ts.

export type TipoServicio = "IN" | "OUT" | "HDS" | "OTR";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Agencia {
  id: number;
  id_cliente_central: number;
  id_centro_costo_central: number;
  razon_social_cliente: string;
  nombre_centro_costo: string;
  email: string | null;
  telefono: string | null;
  cuit: string | null;
  activo: boolean;
}

export interface CategoriaServicio {
  id: number;
  id_categoria_central: number | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
}

export interface Solicitante {
  id: number;
  agencia: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  puesto: string | null;
  activo: boolean;
  es_principal: boolean;
}

export interface Persona {
  id: number;
  agencia: number;
  nombre: string;
  telefono: string;
  dni: string | null;
  email: string | null;
  fecha_creacion: string;
}

export interface TramoPasajero {
  id: number;
  pasajero: number;
  cantidad_valijas?: number;
}

export interface Tramo {
  id: number;
  viaje: number;
  numero_tramo: number;
  origen_direccion: string;
  origen_latitud: string | null;
  origen_longitud: string | null;
  origen_lugar_nombre: string;
  destino_direccion: string;
  destino_latitud: string | null;
  destino_longitud: string | null;
  destino_lugar_nombre: string;
  localidad_origen_central?: string;
  id_localidad_origen_central?: number | null;
  localidad_destino_central?: string;
  id_localidad_destino_central?: number | null;
  distancia_km?: string | null;
  duracion_estimada_minutos?: number | null;
  pasajeros_tramo: TramoPasajero[];
}

// Pasajero embebido en la lectura de un viaje (GET /viajes/). El backend ya
// resuelve la Persona y devuelve sus datos junto con el flag de principal.
export interface PasajeroRead {
  id: number;
  persona: number;
  nombre: string;
  telefono: string | null;
  dni: string | null;
  email: string | null;
  es_principal: boolean;
}

export interface CostoViaje {
  id: number;
  viaje: number;
  costo_viaje: string;
  costo_espera: string;
  costo_peajes: string;
  costo_estacionamiento: string;
  costo_otros: string;
  costo_total: string;
  moneda: string;
  updated_at: string;
}

export interface Viaje {
  id: number;
  numero_viaje: string;
  referencia_externa: string;
  agencia: number;
  solicitante: number | null;
  categoria_servicio: number;
  estado: number;
  fecha_servicio: string;
  hora_servicio: string;
  tipo_servicio: TipoServicio;
  pasajero_principal: number | null;
  cantidad_pasajeros: number;
  cantidad_valijas: number;
  observaciones: string;
  observaciones_chofer: string;
  datos_vuelo: string;
  unidad_asignada: string;
  puede_modificar: boolean;
  horas_minimas_cancelacion: number;
  sincronizado_central: boolean;
  fecha_sincronizacion: string | null;
  id_viaje_central: number | null;
  error_sincronizacion: string | null;
  creado_por: number | null;
  modificado_por: number | null;
  created_at: string;
  updated_at: string;
  tramos: Tramo[];
  costo: CostoViaje | null;
  puede_cancelar: string;
  // Pasajeros del viaje, embebidos por el backend en la lectura.
  pasajeros: PasajeroRead[];
}

// Pasajero embebido en el POST de creación de viaje. El backend crea/resuelve la
// `Persona` a partir de estos datos y marca como principal al que tenga
// `es_principal: true`. Solo `nombre` es obligatorio.
export interface PasajeroWrite {
  nombre: string;
  telefono?: string;
  dni?: string;
  email?: string;
  es_principal?: boolean;
}

// Tramo anidado en la creación del viaje (POST /viajes/). Lleva las COORDENADAS
// (lat/lng) y el TEXTO del lugar elegido en el autocomplete (lugar_nombre +
// direccion), para que al reabrir el viaje se muestre la dirección y no las
// coordenadas crudas. Origen y destino van en el MISMO objeto (un tramo = un
// trayecto completo). El orden de la lista define el numero_tramo; el primero es
// el principal. Reglas (400 si se violan): la lat y la long de un extremo van
// siempre juntas; cada tramo necesita al menos un extremo (origen o destino) con
// sus dos coordenadas.
export interface TramoInput {
  origen_latitud?: string | null;
  origen_longitud?: string | null;
  origen_lugar_nombre?: string;
  origen_direccion?: string;
  origen_es_aeropuerto?: boolean;
  origen_iata?: string;
  destino_latitud?: string | null;
  destino_longitud?: string | null;
  destino_lugar_nombre?: string;
  destino_direccion?: string;
  destino_es_aeropuerto?: boolean;
  destino_iata?: string;
}

// Cuerpo escribible de un viaje (POST/PUT/PATCH). Solo campos editables.
export interface ViajeWrite {
  referencia_externa?: string;
  agencia: number;
  solicitante?: number | null;
  categoria_servicio: number;
  estado?: number;
  fecha_servicio: string;
  hora_servicio: string;
  tipo_servicio: TipoServicio;
  pasajero_principal?: number | null;
  // Alta de pasajeros en la misma llamada de creación del viaje. El backend los
  // crea como Personas y asigna el `pasajero_principal`.
  pasajeros?: PasajeroWrite[];
  // Alta de tramos en la misma llamada de creación (coordenadas, ver TramoInput).
  tramos?: TramoInput[];
  cantidad_pasajeros?: number;
  cantidad_valijas?: number;
  observaciones?: string;
  observaciones_chofer?: string;
  datos_vuelo?: string;
  puede_modificar?: boolean;
  horas_minimas_cancelacion?: number;
}

// Cuerpo escribible de un pasajero de viaje vía /pasajeros-viaje/ (POST asocia,
// PATCH edita, DELETE desasocia). Aplana los datos de la Persona sobre el
// vínculo: al crear, la Persona se crea con la agencia del viaje. Para POST,
// `viaje` y `nombre` son obligatorios; para PATCH se manda solo lo que cambia.
export interface ViajePersonaWrite {
  viaje: number;
  nombre: string;
  telefono?: string;
  dni?: string | null;
  email?: string | null;
  es_principal?: boolean;
}

// ── Perfil de usuario (/auth/me/) ────────────────────────────────────────────
// `proveedor` es el rol nuevo (deck "Nuevo Rol: Proveedor"): carga/edita tarifas
// y modifica los costos de los viajes que tiene asignados.
export type RoleEnum = "admin" | "agency_staff" | "agency_operator" | "proveedor";

// Lectura del usuario autenticado (GET /auth/me/).
export interface MeProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleEnum | null;
  phone: string;
}

// Cuerpo editable del perfil (PATCH /auth/me/). El backend no expone endpoint
// para cambiar contraseña ni permite editar el rol del propio usuario.
export interface MeWrite {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

// Cuerpo escribible de un tramo standalone (POST/PATCH /tramos/, usado al
// modificar un viaje ya creado). Solo coordenadas (igual que TramoInput): el
// backend resuelve la localidad. En POST `viaje` es obligatorio y NO se manda
// `numero_tramo` (lo asigna el backend, agregando el tramo al final).
export interface TramoWrite extends TramoInput {
  viaje: number;
}
