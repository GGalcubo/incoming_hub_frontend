import type { ExcelRow, Passenger, StatusMeta, Trip } from "../types/domain";
import { DEFAULT_PROVEEDOR_ID, PROVEEDORES } from "./tarifasSeed";

export const AGENCIES = [
  "Travel BA",
  "Andes Tours",
  "Patagonia Lux",
  "Buenos Aires DMC",
  "Pampas Travel",
  "Río Plata Travel",
  "Sur Premium",
  "Conexión Sur",
];

export const CATEGORIES = ["Auto STD", "Ejecutivo", "MiniVan"];

export const STATUSES: StatusMeta[] = [
  { id: "PENDIENTE", label: "Pendiente" },
  { id: "CONFIRMADO", label: "Confirmado" },
  { id: "EN_CURSO", label: "En curso" },
  { id: "FINALIZADO", label: "Finalizado" },
  { id: "CANCELADO", label: "Cancelado" },
  { id: "NO_SHOW", label: "No show" },
  { id: "REPROGRAMADO", label: "Reprogramado" },
  { id: "MODIFICADO", label: "Modificado" },
  { id: "EN_ESPERA", label: "En espera" },
];

export const PLACES = [
  "Aeropuerto Ezeiza (EZE)",
  "Aeroparque Jorge Newbery (AEP)",
  "Recoleta",
  "Palermo Soho",
  "Palermo Hollywood",
  "Puerto Madero",
  "San Isidro",
  "Tigre",
  "Microcentro",
  "Belgrano",
  "Retiro",
  "Hotel Faena",
  "Hotel Alvear",
  "Park Hyatt",
];

const today = new Date();
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const TODAY = fmt(today);
export const TOMORROW = fmt(new Date(today.getTime() + 86400000));

// Teléfonos en el mismo formato compacto que guarda la carga (ver lib/phone.ts).
const PAX_POOL: Passenger[] = [
  { firstName: "Martín", lastName: "Álvarez", phone: "+541155237711", email: "m.alvarez@example.com" },
  { firstName: "Lucía", lastName: "Soto", phone: "+541144713320", email: "l.soto@example.com" },
  { firstName: "Javier", lastName: "Pereyra", phone: "+541166124421", email: "j.pereyra@example.com" },
  { firstName: "Rocío", lastName: "Méndez", phone: "+541144900125", email: "r.mendez@example.com" },
  { firstName: "Karina", lastName: "Núñez", phone: "+541158872210", email: "k.nunez@example.com" },
  { firstName: "Sebastián", lastName: "Vega", phone: "+541133442280", email: "s.vega@example.com" },
  { firstName: "Laura", lastName: "Bravo", phone: "+541150214477", email: "l.bravo@example.com" },
  { firstName: "Camila", lastName: "Ibarra", phone: "+541167981140", email: "c.ibarra@example.com" },
  { firstName: "Federico", lastName: "Roldán", phone: "+541154109921", email: "f.roldan@example.com" },
  { firstName: "Paula", lastName: "Quiroga", phone: "+541146127755", email: "p.quiroga@example.com" },
  { firstName: "Diego", lastName: "Sánchez", phone: "+541155883902", email: "d.sanchez@example.com" },
  { firstName: "Andrés", lastName: "Funes", phone: "+541167012240", email: "a.funes@example.com" },
];

// Proveedor asignado a cada viaje del seed (mock): la mayoría al proveedor demo,
// algunos a un segundo proveedor y un par sin asignar, para poder probar que cada
// proveedor ve y edita solo los costos de los viajes suyos.
const seedProveedor = (i: number): string | undefined => {
  if (i % 5 === 0) return undefined;
  if (i % 3 === 0) return PROVEEDORES[1].id;
  return DEFAULT_PROVEEDOR_ID;
};

const mk = (
  i: number,
  date: string,
  time: string,
  pax: number,
  cat: string,
  ori: string,
  dst: string,
  est: Trip["est"],
  agc: string,
  ref: string,
  obs = "",
  unit = "",
): Trip => ({
  id: "RX-0" + (8420 + i),
  date,
  time,
  pax,
  cat,
  ori,
  dst,
  est,
  agc,
  ref,
  obs,
  unit,
  proveedorId: seedProveedor(i),
  passengers: [
    PAX_POOL[(i - 1) % PAX_POOL.length],
    ...(pax > 1 ? [PAX_POOL[i % PAX_POOL.length]] : []),
  ],
  legs: [
    {
      type: ori.includes("EZE") || ori.includes("AEP") ? "in" : "out",
      origin: ori,
      destination: dst,
      flight: ori.includes("EZE") ? "AA995" : "",
      obs: "",
    },
  ],
  costs: { total: 38500, viaje: 32000, espera: 2500, peajes: 1500, estacionamiento: 1500, otros: 1000 },
  history: [
    { ts: "06/05 09:14", user: "operador@incoming-hub", action: "Creación de viaje" },
    { ts: "06/05 09:18", user: "operador@incoming-hub", action: "Confirmación enviada a Incoming" },
  ],
});

