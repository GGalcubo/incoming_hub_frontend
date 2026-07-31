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
  fecha_ultima_sincronizacion?: string | null;
  fecha_creacion: string;
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
  fecha_creacion: string;
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

export interface Tramo {
  id: number;
  viaje: number;
  // Read-only: lo asigna el backend según el orden de alta.
  numero_tramo: number;
  // Tarifa (del tarifario de un proveedor) elegida para este tramo: es la que
  // define su costo. Solo lectura acá: se manda en el alta (TramoInput.tarifa) o
  // se cambia con el endpoint dedicado PATCH /tramos/{id}/tarifa/.
  tarifa: number | null;
  origen_direccion: string;
  origen_latitud: string | null;
  origen_longitud: string | null;
  origen_lugar_nombre: string;
  origen_es_aeropuerto?: boolean;
  origen_iata?: string;
  destino_direccion: string;
  destino_latitud: string | null;
  destino_longitud: string | null;
  destino_lugar_nombre: string;
  destino_es_aeropuerto?: boolean;
  destino_iata?: string;
  localidad_origen_central?: string;
  id_localidad_origen_central?: number | null;
  localidad_destino_central?: string;
  id_localidad_destino_central?: number | null;
  distancia_km?: string | null;
  duracion_estimada_minutos?: number | null;
  id_tramo_central: number | null;
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
  id_persona_central: number | null;
  id_viaje_persona_central: number | null;
}

// Costos del viaje (GET/PATCH /viajes/{id}/costos/). Tiene DOS columnas: lo que
// cobra el proveedor y lo que se le factura al cliente. Por cada lado, la base
// (`costo_viaje_*`) sale del tarifario de los tramos y el total lo calcula el
// backend: ninguno de los dos se edita desde el front (ver CostoViajePatch).
export interface CostoViaje {
  id: number;
  viaje: number;
  costo_viaje_proveedor: string;
  costo_espera_proveedor: string;
  costo_peajes_proveedor: string;
  costo_estacionamiento_proveedor: string;
  costo_otros_proveedor: string;
  costo_total_proveedor: string;
  moneda_proveedor: string;
  costo_viaje_cliente: string;
  costo_espera_cliente: string;
  costo_peajes_cliente: string;
  costo_estacionamiento_cliente: string;
  costo_otros_cliente: string;
  costo_total_cliente: string;
  moneda_cliente: string;
  // Los comentarios del costo son VARIOS y vienen embebidos acá (antes era un
  // único campo `comentario` de texto, que el backend eliminó). Se agregan,
  // editan y borran por /viajes/{id}/costos/comentarios/.
  comentarios: ComentarioCosto[];
  horas_disponibles: number;
  updated_at: string;
}

// Un comentario del costo de un viaje. El `autor` lo fija el backend con el
// usuario logueado; solo `texto` es escribible.
//
// OJO: no trae el ROL del autor, solo su id y su nombre. La vista muestra una
// chapita con el lado del mostrador (Administración / Proveedor / Agencia) y
// contra el backend queda sin poner, porque no hay de dónde sacarla.
export interface ComentarioCosto {
  id: number;
  texto: string;
  autor: number;
  autor_nombre: string;
  created_at: string;
  updated_at: string;
}

// Ajustes manuales de los costos (PATCH /viajes/{id}/costos/). NO incluye la base
// del tarifario (`costo_viaje_*`) ni los totales: los resuelve el backend. Si el
// viaje todavía no tiene costo, el PATCH lo crea.
export interface CostoViajePatch {
  costo_espera_proveedor?: string;
  costo_peajes_proveedor?: string;
  costo_estacionamiento_proveedor?: string;
  costo_otros_proveedor?: string;
  moneda_proveedor?: string;
  costo_espera_cliente?: string;
  costo_peajes_cliente?: string;
  costo_estacionamiento_cliente?: string;
  costo_otros_cliente?: string;
  moneda_cliente?: string;
  horas_disponibles?: number;
}

// ── Tarifario ────────────────────────────────────────────────────────────────
// Zona/ubicación tarifada (aeropuerto o barrio). Es el catálogo con el que se
// arman las rutas del tarifario: `codigo_ref` (EZE, AEP, CABA…) es la clave con
// la que se cotiza.
export interface Zona {
  id: number;
  nombre: string;
  tipo: "AEROPUERTO" | "ZONA";
  codigo_ref: string;
  iata: string;
  latitud: string | null;
  longitud: string | null;
  // GeoJSON del área cubierta por la zona (el front no lo usa: cotiza por código).
  poligono?: unknown | null;
  prioridad: number;
  activo: boolean;
}

