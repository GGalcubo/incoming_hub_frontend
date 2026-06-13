# Backend API — Incoming Hub

- **Base URL:** `https://incoming-hub-00af8e68af77.herokuapp.com/api/v1`
- **Swagger / docs:** https://incoming-hub-00af8e68af77.herokuapp.com/api/docs/
- **OpenAPI schema (JSON):** `/api/schema/`
- **Auth:** JWT (SimpleJWT). `POST /auth/login/` → `{ access, refresh }`. El resto requiere `Authorization: Bearer <access>`.

> ⚠️ **No existen endpoints de Excel.** No hay `/trips/excel/parse` ni `/trips/excel/sync`.
> La carga por Excel debe: (1) parsear el `.xlsx` en el frontend y (2) crear cada
> viaje con `POST /viajes/` (que ya acepta pasajeros y, junto con `/tramos/`, los tramos).

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

## Tramos
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/tramos/` | Listar por viaje / crear (origen, destino, tipo IN/OUT/HDS/OTR, vuelo) |
| GET/PUT/PATCH/DELETE | `/tramos/{id}/` | Detalle / editar / borrar |

## Viajes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/viajes/` | Listar (filtros: fecha, estado, pasajero, origen/destino, sync, tipo) |
| POST | `/viajes/` | **Crear viaje con pasajeros y tramos** |
| GET/PUT/PATCH/DELETE | `/viajes/{id}/` | Detalle / editar / borrar |
| GET | `/viajes/{id}/historial/` | Historial / auditoría |

### POST /viajes/ — notas de payload
- `pasajeros`: array de `{ nombre, telefono, dni, email, es_principal }`. El backend
  crea las Personas en el mismo POST y fija el pasajero principal.
- La respuesta expande `pasajeros` como `ViajePersona` (con `persona` = id).
- Los tramos se sincronizan aparte vía `/tramos/` (ver `syncTramos` en `src/api/viajes.ts`).
- El mapeo viaje→payload ya está implementado en `buildViajePayload` (`src/api/viajes.ts`).

_Fuente: OpenAPI schema en `/api/schema/` (examinado el 2026-06-13)._
