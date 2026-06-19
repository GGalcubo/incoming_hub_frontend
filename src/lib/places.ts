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

// Devuelve el nombre canónico si el texto coincide (exacto) con un alias
// conocido; si no, devuelve el texto tal cual (trim). No adivina parcialmente
// para no pisar direcciones reales que contengan la palabra.
export function normalizePlace(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return s;
  const key = s.toLowerCase().replace(/\s+/g, " ");
  return ALIASES[key] ?? s;
}
