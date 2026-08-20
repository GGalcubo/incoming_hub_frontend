# Backend API — Incoming Hub

- **Base URL:** `https://incoming-hub-00af8e68af77.herokuapp.com/api/v1`
- **Swagger / docs:** https://incoming-hub-00af8e68af77.herokuapp.com/api/docs/
- **OpenAPI schema (JSON):** `/api/schema/`
- **Auth:** JWT (SimpleJWT). `POST /auth/login/` → `{ access, refresh }`. El resto requiere `Authorization: Bearer <access>`.

> ⚠️ **No existen endpoints de Excel.** No hay `/trips/excel/parse` ni `/trips/excel/sync`.
> La carga por Excel (1) parsea el `.xlsx` en el frontend y (2) crea los viajes con
> `POST /viajes/bulk/`: alta en lote todo-o-nada, con pasajeros **y tramos**
> anidados igual que el alta individual, más un `id_temporal` por viaje (el front
> manda el número de fila) para mapear los errores de vuelta a la planilla.
> El alta de a uno (`POST /viajes/`) es la que usa el wizard.

> 🔁 **`*_central` se llama `*_externo` (20/08/2026).** El backend renombró TODOS
> los campos que son el puente con el sistema central. Son once, verificados uno
> por uno contra respuestas reales: `sincronizado_externo` e `id_viaje_externo`
> (viaje); `id_cliente_externo` e `id_centro_costo_externo` (agencia);
> `id_categoria_externo` (servicio); `id_tramo_externo`,
> `localidad_origen_externo` / `localidad_destino_externo` y sus
> `id_localidad_*_externo` (tramo); `id_persona_externo` e
> `id_viaje_persona_externo` (pasajero); `id_proveedor_externo` (proveedor). El
> front ya está al día. Todos son **read-only**: los escribe la sincronización.

