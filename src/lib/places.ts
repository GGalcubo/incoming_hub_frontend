// Mapa de destinos comunes: normaliza alias y abreviaturas (EZE, Aeroparque…)
// al nombre canónico que ya reconocen Google Maps y el wizard. Compartido entre
// el import de Excel y el autocomplete (PlaceCombo), para evitar confusiones del
// tipo "EZE no trae la terminal de Ezeiza".
const CANON_EZE = "Aeropuerto Ezeiza (EZE)";
const CANON_AEP = "Aeroparque Jorge Newbery (AEP)";

const ALIASES: Record<string, string> = {
  eze: CANON_EZE,
  ezeiza: CANON_EZE,
  "aeropuerto ezeiza": CANON_EZE,
  "aeropuerto de ezeiza": CANON_EZE,
  "aeropuerto internacional ezeiza": CANON_EZE,
  "aeropuerto internacional ministro pistarini": CANON_EZE,
  aep: CANON_AEP,
  aeroparque: CANON_AEP,
  "aeroparque jorge newbery": CANON_AEP,
  "jorge newbery": CANON_AEP,
};

// Señales de que el texto es una dirección de calle real (y NO una referencia al
// aeropuerto): prefijos de vía o un número de altura (≥2 dígitos, p. ej. "123").
// Si aparece alguna, no aplicamos el match difuso para no pisar "Av. Ezeiza 123".
const STREET_RE =
  /\b(av|av\.|avda|avenida|calle|cl|diag|diagonal|pasaje|psje|ruta|rn|rp|camino|bv|blvd|boulevard|autopista)\b/;
const HOUSE_NUM_RE = /\b\d{2,}\b/;

// Tokens fuertes que identifican cada aeropuerto aunque vengan con texto extra
// ("EZE T5", "terminal ezeiza", "aeroparque terminal A").
const EZE_RE = /\b(eze|ezeiza|pistarini)\b/;
const AEP_RE = /\b(aep|aeroparque|newbery)\b/;

// Match difuso: solo si el texto NO parece dirección de calle y contiene un token
// de aeropuerto. Devuelve el canónico o null (texto sin cambios).
function matchAirport(key: string): string | null {
  if (STREET_RE.test(key) || HOUSE_NUM_RE.test(key)) return null;
  if (EZE_RE.test(key)) return CANON_EZE;
  if (AEP_RE.test(key)) return CANON_AEP;
  return null;
}

// Devuelve el nombre canónico si el texto coincide con un alias conocido (exacto)
// o si menciona un aeropuerto sin parecer una dirección de calle ("EZE T5",
// "terminal ezeiza"); si no, devuelve el texto tal cual (trim). No adivina sobre
// direcciones reales que contengan la palabra ("Av. Ezeiza 123" queda intacto).
export function normalizePlace(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return s;
  const key = s.toLowerCase().replace(/\s+/g, " ");
  if (ALIASES[key]) return ALIASES[key];
  return matchAirport(key) ?? s;
}