export const SEED_TRIPS: Trip[] = [
  mk(1, TODAY, "07:30", 1, "Ejecutivo", "Aeropuerto Ezeiza (EZE)", "Recoleta", "CONFIRMADO", "Travel BA", "TBA-2391", "Cartel: Sr. Álvarez", "PROXY-08"),
  mk(2, TODAY, "09:15", 2, "Premium", "Hotel Faena", "Aeroparque Jorge Newbery (AEP)", "EN_CURSO", "Andes Tours", "AT-1140", "", "PROXY-12"),
  mk(3, TODAY, "11:00", 3, "Van 7", "Microcentro", "Tigre", "PENDIENTE", "Patagonia Lux", "PL-9921", "Reservar 3 valijas grandes"),
  mk(4, TODAY, "14:30", 1, "Ejecutivo", "Palermo Soho", "Aeropuerto Ezeiza (EZE)", "PENDIENTE", "Travel BA", "TBA-2392", ""),
  mk(5, TODAY, "16:00", 4, "Van 7", "Aeropuerto Ezeiza (EZE)", "Hotel Alvear", "EN_ESPERA", "Buenos Aires DMC", "BA-7782", "Demora vuelo AA995", ""),
  mk(6, TODAY, "17:45", 1, "Ejecutivo", "Park Hyatt", "Puerto Madero", "FINALIZADO", "Pampas Travel", "PT-0201", "", "PROXY-04"),
  mk(7, TODAY, "19:10", 2, "Premium", "San Isidro", "Aeroparque Jorge Newbery (AEP)", "REPROGRAMADO", "Río Plata Travel", "RP-3322", "Reprogramado a 19:30"),
  mk(8, TODAY, "21:00", 1, "Ejecutivo", "Belgrano", "Recoleta", "CANCELADO", "Sur Premium", "SP-1108", "Cancelado por pasajero"),
  mk(9, TOMORROW, "06:00", 1, "Ejecutivo", "Recoleta", "Aeropuerto Ezeiza (EZE)", "CONFIRMADO", "Travel BA", "TBA-2410", ""),
  mk(10, TOMORROW, "08:30", 3, "Van 7", "Aeropuerto Ezeiza (EZE)", "Tigre", "PENDIENTE", "Conexión Sur", "CS-5500", ""),
  mk(11, TOMORROW, "10:00", 1, "Premium", "Microcentro", "San Isidro", "PENDIENTE", "Andes Tours", "AT-1141", ""),
  mk(12, TOMORROW, "13:00", 2, "Ejecutivo", "Hotel Alvear", "Aeroparque Jorge Newbery (AEP)", "CONFIRMADO", "Buenos Aires DMC", "BA-7790", ""),
];

export const EXCEL_SAMPLE: ExcelRow[] = [
  {
    row: 2,
    tripRef: "V1",
    date: TOMORROW,
    time: "07:00",
    cat: "Ejecutivo",
    passengers: ["R. Méndez"],
    legs: [{ origin: "Recoleta", destination: "Aeropuerto Ezeiza (EZE)", type: "out", flight: "AA995" }],
    warnings: [],
    errors: [],
  },
  {
    row: 3,
    tripRef: "V2",
    date: TOMORROW,
    time: "09:30",
    cat: "Premium",
    passengers: ["K. Núñez", "M. Ríos"],
    legs: [{ origin: "Palermo", destination: "Aeroparque Jorge Newbery (AEP)", type: "out" }],
    warnings: ["Hora en formato 12h"],
    errors: [],
  },
  {
    row: 5,
    rows: [5, 6],
    tripRef: "V3",
    date: TOMORROW,
    time: "11:15",
    cat: "MiniVan",
    passengers: ["S. Vega", "A. Soto", "J. Pereyra"],
    legs: [
      { origin: "Tigre", destination: "Microcentro", type: "otro" },
      { origin: "Microcentro", destination: "Puerto Madero", type: "otro" },
    ],
    warnings: [],
    errors: [],
  },
  {
    row: 8,
    tripRef: "V4",
    date: TOMORROW,
    time: "",
    cat: "Ejecutivo",
    passengers: [],
    legs: [{ origin: "Belgrano", destination: "Hotel Alvear", type: "otro" }],
    warnings: [],
    errors: ["Falta hora", "Falta pasajero"],
  },
  {
    row: 9,
    rows: [9, 10, 11],
    tripRef: "V5",
    date: TOMORROW,
    time: "14:00",
    cat: "Auto STD",
    passengers: ["L. Bravo"],
    legs: [
      { origin: "Aeroparque Jorge Newbery (AEP)", destination: "Hotel Faena", type: "in", flight: "LA4302" },
      { origin: "Hotel Faena", destination: "San Isidro", type: "otro" },
      { origin: "San Isidro", destination: "Aeropuerto Ezeiza (EZE)", type: "out", flight: "AA996" },
    ],
    warnings: ["Viaje con 3 tramos"],
    errors: [],
  },
];