// Proveedor tal como lo devuelve el backend (catálogo propio, con sus valores
// por hora de espera y de disponibilidad).
export interface ProveedorApi {
  id: number;
  nombre: string;
  id_proveedor_central: number | null;
  // Valor por HORA (no por minuto) de espera y de hora a disposición, y valor
  // por km adicional. Son los "extras" del proveedor: se leen acá (también
  // vienen anidados en el viaje) y se escriben por
  // PATCH /tarifarios/proveedores/{id}/.
  valor_espera: string | null;
  valor_hora_dispo: string | null;
  valor_km_adicional: string | null;
}

// Cuerpo escribible de los extras del proveedor. `nombre` e `id` son read-only:
// el admin edita cualquiera, un usuario proveedor solo el suyo.
export interface ProveedorValoresPatch {
  valor_espera?: string;
  valor_hora_dispo?: string;
  valor_km_adicional?: string;
}

// Tarifa con su categoría de servicio (tipo de vehículo) anidada, tal como sale
// de la cotización.
export interface TarifaApi {
  id: number;
  categoria_servicio: CategoriaServicio;
  precio_cliente: string | null;
  moneda_cliente: string;
  precio_proveedor: string;
  moneda_proveedor: string;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
}

// Tarifa en su forma CRUD (ids planos), como la devuelve /tarifarios/tarifas/.
export interface TarifaCRUD {
  id: number;
  proveedor: number;
  origen: number;
  destino: number;
  categoria_servicio: number;
  precio_cliente: string | null;
  moneda_cliente: string;
  precio_proveedor: string;
  moneda_proveedor: string;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  activo: boolean;
}

export interface ProveedorCotizacion {
  proveedor: ProveedorApi;
  tarifas: TarifaApi[];
}

// Respuesta de /tarifarios/cotizar/ y /cotizar-por-codigo/: todas las tarifas
// vigentes de la ruta, agrupadas por proveedor.
export interface CotizarOutput {
  tarifa_encontrada: boolean;
  detalle: string;
  origen: Zona | null;
  destino: Zona | null;
  proveedores: ProveedorCotizacion[];
}

export interface Viaje {
  id: number;
  numero_viaje: string;
  referencia_externa: string;
  agencia: number;
  solicitante: number | null;
  categoria_servicio: number;
  // Proveedor asignado al viaje. En lectura viene anidado; se escribe con el id
  // (ViajeWrite.proveedor).
  proveedor: ProveedorApi | null;
  estado: number;
  fecha_servicio: string;
  hora_servicio: string;
  tipo_servicio: TipoServicio;
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
  puede_cancelar: boolean;
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
  // Tarifa elegida para el tramo (id del tarifario). Es lo que le da su costo al
  // viaje: al crearlo con tarifa, el backend genera el registro de costos con la
  // base del tarifario.
  tarifa?: number | null;
}

// Cuerpo escribible de un viaje (POST/PUT/PATCH). Solo campos editables.
export interface ViajeWrite {
  referencia_externa?: string;
  agencia: number;
  solicitante?: number | null;
  categoria_servicio: number;
  // Id del proveedor que presta el servicio (null = sin asignar).
  proveedor?: number | null;
  estado?: number;
  fecha_servicio: string;
  hora_servicio: string;
  tipo_servicio: TipoServicio;
  // Alta de pasajeros en la misma llamada de creación del viaje. El backend los
  // crea como Personas y marca al principal (`PasajeroWrite.es_principal`); el
  // viaje ya no expone un campo `pasajero_principal`.
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
// `provider` es el rol nuevo (deck "Nuevo Rol: Proveedor"): carga/edita tarifas
// y modifica los costos de los viajes que tiene asignados. OJO con el nombre: el
// enum del backend está en INGLÉS (`provider`), no en español.
export type RoleEnum = "admin" | "agency_staff" | "agency_operator" | "provider";

// Lectura del usuario autenticado (GET /auth/me/). `agencia` y `proveedor` son
// los vínculos del usuario con su organización: el backend ya los resuelve, así
// que no hay que inferirlos (antes la agencia se cruzaba por email contra el
// catálogo de solicitantes).
export interface MeProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleEnum | null;
  phone: string;
  agencia?: Agencia | null;
  proveedor?: ProveedorApi | null;
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
