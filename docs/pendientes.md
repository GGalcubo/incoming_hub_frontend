# Pendientes

Qué falta, en una sola página. El detalle técnico está en
[`api-endpoints.md`](./api-endpoints.md) y de dónde sale cada dato, en
[`limitaciones.md`](./limitaciones.md).

**Deuda del frontend: ninguna.** Todo lo que sigue depende del backend.

Acá va **solo lo que falta**. Lo que ya se cerró no se archiva en esta página: el
porqué de cada decisión vive en el código (comentario + test) y lo que la app
hace hoy, en [`limitaciones.md`](./limitaciones.md).

Verificado el **06/08/2026**. Los puntos **1 a 5** salieron de respuestas
concretas de la API (con usuario admin y con `proveedor1`), no del schema: cada
uno trae cómo reproducirlo. Los **6 a 8** salen de `/api/schema/`. El **9** es lo
único sin probar: no tenemos un usuario de agencia a mano.

## 1. Para el backend — datos mal cargados o config faltante

Los tres más baratos: no hay que cambiar el modelo, alcanza con cargar/ajustar.
El primero tiene una función caída.

| # | Qué falta | Por qué importa | Cómo verlo |
|---|---|---|---|
| 1 | **Falta el estado "Cancelado".** El schema declara el código `CAN` en `CodigoEnum`, pero la tabla NO lo tiene: `GET /estados/` devuelve `count: 17`, ids del 1 al 18 con el **11 faltante**. | 🔴 **Cancelar un viaje no funciona.** El botón queda deshabilitado a propósito. Antes el front mandaba un id fijo —el 5— que allá es "En Progreso": cancelar dejaba el viaje EN CURSO. | `GET /estados/` y buscar `CAN`. Aparece en Swagger porque ahí se ve el *enum declarado*, no las filas. |
| 2 | **Los códigos de estado guardados no coinciden con el enum del propio backend.** La tabla tiene `Pre`, `Asi`, `Con`, `Fin`, `No `, `NO `… (casing irregular y **espacios al final**) y dos que ni están en el enum (`Cam`, `Ori`). El enum declara 15, todos en MAYÚSCULAS. Encima `No ` (No Show) y `NO ` (NO SHOW +) colisionan al normalizar. | El filtro `estado__codigo` valida contra el enum: da **400** con los códigos reales y **0 resultados** para 14 de los 15. El `codigo` no sirve como clave de nada; el front tuvo que filtrar por `estado=<id>`. | `GET /viajes/?estado__codigo=Con` → 400. `?estado__codigo=CON` → 0. `?estado__codigo=NUE` → 80 (el único que matchea). |
| 3 | **`ordering` casi no ordena.** Solo responde a `fecha_servicio`. `hora_servicio`, `numero_viaje`, `estado` e `id` devuelven siempre el mismo orden: falta `ordering_fields`. | La lista ya está acotada a un día, así que ordenar por fecha no sirve para nada: el orden de columnas quedó sobre la página cargada. | `GET /viajes/?ordering=id` vs `?ordering=-id` → idéntico. Con `fecha_servicio` sí cambia. |

## 2. Para el backend — fugas de datos entre roles

El recorte por rol es **por viaje**, no por campo: el servidor decide qué viajes
ve cada uno, pero de cada viaje manda todo. Hoy la regla "el proveedor no ve el
precio al cliente" se cumple **solo de vista**, y se ve en la pestaña Network.

| # | Qué falta | Evidencia (con el usuario `proveedor1`) |
|---|---|---|
| 4 | **Recortar los costos por campo.** `GET /viajes/{id}/costos/` manda las dos columnas a todos. | El proveedor recibe `costo_viaje_cliente: "40.00"` y `costo_total_cliente: "40.00"` del viaje 563, más `costo_espera/peajes/estacionamiento/otros_cliente` y `moneda_cliente`. |
| 5 | **Recortar el historial por rol.** `GET /viajes/{id}/historial/` devuelve el diff completo a todos. | De las 12 entradas del viaje 563, el diff que le llega al proveedor incluye `costo_viaje_cliente`, `costo_total_cliente` y los otros cinco campos `*_cliente`. El front los filtra (`filtrarPorVista` en `api/historial.ts`), pero viajan igual. |

## 3. Para el backend — falta modelo o campo

| # | Qué falta | Por qué importa |
|---|---|---|
| 6 | **Poder escribir el monto base del viaje.** `PATCH /viajes/{id}/costos/` usa `PatchedCostoViajeUpdate`, que no incluye `costo_viaje_proveedor` ni `costo_viaje_cliente`. Hay que hacerlos escribibles y que `recalcular_costo_viaje` no los pise si vinieron a mano (ojo: `PATCH /tramos/{id}/tarifa/` hoy resetea los ajustes manuales). | Un viaje cuya ruta no tiene tarifa **no puede tener precio**. Se carga en pantalla, se ve en el total y se pierde al recargar: DRF descarta los campos que no declara, sin error. El front ya lo manda: funciona el día que el servidor lo acepte. |
| 7 | **Extras por agencia** (espera, hora a disposición y km facturados a cada cliente). No hay modelo: los extras solo existen por proveedor, y `Agencia` no tiene ningún campo de tarifa. | La funcionalidad hoy **no existe**: se eliminó del front porque vivía en el `localStorage` de un navegador. No vuelve hasta que el backend la modele. |
| 8 | **Rol del autor en los comentarios.** `ComentarioCosto` expone `autor` y `autor_nombre`, no el rol. | La chapita de Administración / Proveedor / Agencia queda sin poner en cada comentario: preferimos no mostrarla antes que deducirla mal. |

## 4. Para el backend — por confirmar

| # | Qué confirmar | Por qué importa |
|---|---|---|
| 9 | **Lectura del tarifario con un usuario de agencia.** `GET /tarifarios/tarifas/` y `GET /tarifarios/proveedores/` (+ `/zonas/` y `/categorias/`, que la pantalla necesita para traducir los ids) con `agency_staff` / `agency_operator`. | Es lo que alimenta el *Tarifario* de la agencia (`/tarifas/cliente`), la pantalla nueva donde el cliente consulta cuánto sale cada traslado. Si el servidor le responde 403, la pantalla muestra el error —no inventa precios— y la función queda muerta hasta que se le habilite la lectura. Probarlo es entrar con un usuario de agencia y abrir *Tarifario*. |