## Auth
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login/` | Obtener access + refresh con credenciales |
| POST | `/auth/register/` | Crear usuario (email, username, password, role) |
| POST | `/auth/refresh/` | Renovar access con refresh |
| GET/PUT/PATCH | `/auth/me/` | Perfil del usuario autenticado |
| POST | `/auth/change-password/` | Cambio de contraseña (`{ password_actual, password_nueva }`, mínimo 8) |

El cambio de contraseña responde **200 sin cuerpo** y no renueva los tokens: la
sesión sigue viva con el `access` que ya tenía el navegador. Lo usa el modal de
Settings, donde es opcional (con los campos vacíos solo se guarda el perfil).

### Roles (`RoleEnum`)
```
admin | agency_staff | agency_operator | provider
```
⚠️ El rol de proveedor se llama **`provider`**, en inglés — no `proveedor`. Todo el
gateo de UI del front cuelga de esto (`useMe.isProvider`, `proveedorIdOf`,
los `roles` del `NAV` del Topbar).

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

`Estado` = `{ id, codigo, nombre, color, es_final, visible_agencia }`.
`viaje.estado` es el **id** de una de estas filas, y el front lo usa tal cual
(`Trip.est` ES el id): el nombre y el color salen del catálogo.

✅ **La tabla quedó sana.** Verificado contra la API el 08/08/2026 (antes los
códigos venían con casing irregular y espacios al final, `No ` y `NO `
colisionaban al normalizar y no existía "Cancelado"):

- Son **18 filas**: ids 1–10 y 12–18, más el **34** (`CAN`, *Cancelado*,
  `es_final: true`). Sigue sin haber id 11.
- Todos los códigos están en MAYÚSCULAS y sin espacios: `NUE`, `PRE`, `ASI`,
  `CON`, `PRO`, `FIN`, `CER`, `ELI`, `NSH`, `MOD`, `CXL`, `NSP`, `CLX`, `REV`,
  `WEB`, `CAM`, `ORI`, `CAN`. No hay dos que colisionen.
- `GET /viajes/?estado__codigo=<COD>` devuelve **el mismo count** que
  `?estado=<id>` en los 18. El front igual filtra por `estado=<id>`, que es lo
  que ya tenía. Un código fuera del enum (`Con`) sigue dando 400, que es correcto.
- El front resuelve los estados con acciones atadas (`CODIGO_ESTADO` +
  `estadoIdPorCodigo`) por código normalizado, así que **cancelar un viaje ya
  funciona** sin tocar nada.

⚠️ El estado `WEB` (id 16) tiene `color: "#FFFFF"` — cinco dígitos, no es un hex
válido. Ver [`pendientes.md`](./pendientes.md).

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
> El front resuelve la categoría del viaje contra `/services/` y la de la tarifa
> contra `/categorias/`. ✅ Verificado el 06/08/2026: son el **mismo catálogo**
> (ids 1–4, códigos `STD`/`EJEC`/`MB`/`VITO`), así que los ids coinciden. Si
> alguna vez divergen, este PATCH empieza a fallar.

En la **lectura** el tramo trae también `origen_es_aeropuerto` / `origen_iata` y
sus pares de destino, más `id_tramo_externo`. `numero_tramo` es read-only.
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
| PATCH | `/tarifarios/proveedores/{id}/` | Extras del proveedor: `valor_espera`, `valor_hora_dispo`, `valor_km_adicional` y sus `*_cliente` |

Los extras del proveedor se editan por ahí (`nombre` e `id` son read-only; el
admin edita cualquiera, un usuario proveedor solo el suyo) y vienen además
anidados en el `proveedor` del detalle del viaje. Cada valor tiene **dos
columnas**: `valor_x` es lo que cobra el proveedor y `valor_x_cliente` lo que se
le factura al cliente (el rol proveedor no lo ve ni lo manda en el PATCH).

⚠️ **Unidades:** `valor_espera` y `valor_hora_dispo` son **por HORA**; el front
modela la espera **por minuto** (así se carga en el viaje: minutos × valor). La
conversión está en una única constante, `MINUTOS_POR_HORA` en `api/tarifasCrud.ts`
— si se confirma que el backend guarda la espera por minuto, se pone en 1.

La cotización devuelve `proveedores[] → { proveedor, tarifas[] }`, una tarifa por
categoría de vehículo, con `precio_cliente` y `precio_proveedor`. El `id` de la
tarifa elegida es lo que se guarda en el tramo. Ver `api/tarifario.ts`.

`/tarifarios/tarifas/` filtra **server-side** por `proveedor`, `id_proveedor`,
`origen`, `destino`, `categoria_servicio` y `activo`. Es el que usan las pantallas
de Tarifas (`api/tarifasCrud.ts`).

### Lo que este CRUD NO modela
- **No hay tarifario por cliente.** Hay UNA tarifa por (proveedor, origen,
  destino, categoría) con las dos columnas de precio adentro. El *Tarifario* que
  ve la agencia (`/tarifas/cliente`) es esta misma tabla mostrando solo
  `precio_cliente`, de solo lectura y sin las tarifas inactivas — no es otro
  endpoint ni otro modelo. Al admin no se le muestra: en *Tarifas Proveedor* ya
  tiene las dos columnas, así que `/tarifas/cliente` lo redirige (igual que al
  proveedor).

  🔴 **El backend no deja leerlos con un usuario de agencia** (verificado el
  08/08/2026 con `agencia1`, rol `agency_operator`): `GET /tarifarios/tarifas/` y
  `/tarifarios/proveedores/` responden **403** con *"Solo un administrador o un
  usuario proveedor puede operar sobre tarifas."*. `/tarifarios/zonas/` y
  `/categorias/`, que la misma pantalla necesita para traducir los ids, sí pasan
  (200). Así que hoy `/tarifas/cliente` muestra el error del backend —no inventa
  precios— y la función está muerta hasta que le habiliten la lectura. Ver
  [`pendientes.md`](./pendientes.md).
- **No hay extras POR AGENCIA.** Los extras del proveedor sí traen sus dos
  columnas (`valor_x` y `valor_x_cliente`, arriba), pero no existe un set por
  cliente. El front ya no lo ofrece: la pantalla que lo editaba guardaba en
  localStorage y se eliminó. Ver [`pendientes.md`](./pendientes.md).

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

- Los **totales** los calcula el backend y no se mandan nunca.
- La **base** (`costo_viaje_proveedor` / `costo_viaje_cliente`) sale del tarifario
  de los tramos. El paso Costos deja corregirla a mano (imprescindible cuando la
  ruta no cotiza) y la manda en el PATCH. ✅ **El backend la guarda**, probado con
  un PATCH real el 08/08/2026 sobre el viaje 563 (hasta el 06/08
  `PatchedCostoViajeUpdate` no incluía los campos y DRF los descartaba en
  silencio). Al mandarla se prende **`base_manual`** —booleano de solo lectura del
  GET—, que el front lee para saber que el monto lo escribió una persona.
- Por PATCH van espera, peajes, estacionamiento, otros (de las dos columnas),
  `moneda_*`, `horas_disponibles` y la base solo si se editó a mano.
- ⚠️ `PATCH /tramos/{id}/tarifa/` **resetea a 0 todos los ajustes manuales, pisa
  la base con la del tarifario y apaga `base_manual`** — aun reenviando la MISMA
  tarifa. Por eso `syncTarifaTramo` corre antes que `syncCostos` y, cuando la
  tarifa cambió, el PATCH de costos reenvía todos los rubros (`force`). Y por eso
  el front solo llama a ese endpoint cuando la tarifa cambió de verdad: reenviar
  la misma borraría el precio cargado a mano.

  Comprobado en el 563: base manual 123.45/234.56 → `PATCH /tramos/533/tarifa/`
  con la misma tarifa (2) → vuelve 35.00/40.00 y `base_manual: false`.

### Comentarios del costo
El viejo campo `comentario` (string único) **ya no existe**: son varios y vienen
embebidos en el GET de costos como `comentarios[]`, con
`{ id, texto, autor, autor_nombre, autor_rol, created_at, updated_at }`. El
`autor` lo fija el backend con el usuario logueado; solo `texto` es escribible.

✅ **`autor_rol` ya viene** (se agregó entre el 06 y el 08/08/2026): es un código
de `RoleEnum` y es lo que dibuja la chapita del lado del mostrador
(Administración / Proveedor / Agencia). El front ya lo usa. Ojo que no hay ningún
comentario cargado en la base, así que el valor real está sin ver.

La colección **no se lee por separado**: `GET /viajes/{id}/costos/comentarios/`
da **405**. Los comentarios llegan embebidos en el GET de costos, que es como el
front ya los toma.

## Viajes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/viajes/` | Listar (filtros: fecha, estado, pasajero, origen/destino, sync, tipo) |
| GET | `/viajes/?fecha_servicio=&page=` | Lo que usa la lista mirando un día |
| GET | `/viajes/?fecha_servicio__gte=&fecha_servicio__lte=&ordering=&page=` | Lo que usa mirando un rango |
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

