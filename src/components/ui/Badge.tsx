import type { CSSProperties } from "react";
import { useEstados } from "../../hooks/useEstados";
import type { TripStatus } from "../../types/domain";
import styles from "./Badge.module.css";

interface BadgeProps {
  status: TripStatus;
}

// Color de fondo del estado. El backend lo manda como hex en `Estado.color`,
// pero el dato no está limpio: hay filas con un hex de 5 dígitos ("#FFFFF"). Se
// valida antes de usarlo y, si no sirve, se cae a un neutro.
const NEUTRO = "#273740";

function colorValido(hex: string | null | undefined): string {
  const s = (hex ?? "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : NEUTRO;
}

// Texto blanco o negro según qué tanto contraste con el fondo. Sin esto los
// estados claros del catálogo (#d3d3d3, #FFA500) quedan ilegibles.
function textoSobre(hex: string): string {
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  // Luminancia relativa (WCAG).
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#111820" : "#ffffff";
}

export function Badge({ status }: BadgeProps) {
  const { metaOf } = useEstados();
  const meta = metaOf(status);
  // Sin catálogo todavía (o estado que el backend no tiene): se muestra el id
  // crudo en vez de inventarle un nombre.
  const label = meta?.label ?? String(status);
  const bg = colorValido(meta?.color);

  const vars = { "--badge-bg": bg, "--badge-fg": textoSobre(bg) } as CSSProperties;

  return (
    <span className={styles.badge} style={vars}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}
