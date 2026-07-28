// Formato único de teléfono en toda la app: compacto, solo dígitos con un "+"
// inicial opcional (sin espacios, guiones ni paréntesis). Se normaliza en los
// puntos de carga —el wizard, la grilla del modal de Excel y el parseo del
// archivo— para que lo que se guarda y se manda al backend siempre venga igual.

export const PHONE_RE = /^\+?\d{8,20}$/;

/** Quita todo lo que no sea dígito, conservando el "+" del prefijo internacional. */
export function normalizePhone(raw: string): string {
  const s = String(raw ?? "").trim();
  const digits = s.replace(/\D/g, "");
  return s.startsWith("+") && digits ? `+${digits}` : digits;
}
