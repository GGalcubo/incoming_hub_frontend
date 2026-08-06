# Qué es real y qué está mockeado

Inventario de dónde sale cada dato de la app. La verdad de los endpoints está en
[`api-endpoints.md`](./api-endpoints.md); acá se responde otra pregunta: **si toco
esto, ¿lo guarda el servidor o se queda en mi navegador?**

Hay tres modos posibles, según las variables de entorno (`.env.local`):

| Variable | Vacía | Cargada |
| --- | --- | --- |
| `VITE_AUTH_URL` | login mock: entra cualquiera, el rol sale del username | login real (Django + SimpleJWT) |
| `VITE_API_URL` | viajes, pasajeros y tarifario en localStorage | backend real |
| `VITE_GOOGLE_MAPS_API_KEY` | buscador de lugares con lista fija del seed, sin mapa ni coordenadas | Places + geocoding reales |

Las banderas viven en [`src/api/http.ts`](../src/api/http.ts) (`HAS_BACKEND`,
`HAS_AUTH`) y en [`src/lib/gmaps.ts`](../src/lib/gmaps.ts) (`hasGoogleMapsKey`).
Las vistas las usan para mostrar el cartel correspondiente.

## 1. Mock SIEMPRE (aunque el backend esté configurado)

Esto es lo importante: son cosas que se ven y se editan en producción y que **no
llegan al servidor**. Cada una está avisada en pantalla con el componente
[`AvisoMock`](../src/components/ui/AvisoMock.tsx).

> **Regla:** todo lo que sea mock, o que se guarde solo en la sesión / en este
> navegador, tiene que avisarlo en pantalla. Si agregás algo así, poné el
> `AvisoMock` en la misma vista y sumalo a este inventario.

| Qué | Dónde vive | Vista que lo avisa |
| --- | --- | --- |
| Extras **por cliente** (set completo) | `localStorage`, ver [`api/tarifasCliente.ts`](../src/api/tarifasCliente.ts) | Tarifas Cliente → solapa *Extras*, hoy **oculta** (ver abajo) |
| Valor del **viaje** corregido a mano | solo en memoria: el PATCH lo manda pero el backend lo ignora | Viaje → paso *Costos* |
| Extras del proveedor cuando el proveedor **no los tiene cargados** (o el viaje todavía no tiene proveedor): se cae al set de ejemplo | `localStorage` | Tarifas → *Extras* y paso *Costos* (marca `esLocal`) |

Los extras del proveedor ya **no** están partidos al medio: el backend agregó la
columna cliente (`valor_espera_cliente`, `valor_hora_dispo_cliente`,
`valor_km_adicional_cliente`), así que las dos columnas de *Tarifas Proveedor →
Extras* —y el valor/minuto de espera del cliente en los costos del viaje— salen
del servidor. Lo que sigue sin equivalente es un set de extras **por agencia**
(*Tarifas Cliente*).

La pantalla *Tarifas Cliente* está **oculta**: no aparece en la nav y
`/tarifas/cliente` redirige a *Tarifas Proveedor*, porque es la misma tarifa y esa
tabla ya le muestra al admin las dos columnas. El código sigue en
[`pages/Tarifas`](../src/pages/Tarifas/index.tsx) por si hay que revivirla — con
ella queda escondido el único acceso a los extras por agencia de la tabla de
arriba.