✅ **El recorte también es por campo** (desde el 08/08/2026; antes venían las dos
columnas a todos). `GET /viajes/{id}/costos/` con `proveedor1` no trae **ningún**
campo `*_cliente` —ni `costo_viaje_cliente`, ni `costo_total_cliente`, ni
`moneda_cliente`—; con `agencia1` trae el espejo, solo los `*_cliente`. El admin
sigue viendo las dos. Por eso en `CostoViaje` las dos columnas son **opcionales**:
se leen con `num()`, que trata el campo ausente como 0.

### Filtros de `/viajes/` (server-side)
`agencia`, `estado`, `estado__codigo`, `fecha_servicio`, `fecha_servicio__gte`,
`fecha_servicio__lte`, `tipo_servicio`, `sincronizado_externo`, `search`,
`pasajeros__persona__nombre__icontains`, `tramos__origen_direccion__icontains`,
`tramos__destino_direccion__icontains`, `ordering`, `page`.

`listTrips` usa `page` + los filtros de la grilla + **uno de dos filtros de
fecha**, no la tabla entera (antes hacía `fetchAll("/viajes/")` y filtraba por
fecha en el navegador):

- **Un día** (`from === to`, el 99% de las cargas) → `fecha_servicio`, como
  siempre.
- **Un rango** de hasta 31 días → `fecha_servicio__gte` + `fecha_servicio__lte`,
  los dos extremos incluidos, más `ordering` (ver abajo). El tope de 31 días lo
  pone el FRONT (`MAX_RANGE_DAYS`), no el backend: la lista se pagina de a 20 y
  un rango abierto son decenas de llamadas para llenar la tabla. El paginador se guía por `count` y `next`; el
tamaño de página lo fija el backend y no hay `page_size` para pedirlo distinto. Si
la página se va de rango, DRF responde **404 "Invalid page"** y `listTrips`
reintenta en la primera, devolviendo en `page` cuál sirvió.

Cuáles de esos filtros sirven de verdad (probados contra la API el 06/08/2026):

| Filtro | Anda | Detalle |
|---|---|---|
| `fecha_servicio` | ✅ | Es el eje de la lista. |
| `estado` (id) | ✅ | `?estado=1` → 80, `?estado=9` → 32. **Es el que usa el front.** |
| `estado__codigo` | ✅ | Desde el 08/08/2026 da el mismo count que `?estado=<id>` en los 18 estados. Un código fuera del enum (`Con`) da 400. El front igual filtra por id. |
| `search` | ✅ | Solo `numero_viaje` / `referencia_externa`. **No** busca por pasajero ni por agencia. |
| `pasajeros__persona__nombre__icontains` | ✅ | Es la única forma de buscar por pasajero, y es case-insensitive. |
| `ordering` | ✅ | Desde el 08/08/2026 responde a `fecha_servicio`, `hora_servicio`, `numero_viaje`, `estado` e `id`, en los dos sentidos (antes daban todos el mismo orden). `estado` ordena por **nombre** alfabético, no por id. **Lo usa el front cuando se mira un rango**, donde el resultado no entra en una página. |
| `fecha_servicio__gte` / `__lte` | ✅ | Probados contra la API el 20/08/2026 con las 130 filas de la base: se bajó todo, se contó por fecha en memoria y se comparó con el `count` filtrado. Da exacto en los 7 casos (un día vía gte/lte, dos días, junio entero, agosto entero, un rango que cruza meses, viajes justo en los bordes, y un rango vacío). **Los dos extremos son inclusive.** |

