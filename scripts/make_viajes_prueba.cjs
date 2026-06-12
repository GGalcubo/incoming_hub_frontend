// Genera un Excel de PRUEBA con datos de mentira para el modal "Cargar viajes por Excel".
// Sigue la convención de columnas de scripts/make_plantilla.py:
//   - Una fila por TRAMO. Las filas del mismo viaje comparten el ID de "Viaje".
//   - La PRIMERA fila de cada Viaje lleva Fecha/Hora/Categoria/Pasajeros.
//   - Pasajeros múltiples separados por " | ".
//   - Tipo: in | out | otro | disposicion.
const XLSX = require("xlsx");
const path = require("path");

const d = new Date();
d.setDate(d.getDate() + 1);
const tomorrow = d.toISOString().slice(0, 10);
const d2 = new Date();
d2.setDate(d2.getDate() + 2);
const inTwoDays = d2.toISOString().slice(0, 10);

const headers = [
  "Viaje",
  "Fecha",
  "Hora",
  "Categoria",
  "Pasajeros",
  "Tipo",
  "Origen",
  "Destino",
  "Vuelo",
  "Observaciones",
];

const rows = [
  // V1 — OK: 1 tramo, 1 pasajero, salida con vuelo
  ["V1", tomorrow, "06:45", "Ejecutivo", "Homero Simpson",
   "out", "Recoleta", "Aeropuerto Ezeiza (EZE)", "AA1010", ""],

  // V2 — OK: 1 tramo, 2 pasajeros (pipe), llegada con vuelo
  ["V2", tomorrow, "09:15", "Auto STD", "Marge Bouvier | Ned Flanders",
   "in", "Aeroparque Jorge Newbery (AEP)", "Hotel Faena", "LA2480", "Cartel: Sr. Flanders"],

  // V3 — OK: 2 tramos, 3 pasajeros
  ["V3", tomorrow, "11:30", "MiniVan", "Lisa Simpson | Bart Simpson | Milhouse V.",
   "otro", "Tigre", "Microcentro", "", "Reservar 3 valijas"],
  ["V3", "", "", "", "",
   "otro", "Microcentro", "Puerto Madero", "", ""],

  // V4 — AVISO "Viaje con 3 tramos": día completo in -> otro -> out
  ["V4", tomorrow, "13:00", "Ejecutivo", "Montgomery Burns",
   "in", "Aeropuerto Ezeiza (EZE)", "Hotel Alvear", "IB6843", ""],
  ["V4", "", "", "", "",
   "otro", "Hotel Alvear", "San Isidro", "", ""],
  ["V4", "", "", "", "",
   "out", "San Isidro", "Aeropuerto Ezeiza (EZE)", "IB6844", ""],

  // V5 — ERROR "Falta hora" + "Falta pasajero": probar la edición/validación en vivo
  ["V5", tomorrow, "", "Auto STD", "",
   "otro", "Belgrano", "Palermo", "", "Completar hora y pasajero al cargar"],

  // V6 — disposición (sin vuelo)
  ["V6", inTwoDays, "10:00", "MiniVan", "Apu Nahasapeemapetilon",
   "disposicion", "Hotel Hilton Puerto Madero", "Hotel Hilton Puerto Madero", "", "4 hs a disposición"],

  // V7 — OK: traslado simple entre barrios
  ["V7", inTwoDays, "16:20", "Ejecutivo", "Krusty el Payaso",
   "otro", "Microcentro", "La Boca", "", "Pasajero VIP"],
];

const aoa = [headers, ...rows];
const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!cols"] = [
  { wch: 7 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 34 },
  { wch: 12 }, { wch: 32 }, { wch: 32 }, { wch: 10 }, { wch: 30 },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Viajes");

const out = path.join(__dirname, "..", "viajes-prueba.xlsx");
XLSX.writeFile(wb, out);
console.log("OK", out);
