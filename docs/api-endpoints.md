# Backend API — Incoming Hub

- **Base URL:** `https://incoming-hub-00af8e68af77.herokuapp.com/api/v1`
- **Swagger / docs:** https://incoming-hub-00af8e68af77.herokuapp.com/api/docs/
- **OpenAPI schema (JSON):** `/api/schema/`
- **Auth:** JWT (SimpleJWT). `POST /auth/login/` → `{ access, refresh }`. El resto requiere `Authorization: Bearer <access>`.

> ⚠️ **No existen endpoints de Excel.** No hay `/trips/excel/parse` ni `/trips/excel/sync`.
> La carga por Excel debe: (1) parsear el `.xlsx` en el frontend y (2) crear cada
> viaje con `POST /viajes/` (que ahora acepta pasajeros **y tramos** anidados en
> el mismo POST). Para alta masiva todo-o-nada existe además `POST /viajes/bulk/`.

## Auth
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login/` | Obtener access + refresh con credenciales |
| POST | `/auth/register/` | Crear usuario (email, username, password, role) |
| POST | `/auth/refresh/` | Renovar access con refresh |
| GET/PUT/PATCH | `/auth/me/` | Perfil del usuario autenticado |

## Agencias y solicitantes
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/agencies/` | Listar / crear agencias |
| GET/PUT/PATCH/DELETE | `/agencies/{id}/` | Detalle / editar / borrar |
| GET/POST | `/agencies/solicitantes/` | Solicitantes por agencia |
| GET/PUT/PATCH/DELETE | `/agencies/solicitantes/{id}/` | Detalle / editar / borrar |
| GET | `/solicitantes/` | Usuarios elegibles como solicitantes (filtra por agencia/rol) |
| GET | `/solicitantes/{id}/` | Detalle |

## Catálogos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/categorias/` · `/categorias/{id}/` | Categorías de servicio (solo lectura) |
| GET/POST | `/services/` | Alias de categorías (con escritura) |
| GET/PUT/PATCH/DELETE | `/services/{id}/` | Detalle / editar / borrar categoría |
| GET | `/estados/` · `/estados/{id}/` | Estados de viaje |

## Personas (pasajeros)
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/personas/` | Listar (filtra por agencia, search, ordering) / crear |
| GET/PUT/PATCH/DELETE | `/personas/{id}/` | Detalle / editar / borrar |
| GET/POST | `/pasajeros-viaje/` | **Pasajeros de un viaje**: listar / asociar uno nuevo (POST `{ viaje, nombre, … }`) |
| GET/PUT/PATCH/DELETE | `/pasajeros-viaje/{id}/` | Editar (PATCH) / **desasociar** (DELETE) un pasajero del viaje |

## Tramos
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/tramos/` | Listar por viaje / crear (POST `{ viaje, coords… }`, sin `numero_tramo`) |
| GET/PUT/PATCH/DELETE | `/tramos/{id}/` | Detalle / editar / **borrar** (no se puede borrar el principal ni el último) |
| PATCH | `/tramos/{id}/tarifa/` | **Cambiar solo la tarifa del tramo** (`{ tarifa: id \| null }`) |

> En el PATCH normal del tramo la `tarifa` es de **solo lectura**: se manda en el
> alta (dentro de `tramos[]`) o se cambia con el endpoint dedicado. Cambiarla
> recalcula el costo del viaje y **resetea los ajustes manuales** (espera, peajes,
> …), así que si además hay costos que guardar, este PATCH va primero
> (`syncTarifaTramo` → `syncCostos`).

