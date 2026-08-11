# Pendientes

Qué falta, en una sola página. El detalle técnico está en
[`api-endpoints.md`](./api-endpoints.md) y de dónde sale cada dato, en
[`limitaciones.md`](./limitaciones.md).

Acá va **solo lo que falta**. Lo que ya se cerró no se archiva en esta página: el
porqué de cada decisión vive en el código (comentario + test) y lo que la app
hace hoy, en [`limitaciones.md`](./limitaciones.md).

Verificado el **08/08/2026** contra la API de Heroku, con los tres usuarios de
prueba (`incomingAdmin`, `proveedor1`, `agencia1`). De la lista anterior el
backend cerró **siete** puntos: el estado *Cancelado*, los códigos de estado,
`ordering`, el recorte de costos por campo, el recorte del historial por rol, el
rol del autor en los comentarios y la escritura del monto base. El front ya se
puso al día con todos. **Quedan tres, y los tres son del backend.**

## 1. Para el backend — falta modelo, campo o permiso

| # | Qué falta | Por qué importa | Cómo verlo |
|---|---|---|---|
| 1 | **Dejar leer el tarifario a los usuarios de agencia.** `GET /tarifarios/tarifas/` y `GET /tarifarios/proveedores/` responden **403** con `agency_operator`: *"Solo un administrador o un usuario proveedor puede operar sobre tarifas."* El permiso contempla admin y proveedor, y ningún rol de agencia. | 🔴 **El *Tarifario* de la agencia (`/tarifas/cliente`) no funciona**: la pantalla muestra el error del backend, no inventa precios. Alcanza con lectura; la agencia no escribe nada. Los otros dos catálogos que la pantalla necesita ya la dejan pasar. | Con `agencia1`: `GET /tarifarios/tarifas/` → 403, `/tarifarios/proveedores/` → 403, `/tarifarios/zonas/` → 200 (3), `/categorias/` → 200 (4). |
| 2 | **Extras por agencia** (espera, hora a disposición y km facturados a cada cliente). Sigue sin haber modelo: `valor_espera`, `valor_hora_dispo` y `valor_km_adicional` existen solo en `Proveedor`; `Agencia` tiene únicamente datos de facturación (cuit, email, centro de costo). | La funcionalidad **no existe**: se eliminó del front porque vivía en el `localStorage` de un navegador. No vuelve hasta que el backend la modele. | `/api/schema/`: ningún componente fuera de `Proveedor*` tiene `valor_espera`. |
| 3 | **El color del estado `WEB` (id 16) es inválido:** `#FFFFF`, cinco dígitos. | El badge se pinta mal (y si fuera blanco de verdad, sería ilegible). Es un dato mal cargado, no un cambio de modelo. | `GET /estados/` → la fila 16. |

## 2. Para el frontend

**Ninguna.** Lo que había se cerró el 08/08/2026, en el mismo repaso.

El último en caer fue el monto base cargado a mano: el PATCH de prueba sobre el
viaje 563 confirmó que el backend lo guarda y que prende `base_manual`, así que
se borró el `Aviso` de *Costos* y `viajeManual` pasó a leerse del servidor. Un
detalle que salió de la misma prueba: `PATCH /tramos/{id}/tarifa/` pisa el monto
manual **aun con la misma tarifa**, pero no molesta porque el front solo llama a
ese endpoint cuando la tarifa cambió de verdad, que es justo cuando la regla de
negocio manda recotizar.

Dos cosas resultaron **no ser** lo que parecían y quedan anotadas para no volver
a levantarlas:

- **El orden de la grilla está bien como está.** Se ordena en el cliente, pero la
  lista está acotada a un día y un día entra en una página (el backend pagina de
  a 20; el día más cargado de la base tiene 12 viajes), así que se ordena el
  resultado entero y no un pedazo. Delegarlo al servidor tampoco alcanzaría:
  `ordering` cubre cinco de las once columnas y las otras seis (origen, destino,
  pasajero, categoría, unidad, observaciones) no tienen equivalente. Mitad y
  mitad se comporta peor. **Sí hay que rehacerlo si algún día un día pasa de una
  página.**
- **`filtrarPorVista` no quedó redundante.** El backend recorta los *campos* de
  costo por rol, pero le sigue mandando a la agencia y al proveedor la auditoría
  entera del viaje (tramos, pasajeros, direcciones, horarios); que en su pantalla
  vaya solo lo de plata lo sigue haciendo el front. Redundante quedó únicamente
  el filtro de columna ajena, que se deja de red.