Por eso la búsqueda de la grilla son **dos campos** (nº de viaje y pasajero): no
hay un `search` que cruce las dos cosas.

El orden de columnas se hace **de los dos lados, según lo que se esté mirando**
(`TripsList.tsx` → `canSort` / `orderingParam`):

- **Un día** entra en una página, así que ordena el navegador el resultado
  entero: valen las once columnas.
- **Un rango** no entra, así que ordena el servidor con `ordering`, que sabe
  cuatro de las once (ID, fecha, hora, estado). **Sin `ordering` el rango NO
  viene cronológico** (probado el 20/08/2026 sobre junio: 70 viajes, 4 páginas),
  así que pedirlo no es opcional: sin eso la página 1 mezcla días sueltos. Las otras seis (origen, destino,
  pasajero, categoría, unidad, observaciones) **quedan sin ordenar** mientras haya
  un rango a la vista: ordenarlas en el navegador ordenaría la página cargada y
  no el rango, que se ve igual pero está mal. Por fecha se pide
  `fecha_servicio,hora_servicio`, si no las horas de cada día quedan sueltas.

### Creación vs. modificación
- **Crear** (`POST /viajes/`): los `pasajeros` y los `tramos` van **anidados en el
  mismo POST**. El backend crea las Personas (fija el principal) y los tramos en
  una sola llamada. Ver `createTrip` / `buildViajePayload` / `buildTramosInput`.
- **Crear en lote** (`POST /viajes/bulk/`): lista de viajes con la misma forma que
  el alta individual más `id_temporal`. Es **todo o nada**: 201 con
  `{ creados: [{ id_temporal, viaje }] }`, o 400 con
  `{ errores: [{ id_temporal, errores }] }` y **ningún** viaje creado. Lo usa la
  carga por Excel (`createTripsBulk` → `importExcelRows`), que manda el número de
  fila como `id_temporal` para mostrar "Fila 7: …".
- **Modificar**: van **separados**. `PATCH /viajes/{id}/` toca solo campos del
  viaje; los tramos se sincronizan vía `/tramos/` (`syncTramos`) y los pasajeros
  vía `/pasajeros-viaje/` (`syncPasajeros`), incluyendo desasociar/borrar.

### Pasajeros del viaje
`viaje.pasajeros` (read-only) es la **única** fuente: cada item trae `persona`,
`nombre`, `telefono`, `dni`, `email`, `es_principal` + `id_persona_externo` /
`id_viaje_persona_externo`. **`viaje.pasajero_principal` ya no existe** — el
principal se marca con `es_principal` (en el alta, dentro de `pasajeros[]`).
`puede_cancelar` es **boolean** (antes venía como string).

### Historial del viaje
`GET /viajes/{id}/historial/` devuelve la auditoría **agregada** del más reciente
al más antiguo: no solo los cambios del viaje, también los de sus tramos,
pasajeros, costos y comentarios. `modelo` viene en singular y capitalizado
(`Viaje`, `Tramo`, `Pasajero`, `Costo`). Cada entrada:

```json
{
  "modelo": "Viaje",
  "objeto_id": 42,
  "accion": "update",
  "fecha": "2026-07-30T14:03:11Z",
  "usuario": 7,
  "cambios": { "estado": [1, 2], "unidad_asignada": ["", "PROXY-08"] }
}
```

⚠️ **No viene paginado**, aunque el schema lo declare como
`PaginatedHistorialEntradaList`: la respuesta es la **lista pelada**, sin
`count`/`next`/`results`. Leerlo con el `fetchAll` de `api/http.ts` rompe con
"results is not iterable"; `api/historial.ts` acepta las dos formas.

`cambios` es `{ campo: [antes, después] }` con los nombres de campo **del modelo**
(`hora_servicio`, `costo_espera_proveedor`, …): el front los traduce en
[`api/historial.ts`](../src/api/historial.ts), que además esconde `id`, `viaje`,
`created_at` y `updated_at` (ruido en toda modificación).

✅ **El endpoint recorta por rol** (desde el 08/08/2026; antes mandaba el diff
completo a todos). En los 12 cambios del viaje 563, a `proveedor1` le llegan solo
los campos `*_proveedor` y a `agencia1` solo los `*_cliente`. El filtro del front
(`filtrarPorVista` en `api/historial.ts`, con el rol resuelto en
`api.historialVista()`) quedó **redundante**: se deja como red, pero hoy no saca
nada.

⚠️ **`usuario` es el ID del autor, no su nombre** (y es `null` cuando el cambio no
vino de un request HTTP). El front resuelve el nombre contra `/solicitantes/`, que
devuelve `User`; si el rol logueado no puede listarlo, cae a “Usuario #id”. Sería
más barato que el historial trajera el nombre, como ya hace `ComentarioCosto` con
`autor_nombre`.

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
