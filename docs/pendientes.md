# Pendientes

Qué falta, en una sola página. El detalle técnico está en
[`api-endpoints.md`](./api-endpoints.md) y de dónde sale cada dato, en
[`limitaciones.md`](./limitaciones.md).

Acá va **solo lo que falta**. Lo que ya se cerró no se archiva en esta página: el
porqué de cada decisión vive en el código (comentario + test) y lo que la app
hace hoy, en [`limitaciones.md`](./limitaciones.md).

Verificado el **08/08/2026** contra la API de Heroku, con los tres usuarios de
prueba (`incomingAdmin`, `proveedor1`, `agencia1`). De la lista anterior el
backend cerró **seis** puntos: el estado *Cancelado*, los códigos de estado,
`ordering`, el recorte de costos por campo, el recorte del historial por rol y el
rol del autor en los comentarios. Lo que sigue es lo que quedó.

## 1. Para el backend — falta modelo, campo o permiso

| # | Qué falta | Por qué importa | Cómo verlo |
|---|---|---|---|
| 1 | **Dejar leer el tarifario a los usuarios de agencia.** `GET /tarifarios/tarifas/` y `GET /tarifarios/proveedores/` responden **403** con `agency_operator`: *"Solo un administrador o un usuario proveedor puede operar sobre tarifas."* El permiso contempla admin y proveedor, y ningún rol de agencia. | 🔴 **El *Tarifario* de la agencia (`/tarifas/cliente`) no funciona**: la pantalla muestra el error del backend, no inventa precios. Alcanza con lectura; la agencia no escribe nada. Los otros dos catálogos que la pantalla necesita ya la dejan pasar. | Con `agencia1`: `GET /tarifarios/tarifas/` → 403, `/tarifarios/proveedores/` → 403, `/tarifarios/zonas/` → 200 (3), `/categorias/` → 200 (4). |
| 2 | **Extras por agencia** (espera, hora a disposición y km facturados a cada cliente). Sigue sin haber modelo: `valor_espera`, `valor_hora_dispo` y `valor_km_adicional` existen solo en `Proveedor`; `Agencia` tiene únicamente datos de facturación (cuit, email, centro de costo). | La funcionalidad **no existe**: se eliminó del front porque vivía en el `localStorage` de un navegador. No vuelve hasta que el backend la modele. | `/api/schema/`: ningún componente fuera de `Proveedor*` tiene `valor_espera`. |
| 3 | **El color del estado `WEB` (id 16) es inválido:** `#FFFFF`, cinco dígitos. | El badge se pinta mal (y si fuera blanco de verdad, sería ilegible). Es un dato mal cargado, no un cambio de modelo. | `GET /estados/` → la fila 16. |

## 2. Para el backend — por confirmar

| # | Qué confirmar | Por qué importa |
|---|---|---|
| 4 | **Que el monto base escrito a mano efectivamente persista.** El serializer ya lo acepta: `PatchedCostoViajeUpdate` incluye `costo_viaje_proveedor` y `costo_viaje_cliente`, y `CostoViaje` expone un campo nuevo `base_manual` (booleano, solo lectura) que es justo el flag que pedíamos. Falta probar que un `PATCH /viajes/{id}/costos/` lo guarde, que prenda `base_manual`, y que `PATCH /tramos/{id}/tarifa/` **no lo pise** cuando está prendido. |  Es lo único que le pone precio a un viaje cuya ruta no cotiza. Hasta confirmarlo, el paso *Costos* sigue avisando que el monto no se guarda. Se prueba con un PATCH real: leer los valores, escribir, releer, recalcular la tarifa del tramo y restaurar. |

## 3. Para el frontend — al día del backend

Deuda que nació el 08/08/2026, cuando el backend cerró sus puntos: son cosas que
el front todavía hace como si el servidor no las tuviera.

| # | Qué hacer | Dónde |
|---|---|---|
| 5 | **Usar `base_manual` del servidor** en vez del `viajeManual` en memoria, y **sacar el `Aviso`** de que el monto no se guarda. Depende de confirmar el punto 4. | `pages/TripWizard/steps/StepCostos.tsx`, `types/domain.ts` |
| 6 | **Poner la chapita de rol en los comentarios**: `ComentarioCosto` ya trae `autor_rol`. (No hay ningún comentario cargado en la base, así que el valor real está sin ver.) | `api/backend.ts`, la vista de comentarios |
| 7 | **Revisar el orden del selector de estados.** `estadosToStatusMeta` ordena por id porque ese era el orden operativo; *Cancelado* entró con el **id 34**, así que ahora queda último de la lista. | `api/viajes.ts` |
| 8 | **Limpiar los comentarios sobre el casing de los códigos** (`CODIGO_ESTADO`, `normCodigo`, los estados de `viajes.test.ts`): describen una tabla que ya no existe. La normalización puede quedarse igual, es barata. | `api/viajes.ts`, `api/viajes.test.ts` |
| 9 | **Decidir qué hacer con `filtrarPorVista`.** El backend ya recorta el historial por rol, así que quedó redundante. Sirve de red por si el servidor vuelve atrás, pero hoy no filtra nada. | `api/historial.ts` |
| 10 | **Delegar el orden de la grilla al servidor.** Hoy se ordena sobre la página cargada porque `ordering` solo respondía a `fecha_servicio`; ahora responde a `hora_servicio`, `numero_viaje`, `estado` e `id` en los dos sentidos. Ordenar sobre una página suelta es engañoso: reacomoda 20 filas de 119. | `pages/TripsList.tsx`, `api/viajes.ts` |
