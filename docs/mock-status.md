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

| Qué | Dónde vive | Vista que lo avisa |
| --- | --- | --- |
| Extras **del cliente** (espera / hora a disposición / km) | `localStorage`, ver [`api/tarifas.ts`](../src/api/tarifas.ts) | Tarifas Proveedor → solapa *Extras*, columna Cliente |
| Extras **por cliente** (set completo) | `localStorage`, ver [`api/tarifasCliente.ts`](../src/api/tarifasCliente.ts) | Tarifas Cliente → solapa *Extras* |
| Valor/minuto de espera **del cliente** en el viaje | sale del set local de arriba | Costos del viaje |
| Historial de modificaciones | el backend lo guarda y lo expone en `GET /viajes/{id}/historial/`, pero el front nunca lo pide: `viajeToTrip` arma el viaje con `history: []` | Viaje → paso *Historial* |
| Cambio de contraseña | no hay endpoint; los campos están deshabilitados | Settings de usuario |

El backend modela los extras **del proveedor** (`valor_espera`,
`valor_hora_dispo`, `valor_km_adicional`), pero no tiene equivalente de lo que se
le factura al cliente: por eso los extras quedaron partidos al medio.

⚠️ **Sin confirmar:** el front asume que `valor_espera` viene **por hora** y lo
pasa a minutos con `MINUTOS_POR_HORA` en `api/tarifasCrud.ts`. Si el backend la
guarda por minuto, hay que poner esa constante en 1 — mientras tanto, la espera
del proveedor se cobra 60 veces más barato de lo que corresponde.

## 2. Real cuando hay backend

- Login y sesión (JWT, refresh, `/auth/me/`), y edición del perfil (nombre,
  apellido, email).
- Viajes: alta, edición por pestaña, cambio de estado, cancelación y baja, con
  sus tramos y pasajeros anidados. La lista viene **recortada por rol** desde el
  servidor (el front ya no filtra).
- Comentarios del viaje: cuelgan del costo (`/viajes/{id}/costos/comentarios/`).
  Lo único que se pierde contra el backend es la chapita de rol del autor, que
  el servidor no expone.
- Extras del proveedor (espera, hora a disposición y km) y el catálogo de
  proveedores (`/tarifarios/proveedores/`).
- Costos del viaje: la base sale del tarifario del tramo (la calcula el servidor
  y es de solo lectura) y los rubros manuales se persisten por columna.
- Pasajeros (`/personas/`): paginación, búsqueda y filtro por agencia, todo
  server-side.
- Catálogos: agencias, categorías de servicio y solicitantes.
- Tarifario base (Tarifas Proveedor / Tarifas Cliente → *Tarifas por destino*):
  ABM real contra `/tarifarios/tarifas/`, con el scoping por proveedor hecho en
  el servidor. Es **una sola** tarifa por (proveedor, ruta, categoría) con los dos
  precios adentro: las dos pantallas miran columnas distintas de lo mismo.
- Cotización de la ruta en el wizard: zonas y tarifas vigentes del servidor.
- Asignación viaje → proveedor: viene con el viaje (`viaje.proveedor`).
- Carga por Excel: el parseo y la validación corren en el navegador (SheetJS) y
  después reusan el mismo `POST /viajes/` que el wizard. No hay endpoint de
  Excel en el backend, y no hace falta.

## 3. Mock solo sin backend (`VITE_API_URL` vacío)

Con la variable vacía aparece la chapa **Modo demo** en la barra superior. En ese
modo todo sale del seed y del `localStorage`:

- Viajes (`proxy:mockTrips`) y el catálogo de pasajeros, derivado de ellos.
- Asignación viaje → proveedor (`proxy:tripProveedor`).
- Catálogo de proveedores (`data/tarifasSeed.ts`).
- Tarifario base completo.
- Perfil del usuario (`proxy:mockMe`) y rol derivado del username: `prov…` →
  proveedor, `agen…`/`cliente…`/`oper…` → operador de agencia, el resto → admin.

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
- **Paginador de la lista de viajes.** Está fijo en “1 / 1”: la lista se trae
  entera y filtra por fecha en el cliente.
