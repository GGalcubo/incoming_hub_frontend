# Qué muestra la app y de dónde sale

**No hay modo demo ni datos de ejemplo.** Todo lo que se ve sale del backend. Si
el backend no está configurado, o falla, la pantalla muestra el error: nunca un
dato inventado. Antes existía un modo mock (seed + `localStorage`) que se veía
igual que el real; se eliminó por completo el 06/08/2026.

La verdad de los endpoints está en [`api-endpoints.md`](./api-endpoints.md); lo
que falta, en [`pendientes.md`](./pendientes.md).

## Configuración

| Variable | Vacía | Cargada |
| --- | --- | --- |
| `VITE_AUTH_URL` | el login falla con "No hay backend configurado" | login real (Django + SimpleJWT) |
| `VITE_API_URL` | se usa `VITE_AUTH_URL`; si tampoco está, toda llamada falla | backend de viajes y tarifario |
| `VITE_GOOGLE_MAPS_API_KEY` | el buscador de lugares no sugiere nada: la dirección se escribe a mano y se guarda sin coordenadas ni mapa | Places + geocoding reales |

El corte por falta de backend está en `assertBase` /`SIN_BACKEND_MESSAGE`
([`src/api/http.ts`](../src/api/http.ts)); la de Google, en `hasGoogleMapsKey`
([`src/lib/gmaps.ts`](../src/lib/gmaps.ts)).

## Lo que se puede cargar y el servidor NO guarda

Es la lista corta, y cada punto está avisado en pantalla con
[`Aviso`](../src/components/ui/Aviso.tsx).

> **Regla:** si algo se puede editar pero no persiste, tiene que decirlo en la
> misma vista y estar acá. Lo que no se pueda traer del backend, no se muestra.

| Qué | Qué pasa | Vista que lo avisa |
| --- | --- | --- |
| Valor del **viaje** corregido a mano | el PATCH lo manda y hasta el 06/08 el backend lo ignoraba. 🟡 **El serializer ya lo acepta** (y sumó un flag `base_manual`), pero falta probar con un PATCH real que persista y que recalcular la tarifa del tramo no lo pise: hasta entonces el aviso se queda | Viaje → paso *Costos* |
| Direcciones sin API key de Google | se guardan como texto, sin coordenadas ni mapa | paso *Destinos* y carga por Excel |

