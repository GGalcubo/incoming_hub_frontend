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
