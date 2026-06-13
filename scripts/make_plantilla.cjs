// Genera la plantilla descargable public/plantilla-viajes.xlsx (versión Node/SheetJS).
// Incluye la columna "Telefonos" (el teléfono de pasajero es obligatorio) y una
// hoja de instrucciones. Convención: ver scripts/make_plantilla.py.
const XLSX = require("xlsx");
const path = require("path");

const d = new Date();
d.setDate(d.getDate() + 1);
const tomorrow = d.toISOString().slice(0, 10);

const headers = [
  "Viaje", "Fecha", "Hora", "Categoria", "Pasajeros", "Telefonos",
  "Tipo", "Origen", "Destino", "Vuelo", "Observaciones",
];

const rows = [
  ["V1", tomorrow, "07:00", "Ejecutivo", "R. Mendez", "+54 11 5512 3344",
   "out", "Recoleta", "Aeropuerto Ezeiza (EZE)", "AA995", ""],
  ["V2", tomorrow, "09:30", "Ejecutivo", "K. Nunez | M. Rios", "+54 11 4490 7781 | +54 11 6033 2210",
   "out", "Palermo", "Aeroparque Jorge Newbery (AEP)", "", ""],
  ["V3", tomorrow, "11:15", "MiniVan", "S. Vega | A. Soto | J. Pereyra", "+54 11 5120 9087 | +54 11 3398 4456 | +54 11 6677 1230",
   "otro", "Tigre", "Microcentro", "", "Reservar 3 valijas"],
  ["V3", "", "", "", "", "",
   "otro", "Microcentro", "Puerto Madero", "", ""],
  ["V4", tomorrow, "14:00", "Auto STD", "L. Bravo", "+54 11 2245 8890",
   "in", "Aeroparque Jorge Newbery (AEP)", "Hotel Faena", "LA4302", ""],
  ["V4", "", "", "", "", "",
   "out", "Hotel Faena", "Aeropuerto Ezeiza (EZE)", "AA996", ""],
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws["!cols"] = [
  { wch: 7 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 34 },
  { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 28 },
];

const instrucciones = [
  ["Hoja Viajes", "Una fila por TRAMO. Para varios tramos del mismo viaje, repetí el ID de Viaje."],
  ["Viaje", "Identificador del viaje (V1, V2, ...). Agrupa los tramos."],
  ["Fecha / Hora", "Solo en la PRIMERA fila de cada viaje. Fecha AAAA-MM-DD, Hora HH:MM (24h)."],
  ["Categoria", "Auto STD / Ejecutivo / MiniVan. Solo en la primera fila del viaje."],
  ["Pasajeros", "Solo en la primera fila. Varios pasajeros separados por  |  (pipe). Máximo 4."],
  ["Telefonos", "OBLIGATORIO. Un teléfono por pasajero, en el MISMO orden, separados por  |  ."],
  ["Tipo", "in = llegada con vuelo · out = salida con vuelo · otro = traslado · disposicion = horas a disposición."],
  ["Origen / Destino", "Dirección o lugar. En tramos siguientes, Origen suele coincidir con el Destino anterior."],
  ["Vuelo", "Solo para tipo in / out (ej: AA995). Vacío en otros casos."],
  ["Observaciones", "Texto libre opcional."],
];
const ws2 = XLSX.utils.aoa_to_sheet([["Plantilla de carga de viajes", ""], ["", ""], ...instrucciones]);
ws2["!cols"] = [{ wch: 18 }, { wch: 92 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Viajes");
XLSX.utils.book_append_sheet(wb, ws2, "Instrucciones");

const out = path.join(__dirname, "..", "public", "plantilla-viajes.xlsx");
XLSX.writeFile(wb, out);
console.log("OK", out);