El valor del viaje es la única forma de ponerle precio a un viaje cuya ruta no
cotiza, por eso se sigue mandando. El detalle y el pedido al backend están en
[`api-endpoints.md`](./api-endpoints.md#costos-del-viaje) y en
[`pendientes.md`](./pendientes.md).

**Cuándo se pisa ese monto** (regla del negocio, no un bug): lo rehace con el
tarifario todo lo que cambie *de qué tarifa* se está hablando — elegir otra
categoría o **cambiar la ruta**. Cambiar solo la modalidad o la cantidad de horas
lo respeta: ahí la tarifa es la misma y el monto escrito es un precio absoluto
para ese viaje. Por eso `viajeManual` no necesita persistirse. Lo fija el test
"recotizar por cambio de ruta pisa el monto con la tarifa nueva".

Los **extras por agencia** (espera / hora a disposición / km facturados a cada
cliente) ya no existen en el front: no hay modelo en el backend y lo único que
había era un set guardado en el `localStorage` de un navegador. Los extras que la
agencia ve en su *Tarifario* son los del **proveedor**, columna cliente.

## Lo que es real

- Login y sesión (JWT, refresh, `/auth/me/`), edición del perfil y **cambio de
  contraseña** (`POST /auth/change-password/`, pide la actual, mínimo 8
  caracteres). La sesión no se corta: los tokens que ya tiene el navegador siguen
  valiendo.
- Viajes: alta, edición por pestaña, cambio de estado, cancelación y baja, con
  sus tramos y pasajeros anidados. La lista viene **recortada por rol** desde el
  servidor (el front ya no filtra), **filtrada por día** (`fecha_servicio`) y
  **paginada**: se pide una página por vez y el paginador usa el `count`/`next`
  de DRF. Los contadores de "hoy / mañana" del encabezado son dos consultas
  aparte, porque son de otros días.
- Comentarios del viaje: cuelgan del costo (`/viajes/{id}/costos/comentarios/`).
  Falta la chapita de rol del autor: el backend ya expone `autor_rol`, el front
  todavía no lo usa (ver [`pendientes.md`](./pendientes.md)).
- Historial del viaje (`/viajes/{id}/historial/`): auditoría agregada del viaje y
  de sus tramos, pasajeros, costos y comentarios, con el diff de cada cambio. El
  autor viene como **ID**, así que el nombre se resuelve contra `/solicitantes/`
  (si el rol no puede listarlo, queda como "Usuario #id"). El recorte por rol
  (agencia y proveedor ven solo los cambios de costos de su columna) lo hace
  **el servidor**.
- Extras del proveedor (espera, hora a disposición y km), en sus **dos** columnas
  (proveedor y cliente), y el catálogo de proveedores
  (`/tarifarios/proveedores/`). Un viaje sin proveedor asignado **no** tiene con
  qué calcular la espera: el campo queda deshabilitado y lo dice.
- Costos del viaje: los rubros manuales se persisten por columna. La base sale
  del tarifario del tramo (la calcula el servidor).
- Pasajeros (`/personas/`): paginación, búsqueda y filtro por agencia, todo
  server-side.
- Catálogos: agencias, categorías de servicio, solicitantes, zonas y categorías
  de vehículo.
- Tarifario base (Tarifas Proveedor → *Tarifas por destino*): ABM contra
  `/tarifarios/tarifas/`, con el scoping por proveedor hecho en el servidor. Es
  **una sola** tarifa por (proveedor, ruta, categoría) con los dos precios
  adentro, y la tabla se recorta por rol: el admin ve las dos columnas y edita;
  el proveedor, solo su costo; la **agencia**, en su *Tarifario*
  (`/tarifas/cliente`), solo lo que paga —sin el costo del proveedor, sin las
  tarifas dadas de baja y sin poder editar nada—. Lo fijan los tres casos de
  [`TarifasBase.test.tsx`](../src/pages/Tarifas/TarifasBase.test.tsx). 🔴 Contra
  el backend real la vista de la agencia **no anda**: da 403 (ver más abajo).
- Cotización de la ruta en el wizard: zonas y tarifas vigentes del servidor.
- Asignación viaje → proveedor: viene con el viaje (`viaje.proveedor`).
- Carga por Excel: el parseo y la validación corren en el navegador (SheetJS) y
  el alta va en lote por `POST /viajes/bulk/` — una sola llamada, **todo o
  nada**, con los errores devueltos fila por fila.

✅ **Confirmado (05/08/2026, contra `/api/schema/`):** `valor_espera` y
`valor_espera_cliente` son **por hora** ("Valor por hora de espera del
proveedor"), así que la conversión `MINUTOS_POR_HORA` de `api/tarifasCrud.ts` es
correcta.

## Lo que arregló el backend (08/08/2026)

Tres cosas que esta página listaba como rotas ya no lo están, verificadas contra
la API con `proveedor1` y `agencia1`:

- **El precio al cliente ya no viaja al navegador del proveedor.** `GET
  /viajes/{id}/costos/` recorta **por campo**: al proveedor no le llega ningún
  `*_cliente`, a la agencia ningún `*_proveedor`.
- **El historial también recorta por rol** desde el servidor. El
  `filtrarPorVista` del front quedó de red, no saca nada.
- **Cancelar un viaje funciona.** El backend cargó el estado *Cancelado* (`CAN`,
  id 34) y el front lo resuelve por código, así que el botón se habilitó solo.
  Antes quedaba deshabilitado a propósito, después de que un id fijo —el 5, que
  allá es "En Progreso"— dejara viajes en curso al cancelarlos.

## Lo que sigue sin cumplirse del lado del servidor

**El *Tarifario* de la agencia (`/tarifas/cliente`) no funciona**: el backend
responde **403** a `GET /tarifarios/tarifas/` y `/tarifarios/proveedores/` con
los roles de agencia. La pantalla muestra el error —no inventa precios— y la
función está muerta hasta que le habiliten la lectura. Ver
[`pendientes.md`](./pendientes.md).
