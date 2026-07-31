// ⚠️ MOCK (localStorage). EXTRAS del tarifario de CLIENTE: espera, hora a
// disposición y km adicional facturados a cada agencia.
//
// El PRECIO al cliente ya no vive acá: es la columna `precio_cliente` de la
// tarifa real del backend (ver api/tarifasCrud.ts). Lo que queda son los extras.
//
// ESTE ES EL ÚLTIMO TARIFARIO 100% MOCK. El backend ya modela los extras del
// PROVEEDOR (valor_espera / valor_hora_dispo / valor_km_adicional, ver
// tarifasCrud.getExtrasProveedor) pero no tiene NADA equivalente del lado del
// cliente: ni un set por agencia, ni una columna cliente en los del proveedor.
// Hasta que exista, esto se guarda en el browser y las vistas lo avisan en
// pantalla; después se reemplaza el cuerpo de estas dos funciones por
// `request(...)` y las vistas quedan igual.
//
// SCOPING: cada set de extras pertenece a un cliente (agencia). Las funciones
// reciben `scope`: el id del cliente logueado, o null cuando es admin (opera
// sobre cualquiera). El rol proveedor NO llega hasta acá: nunca puede ver lo que
// se le factura al cliente y se corta antes, en api/client.ts y en la ruta.

import { seedClienteExtrasFor } from "../data/tarifasSeed";
import type { TarifaClienteExtras } from "../types/tarifas";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Los extras son un registro por cliente: { [clienteId]: TarifaClienteExtras }.
const EXTRAS_KEY = "proxy:tarifasClienteExtras";

type ExtrasStore = Record<string, TarifaClienteExtras>;

function loadExtrasStore(): ExtrasStore {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY);
    if (raw) return JSON.parse(raw) as ExtrasStore;
  } catch {
    /* almacenamiento no disponible o dato inválido */
  }
  return {};
}

function saveExtrasStore(store: ExtrasStore) {
  try {
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

// Solo el admin (`scope === null`) escribe. Un cliente consulta sus extras pero
// no los edita: si igual llegara una escritura, la cortamos acá.
function assertPuedeEscribir(scope: string | null) {
  if (scope !== null) throw new Error("Solo el administrador puede modificar el tarifario.");
}

function assertCliente(clienteId: string) {
  if (!clienteId) throw new Error("Elegí el cliente de la tarifa.");
}

export async function getTarifasClienteExtras(clienteId: string): Promise<TarifaClienteExtras> {
  await wait(120);
  assertCliente(clienteId);
  // Un cliente sin extras cargados arranca con los valores de referencia, así
  // hay con qué trabajar (y con qué calcular la espera en el paso Costos).
  return loadExtrasStore()[clienteId] ?? seedClienteExtrasFor(clienteId);
}

export async function updateTarifasClienteExtras(
  patch: Partial<TarifaClienteExtras>,
  clienteId: string,
  scope: string | null,
): Promise<TarifaClienteExtras> {
  await wait(180);
  assertPuedeEscribir(scope);
  assertCliente(clienteId);
  const store = loadExtrasStore();
  const actual = store[clienteId] ?? seedClienteExtrasFor(clienteId);
  const next: TarifaClienteExtras = { ...actual, ...patch, clienteId };
  if ([next.espera, next.horaDispo, next.km].some((m) => !(m > 0))) {
    throw new Error("Todos los valores de extras deben ser mayores a 0.");
  }
  store[clienteId] = next;
  saveExtrasStore(store);
  return next;
}
