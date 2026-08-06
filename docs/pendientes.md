# Pendientes

Qué falta, en una sola página. El detalle técnico de cada punto está en
[`api-endpoints.md`](./api-endpoints.md) y [`limitaciones.md`](./limitaciones.md).

Verificado contra `/api/schema/` el **06/08/2026**.

## 1. Depende del backend

El front ya está listo en los tres primeros: manda los datos y funcionan solo el
día que el servidor los acepte.

| # | Qué falta | Por qué importa |
|---|---|---|
| 1 | **Poder escribir el monto base del viaje.** El `PATCH /viajes/{id}/costos/` usa `PatchedCostoViajeUpdate`, que no incluye `costo_viaje_proveedor` ni `costo_viaje_cliente`. Hay que agregarlos como escribibles y que `recalcular_costo_viaje` no los pise si fueron cargados a mano (ojo: `PATCH /tramos/{id}/tarifa/` hoy resetea los ajustes manuales). | Un viaje cuya ruta no tiene tarifa **no puede tener precio**. Se carga en pantalla, se ve en el total y se pierde al recargar: DRF descarta los campos que no declara, sin error. |
| 2 | **Extras por agencia** (espera, hora a disposición y km facturados a cada cliente). No hay modelo: el backend solo los tiene por proveedor. | Se eliminó del front (vivía en el `localStorage` de un navegador): hoy la funcionalidad **no existe**, y no vuelve hasta que el backend la modele. |
| 3 | **Recortar el costo por campo, no solo por viaje.** El costo trae las dos columnas siempre, así que el navegador de un proveedor recibe `costo_viaje_cliente` y `costo_total_cliente` aunque la UI no los muestre. | Si "el proveedor no ve el precio al cliente" es una regla dura, hoy se cumple **solo de vista**. |
| 4 | **Rol del autor en los comentarios.** El backend devuelve id y nombre, no el rol. | La chapita de Administración / Proveedor / Agencia queda sin poner en cada comentario. |

## 2. Deuda del frontend

| # | Qué falta | Estado |
|---|---|---|
| 1 | **Estados del viaje.** `api/viajes.ts` mapea los ids 1–9 a mano; el backend publica 15 códigos en `GET /estados/` (NUE, PRE, ASI, CON, PRO, FIN, CER, ELI, CAN, NSH, MOD, CXL, CLX, REV, WEB). Cualquier id fuera de 1–9 cae en silencio a `PENDIENTE`. | Es el que **bloquea al siguiente**. |
| 2 | **Filtro por estado, búsqueda y orden de la lista de viajes.** Se aplican en el cliente, sobre la página cargada. El backend los soporta (`estado__codigo`, `search`, `ordering`). | Espera al punto 1: un filtro por estado server-side con el mapeo actual mentiría. |
| 3 | **Agencia propia del usuario.** Se infiere cruzando el email del perfil contra el catálogo de solicitantes, cuando `/auth/me/` ya devuelve `agencia` resuelta. | El cruce por email solo hace falta para el nombre del solicitante. |
| 4 | **Unidad asignada.** La columna se muestra en la lista pero no se edita en ninguna pantalla; el campo (`unidad_asignada`) existe en el backend. | — |
| 5 | **La marca de "monto cargado a mano" es de sesión.** No se persiste, así que al reabrir un viaje y cambiar el primer destino, la cotización vuelve a recalcular la base. | Deja de importar si se resuelve el punto 1 del backend. |

## 3. Cerrado, para que no se vuelva a preguntar

- `valor_espera` y `valor_espera_cliente` son **por hora**: la conversión
  `MINUTOS_POR_HORA` de `api/tarifasCrud.ts` está bien.
- El cambio de contraseña ya usa `POST /auth/change-password/`.
- La carga por Excel ya usa `POST /viajes/bulk/` (todo o nada, errores por fila).
- La lista de viajes ya se pide por día y por página; el paginador es real.
- *Tarifas Cliente* quedó oculta a propósito: la tabla de proveedor le muestra al
  admin las dos columnas.
