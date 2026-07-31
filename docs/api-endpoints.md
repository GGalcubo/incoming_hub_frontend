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

### Roles (`RoleEnum`)
```
admin | agency_staff | agency_operator | provider
```
⚠️ El rol de proveedor se llama **`provider`**, en inglés — no `proveedor`. Todo el
gateo de UI del front cuelga de esto (`useMe.isProvider`, `proveedorIdOf`,
`clienteScope`, los `roles` del `NAV` del Topbar).

`/auth/me/` devuelve además `agencia` (objeto `Agencia`) y `proveedor` (objeto
`Proveedor`) ya resueltos: **no** hay que inferir la agencia cruzando el email
contra el catálogo de solicitantes.

## Agencias y solicitantes
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/agencies/` | Listar / crear agencias |
| GET/PUT/PATCH/DELETE | `/agencies/{id}/` | Detalle / editar / borrar |
| GET/POST | `/agencies/solicitantes/` | Solicitantes por agencia |
| GET/PUT/PATCH/DELETE | `/agencies/solicitantes/{id}/` | Detalle / editar / borrar |
| GET | `/solicitantes/` | Usuarios elegibles como solicitantes — devuelve **`User`**, no `Solicitante` (filtros: `agencia`, `role`, `is_active`, `search`) |
| GET | `/solicitantes/{id}/` | Detalle (`User`) |

> Ojo con los dos recursos parecidos: `/agencies/solicitantes/` es el catálogo de
> **contactos** de una agencia (`Solicitante`: nombre, email, puesto, es_principal)
> y es el que usa el front; `/solicitantes/` lista **usuarios** del sistema.

## Catálogos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/categorias/` · `/categorias/{id}/` | Categorías de servicio (solo lectura) |
| GET/POST | `/services/` | Alias de categorías (con escritura) |
| GET/PUT/PATCH/DELETE | `/services/{id}/` | Detalle / editar / borrar categoría |
| GET | `/estados/` · `/estados/{id}/` | Estados de viaje (filtros: `es_final`, `visible_agencia`) |

`Estado` = `{ id, codigo, nombre, color, es_final, visible_agencia }`. Códigos:

```
NUE PRE ASI CON PRO FIN CER ELI CAN NSH MOD CXL CLX REV WEB
```

⚠️ **Pendiente:** `viaje.estado` es un **entero** y el front todavía lo traduce con
la tabla hardcodeada `ESTADO_TO_STATUS` (ids 1–9) en `api/viajes.ts`. Son 15
estados: cualquier id fuera de 1–9 cae silenciosamente a `PENDIENTE`. Hay que
migrar ese mapeo al catálogo real (requiere leer `/estados/` con credenciales).

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
>
> ⚠️ Valida que la tarifa sea **de la misma categoría del viaje** (400 si no).
> Ojo: el front resuelve la categoría del viaje contra `/services/` y la de la
> tarifa contra `/categorias/`; si los ids no son los mismos, este PATCH falla.

En la **lectura** el tramo trae también `origen_es_aeropuerto` / `origen_iata` y
sus pares de destino, más `id_tramo_central`. `numero_tramo` es read-only.
**`pasajeros_tramo` ya no existe**: los pasajeros no se cuelgan del tramo sino del
viaje (`viaje.pasajeros`).

## Tarifario
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/tarifarios/zonas/` · `/zonas/{id}/` | Zonas/aeropuertos tarifados (`codigo_ref`: EZE, AEP, CABA…) |
| POST | `/tarifarios/cotizar/` | Tarifas vigentes de una ruta por **coordenadas** |
| POST | `/tarifarios/cotizar-por-codigo/` | Ídem por **código de zona** (`{ origen, destino, fecha? }`) |
| GET/POST | `/tarifarios/tarifas/` | CRUD de tarifas (el proveedor solo ve/edita las suyas) |
| GET/PUT/PATCH/DELETE | `/tarifarios/tarifas/{id}/` | Detalle / editar / borrar |
| GET | `/tarifarios/proveedores/` · `/{id}/` | **Catálogo de proveedores** (id, nombre y sus valores de extras) |
| PATCH | `/tarifarios/proveedores/{id}/` | Extras del proveedor: `valor_espera`, `valor_hora_dispo`, `valor_km_adicional` |

Los extras del proveedor se editan por ahí (`nombre` e `id` son read-only; el
admin edita cualquiera, un usuario proveedor solo el suyo) y vienen además
anidados en el `proveedor` del detalle del viaje.

⚠️ **Unidades:** `valor_espera` y `valor_hora_dispo` son **por HORA**; el front
modela la espera **por minuto** (así se carga en el viaje: minutos × valor). La
conversión está en una única constante, `MINUTOS_POR_HORA` en `api/tarifasCrud.ts`
— si se confirma que el backend guarda la espera por minuto, se pone en 1.

La cotización devuelve `proveedores[] → { proveedor, tarifas[] }`, una tarifa por
categoría de vehículo, con `precio_cliente` y `precio_proveedor`. El `id` de la
tarifa elegida es lo que se guarda en el tramo. Ver `api/tarifario.ts`.

`/tarifarios/tarifas/` filtra **server-side** por `proveedor`, `id_proveedor`,
`origen`, `destino`, `categoria_servicio` y `activo`. Es el que usan las pantallas
de Tarifas (`api/tarifasCrud.ts`); `api/tarifas.ts` quedó como mock para el modo
sin backend.

### Lo que este CRUD NO modela (y el front sigue resolviendo local)
- **No hay tarifario por cliente.** Hay UNA tarifa por (proveedor, origen,
  destino, categoría) con las dos columnas de precio adentro. "Tarifas Cliente"
  es la misma tabla mostrando `precio_cliente`, no un tarifario aparte.
- **La columna CLIENTE de los extras no existe.** El proveedor tiene sus tres
  valores (arriba), pero no hay equivalente de lo que se le factura al cliente,
  ni un set de extras por cliente. Esa mitad sigue en localStorage y lo avisan
  las pantallas.

Los ids de `origen`/`destino` son **zonas** (`/tarifarios/zonas/`) y el de
`categoria_servicio` sale de `/categorias/`: el front traduce en los dos sentidos
contra esos catálogos (cacheados por sesión). Al editar se manda **PATCH** (no
PUT) para no pisar las vigencias, y `precio_cliente` se **omite** si no está
cargado en vez de mandarse en `null` — el proveedor no lo ve, y mandarlo vacío
desde su pantalla borraría el precio de venta.

## Costos del viaje
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/viajes/{id}/costos/` | Costos del viaje (columnas **proveedor** y **cliente**) |
| PATCH | `/viajes/{id}/costos/` | Ajustes manuales (crea el registro si no existía) |
| POST | `/viajes/{id}/costos/comentarios/` | Agregar comentario (`{ texto }`) |
| PATCH/DELETE | `/viajes/{id}/costos/comentarios/{id}/` | Editar texto / borrar |