## Tarifario
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/tarifarios/zonas/` · `/zonas/{id}/` | Zonas/aeropuertos tarifados (`codigo_ref`: EZE, AEP, CABA…) |
| POST | `/tarifarios/cotizar/` | Tarifas vigentes de una ruta por **coordenadas** |
| POST | `/tarifarios/cotizar-por-codigo/` | Ídem por **código de zona** (`{ origen, destino, fecha? }`) |
| GET/POST | `/tarifarios/tarifas/` | CRUD de tarifas (el proveedor solo ve/edita las suyas) |
| GET/PUT/PATCH/DELETE | `/tarifarios/tarifas/{id}/` | Detalle / editar / borrar |

La cotización devuelve `proveedores[] → { proveedor, tarifas[] }`, una tarifa por
categoría de vehículo, con `precio_cliente` y `precio_proveedor`. El `id` de la
tarifa elegida es lo que se guarda en el tramo. Ver `api/tarifario.ts`.

## Costos del viaje
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/viajes/{id}/costos/` | Costos del viaje (columnas **proveedor** y **cliente**) |
| PATCH | `/viajes/{id}/costos/` | Ajustes manuales (crea el registro si no existía) |

- La **base** (`costo_viaje_proveedor` / `costo_viaje_cliente`) sale del tarifario
  de los tramos y los **totales** los calcula el backend: ninguno se edita desde
  el front.
- Por PATCH van solo espera, peajes, estacionamiento, otros (de las dos
  columnas), `moneda_*`, `comentario` y `horas_disponibles`.

## Viajes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/viajes/` | Listar (filtros: fecha, estado, pasajero, origen/destino, sync, tipo) |
| POST | `/viajes/` | **Crear viaje con pasajeros y tramos anidados** (una sola llamada) |
| POST | `/viajes/bulk/` | Alta masiva todo-o-nada (lista de viajes con `id_temporal`) |
| GET/PUT/PATCH/DELETE | `/viajes/{id}/` | Detalle / editar (solo campos del viaje) / borrar |
| GET | `/viajes/{id}/historial/` | Historial / auditoría |

### Creación vs. modificación
- **Crear** (`POST /viajes/`): los `pasajeros` y los `tramos` van **anidados en el
  mismo POST**. El backend crea las Personas (fija el principal) y los tramos en
  una sola llamada. Ver `createTrip` / `buildViajePayload` / `buildTramosInput`.
- **Modificar**: van **separados**. `PATCH /viajes/{id}/` toca solo campos del
  viaje; los tramos se sincronizan vía `/tramos/` (`syncTramos`) y los pasajeros
  vía `/pasajeros-viaje/` (`syncPasajeros`), incluyendo desasociar/borrar.

### Flujo tarifa → costos
1. En el alta se elige la tarifa (cotización de la ruta) y se manda en el tramo:
   `tramos: [{ …coords, tarifa: 12 }]`. El wizard cotiza **una** ruta para todo el
   viaje, así que la tarifa se cuelga solo del **tramo principal** (el backend
   suma la de cada tramo).
2. Eso crea el registro de costos con la base del tarifario.
3. `GET /viajes/{id}/costos/` trae los costos del viaje (también vienen embebidos
   en `GET /viajes/{id}/` como `costo`).
4. `PATCH /viajes/{id}/costos/` actualiza los ajustes manuales.

### Proveedor
`viaje.proveedor` (objeto en lectura, id en escritura) y `auth/me.proveedor` /
`auth/me.agencia` ya vienen del backend: no hay que inferirlos ni guardarlos en
un overlay local.

### Tramos — `TramoInput` (coords-only)
- Un tramo = un trayecto = **origen + destino en el MISMO objeto** (4 coordenadas).
  `A→B` = 1 tramo; `A→B→C` = 2 tramos. **No** es una lista de puntos.
- Solo se envían coordenadas (`origen_latitud/longitud`, `destino_latitud/longitud`)
  + `*_es_aeropuerto`/`*_iata` para aeropuertos. **No** se manda dirección de
  texto ni localidad: el backend las resuelve por reverse geocoding.
- Reglas (400): lat y long de un extremo van siempre juntas; cada tramo necesita
  al menos un extremo completo. ⚠️ Implica que un destino sin geocodificar (texto
  libre, sin elegir sugerencia de Google) no tiene coords y **rompería la creación**.

_Fuente: OpenAPI schema en `/api/schema/` + guía del backend (examinado el 2026-06-29)._
