import type { ExcelRow, Passenger, StatusMeta, Trip } from "../types/domain";

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

export const CATEGORIES = ["Ejecutivo", "Premium", "Van 7", "Van 11", "Minibús"];

export const STATUSES: StatusMeta[] = [
  { id: "PENDIENTE", label: "Pendiente" },
  { id: "CONFIRMADO", label: "Confirmado" },
  { id: "EN_CURSO", label: "En curso" },
  { id: "FINALIZADO", label: "Finalizado" },
  { id: "CANCELADO", label: "Cancelado" },
  { id: "NO_SHOW", label: "No show" },
  { id: "REPROGRAMADO", label: "Reprogramado" },
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
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const TODAY = fmt(today);
export const TOMORROW = fmt(new Date(today.getTime() + 86400000));

const PAX_POOL: Passenger[] = [
  { name: "M. Álvarez", phone: "+54 11 5523-7711", dni: "31.402.118", luggage: 2, email: "m.alvarez@example.com" },
  { name: "L. Soto", phone: "+54 11 4471-3320", dni: "34.221.099", luggage: 1, email: "l.soto@example.com" },
  { name: "J. Pereyra", phone: "+54 11 6612-4421", dni: "29.118.770", luggage: 1, email: "j.pereyra@example.com" },
  { name: "R. Méndez", phone: "+54 11 4490-0125", dni: "36.554.221", luggage: 2, email: "r.mendez@example.com" },
  { name: "K. Núñez", phone: "+54 11 5887-2210", dni: "38.110.402", luggage: 0, email: "k.nunez@example.com" },
  { name: "S. Vega", phone: "+54 11 3344-2280", dni: "30.998.105", luggage: 3, email: "s.vega@example.com" },
  { name: "L. Bravo", phone: "+54 11 5021-4477", dni: "35.776.901", luggage: 2, email: "l.bravo@example.com" },
  { name: "C. Ibarra", phone: "+54 11 6798-1140", dni: "33.220.886", luggage: 1, email: "c.ibarra@example.com" },
  { name: "F. Roldán", phone: "+54 11 5410-9921", dni: "37.005.118", luggage: 1, email: "f.roldan@example.com" },
  { name: "P. Quiroga", phone: "+54 11 4612-7755", dni: "32.401.504", luggage: 2, email: "p.quiroga@example.com" },
  { name: "D. Sánchez", phone: "+54 11 5588-3902", dni: "28.776.310", luggage: 1, email: "d.sanchez@example.com" },
  { name: "A. Funes", phone: "+54 11 6701-2240", dni: "31.882.045", luggage: 0, email: "a.funes@example.com" },
];

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
    { ts: "06/05 09:18", user: "operador@incoming-hub", action: "Confirmación enviada a Central" },
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
  { row: 2, date: TOMORROW, time: "07:00", pax: 1, cat: "Ejecutivo", agency: "Travel BA", passenger: "R. Méndez", origin: "Recoleta", destination: "EZE", warnings: [], errors: [] },
  { row: 3, date: TOMORROW, time: "09:30", pax: 2, cat: "Premium", agency: "Andes Tours", passenger: "K. Núñez", origin: "Palermo", destination: "AEP", warnings: ["Hora en formato 12h"], errors: [] },
  { row: 4, date: TOMORROW, time: "11:15", pax: 3, cat: "Van 7", agency: "Travel BA", passenger: "S. Vega", origin: "Tigre", destination: "Microcentro", warnings: [], errors: [] },
  { row: 5, date: TOMORROW, time: "", pax: 1, cat: "Ejecutivo", agency: "", passenger: "", origin: "Belgrano", destination: "Hotel Alvear", warnings: [], errors: ["Falta agencia", "Falta hora", "Falta pasajero"] },
  { row: 6, date: TOMORROW, time: "14:00", pax: 5, cat: "Van 11", agency: "Conexión Sur", passenger: "L. Bravo", origin: "AEP", destination: "San Isidro", warnings: ["Más de 4 pasajeros"], errors: [] },
];