El valor del **viaje** (la base del costo) se puede corregir a mano en el paso
Costos, que es la única forma de ponerle precio a un viaje cuya ruta no cotiza.
El monto se manda en el PATCH pero el backend lo ignora: la base la deriva del
tarifario del tramo. La pantalla lo avisa. Ver el detalle y el pedido pendiente en
[`api-endpoints.md`](./api-endpoints.md#costos-del-viaje).

✅ **Confirmado (05/08/2026, contra `/api/schema/`):** `valor_espera` y
`valor_espera_cliente` son **por hora** ("Valor por hora de espera del
proveedor"), así que la conversión `MINUTOS_POR_HORA` de `api/tarifasCrud.ts` es
correcta y no hay que tocar nada.

## 2. Real cuando hay backend

- Login y sesión (JWT, refresh, `/auth/me/`), edición del perfil (nombre,
  apellido, email) y **cambio de contraseña**
  (`POST /auth/change-password/`, pide la actual, mínimo 8 caracteres). La sesión
  no se corta: los tokens que ya tiene el navegador siguen valiendo.
- Viajes: alta, edición por pestaña, cambio de estado, cancelación y baja, con
  sus tramos y pasajeros anidados. La lista viene **recortada por rol** desde el
  servidor (el front ya no filtra), **filtrada por día** (`fecha_servicio`) y
  **paginada**: se pide una página por vez y el paginador usa el `count`/`next`
  de DRF. Los contadores de "hoy / mañana" del encabezado son dos consultas
  aparte, porque son de otros días.
- Comentarios del viaje: cuelgan del costo (`/viajes/{id}/costos/comentarios/`).
  Lo único que se pierde contra el backend es la chapita de rol del autor, que
  el servidor no expone.
- Historial del viaje (`/viajes/{id}/historial/`): auditoría agregada del viaje y
  de sus tramos, pasajeros, costos y comentarios, con el diff de cada cambio. El
  autor viene como **ID**, así que el nombre se resuelve contra `/solicitantes/`
  (si el rol no puede listarlo, queda como “Usuario #id”).
- Extras del proveedor (espera, hora a disposición y km), en sus **dos**
  columnas (proveedor y cliente), y el catálogo de proveedores
  (`/tarifarios/proveedores/`).
- Costos del viaje: los rubros manuales se persisten por columna. La base sale
  del tarifario del tramo (la calcula el servidor), y si se la corrige a mano el
  monto viaja en el PATCH — falta confirmar que el backend acepte escribir
  `costo_viaje_*`, ver [`api-endpoints.md`](./api-endpoints.md).
- Pasajeros (`/personas/`): paginación, búsqueda y filtro por agencia, todo
  server-side.
- Catálogos: agencias, categorías de servicio y solicitantes.
- Tarifario base (Tarifas Proveedor → *Tarifas por destino*): ABM real contra
  `/tarifarios/tarifas/`, con el scoping por proveedor hecho en el servidor. Es
  **una sola** tarifa por (proveedor, ruta, categoría) con los dos precios
  adentro, y al admin se le muestran las dos columnas en la misma tabla: por eso
  *Tarifas Cliente* quedó oculta (la ruta redirige acá).
- Cotización de la ruta en el wizard: zonas y tarifas vigentes del servidor.
- Asignación viaje → proveedor: viene con el viaje (`viaje.proveedor`).
- Carga por Excel: el parseo y la validación corren en el navegador (SheetJS) y
  el alta va en lote por `POST /viajes/bulk/` — una sola llamada, **todo o
  nada**, con los errores devueltos fila por fila. No hay endpoint de Excel en el
  backend, y no hace falta.

## 3. Mock solo sin backend (`VITE_API_URL` vacío)

Con la variable vacía aparece la chapa **Modo demo** en la barra superior. En ese
modo todo sale del seed y del `localStorage`, y **cada pantalla lo avisa**:

| Qué | Dónde vive | Vista que lo avisa |
| --- | --- | --- |
| Viajes | `proxy:mockTrips` | chapa *Modo demo* |
| Pasajeros (derivados de los viajes) | `proxy:mockTrips` | Pasajeros |
| Tarifario base | `proxy:tarifasBase` | Tarifas → *Tarifas por destino* |
| Extras del proveedor | `proxy:tarifasExtras` | Tarifas → *Extras*, y el paso *Costos* |
| Cotización del wizard | `proxy:tarifasBase` | paso *Cotización* |
| Comentarios del viaje | `proxy:tripComentarios` | paso *Costos* |
| Historial del viaje | seed | paso *Historial* |
| Asignación viaje → proveedor | `proxy:tripProveedor` | chapa *Modo demo* |
| Perfil y login (rol derivado del username: `prov…` → proveedor, `agen…`/`cliente…`/`oper…` → operador, el resto → admin) | `proxy:mockMe` | Login y Settings |

Sin API key de Google Maps (`VITE_GOOGLE_MAPS_API_KEY`) el buscador de lugares
cae a una lista fija y los destinos se guardan sin coordenadas: lo avisan el paso
*Destinos* y la carga por Excel.

## 4. Deuda: real, pero desalineado con el backend

No es mock —los datos son del servidor— pero el front todavía no usa lo que el
backend ya publica:

- **Estados del viaje.** [`api/viajes.ts`](../src/api/viajes.ts) mapea los ids
  1–9 a mano. El backend ya expone `GET /estados/` con 15 códigos (NUE, PRE, ASI,
  CON, PRO, FIN, CER, ELI, CAN, NSH, MOD, CXL, CLX, REV, WEB). Cualquier id fuera
  de 1–9 cae en silencio a `PENDIENTE`.
- **Agencia propia del usuario.** Se infiere cruzando el email del perfil contra
  el catálogo de solicitantes (`loadWizardIdentity`, `loadPassengersAccess`),
  cuando `/auth/me/` ya devuelve `agencia` resuelta. El cruce por email solo hace
  falta para el nombre del solicitante.
- **El precio al cliente viaja igual al navegador del proveedor.** El recorte por
  rol es por viaje, no por campo: el costo trae las dos columnas y la UI solo
  esconde una. Si la regla es dura, el recorte va del lado del servidor.
- **Unidad asignada.** La columna se muestra en la lista pero no se edita en
  ninguna pantalla; el campo (`unidad_asignada`) existe en el backend.
- **Estado y búsqueda de la lista de viajes.** Filtran solo la página cargada. El
  backend los soporta (`estado__codigo`, `search`, `ordering`), pero mandarlos al
  servidor depende de migrar antes el mapeo de estados.