- La **base** (`costo_viaje_proveedor` / `costo_viaje_cliente`) sale del tarifario
  de los tramos y los **totales** los calcula el backend: ninguno se edita desde
  el front.
- Por PATCH van solo espera, peajes, estacionamiento, otros (de las dos
  columnas), `moneda_*` y `horas_disponibles`.
- ⚠️ Cambiar la tarifa de un tramo **resetea a 0 todos los ajustes manuales** y
  re-deriva la base: por eso `syncTarifaTramo` corre antes que `syncCostos` y,
  cuando la tarifa cambió, el PATCH de costos reenvía todos los rubros (`force`).

### Comentarios del costo
El viejo campo `comentario` (string único) **ya no existe**: son varios y vienen
embebidos en el GET de costos como `comentarios[]`, con
`{ id, texto, autor, autor_nombre, created_at, updated_at }`. El `autor` lo fija
el backend con el usuario logueado; solo `texto` es escribible.

⚠️ **No viene el ROL del autor**, solo su id y su nombre. La vista muestra una
chapita con el lado del mostrador (Administración / Proveedor / Agencia) y contra
el backend queda sin poner. Si se quiere recuperar, el backend tiene que
exponerlo.

## Viajes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/viajes/` | Listar (filtros: fecha, estado, pasajero, origen/destino, sync, tipo) |
| POST | `/viajes/` | **Crear viaje con pasajeros y tramos anidados** (una sola llamada) |
| POST | `/viajes/bulk/` | Alta masiva todo-o-nada (lista de viajes con `id_temporal`) |
| GET/PUT/PATCH/DELETE | `/viajes/{id}/` | Detalle / editar (solo campos del viaje) / borrar |
| GET | `/viajes/{id}/historial/` | Historial / auditoría |

### Visibilidad por rol (server-side)
`GET /viajes/` y el detalle vienen **filtrados por el rol del usuario logueado**:
admin ve todos; agencia (`agency_staff` / `agency_operator`) los de su agencia;
proveedor (`provider`) los suyos; sin agencia/proveedor asignado, ninguno. Un
detalle fuera de scope da **404** (también en `costos`, `historial`, `tarifa` y
`comentarios`). **El front ya no filtra**: hacerlo encima vaciaba la lista del
proveedor cuando `/auth/me/` no traía el proveedor resuelto.

⚠️ El recorte es **por viaje, no por campo**: el costo del viaje sigue trayendo
las dos columnas, así que el navegador de un proveedor recibe
`costo_viaje_cliente` / `costo_total_cliente` aunque la UI no los muestre. Si la
regla "el proveedor no ve el precio al cliente" es dura, el recorte lo tiene que
hacer el backend.

### Filtros de `/viajes/` (server-side)
`agencia`, `estado`, `estado__codigo`, `fecha_servicio`, `fecha_servicio__gte`,
`fecha_servicio__lte`, `tipo_servicio`, `sincronizado_central`, `search`,
`pasajeros__persona__nombre__icontains`, `tramos__origen_direccion__icontains`,
`tramos__destino_direccion__icontains`, `ordering`, `page`.

⚠️ **Pendiente:** `listTrips` hace `fetchAll("/viajes/")` y se trae la tabla
completa paginando en el cliente. El filtrado y la búsqueda de la grilla deberían
delegarse a estos parámetros.

### Creación vs. modificación
- **Crear** (`POST /viajes/`): los `pasajeros` y los `tramos` van **anidados en el
  mismo POST**. El backend crea las Personas (fija el principal) y los tramos en
  una sola llamada. Ver `createTrip` / `buildViajePayload` / `buildTramosInput`.
- **Modificar**: van **separados**. `PATCH /viajes/{id}/` toca solo campos del
  viaje; los tramos se sincronizan vía `/tramos/` (`syncTramos`) y los pasajeros
  vía `/pasajeros-viaje/` (`syncPasajeros`), incluyendo desasociar/borrar.

### Pasajeros del viaje
`viaje.pasajeros` (read-only) es la **única** fuente: cada item trae `persona`,
`nombre`, `telefono`, `dni`, `email`, `es_principal` + `id_persona_central` /
`id_viaje_persona_central`. **`viaje.pasajero_principal` ya no existe** — el
principal se marca con `es_principal` (en el alta, dentro de `pasajeros[]`).
`puede_cancelar` es **boolean** (antes venía como string).

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

_Fuente: OpenAPI schema en `/api/schema/?format=json` (examinado el 2026-07-29) +
guía del backend._
