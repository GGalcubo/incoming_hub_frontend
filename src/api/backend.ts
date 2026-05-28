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
  cantidad_pasajeros?: number;
  cantidad_valijas?: number;
  observaciones?: string;
  observaciones_chofer?: string;
  datos_vuelo?: string;
  puede_modificar?: boolean;
  horas_minimas_cancelacion?: number;
}

// ── Perfil de usuario (/auth/me/) ────────────────────────────────────────────
export type RoleEnum = "admin" | "agency_staff" | "agency_operator";

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

// Cuerpo escribible de un tramo.
export interface TramoWrite {
  viaje: number;
  numero_tramo: number;
  origen_direccion: string;
  origen_lugar_nombre?: string;
  origen_latitud?: string | null;
  origen_longitud?: string | null;
  destino_direccion: string;
  destino_lugar_nombre?: string;
  destino_latitud?: string | null;
  destino_longitud?: string | null;
}
