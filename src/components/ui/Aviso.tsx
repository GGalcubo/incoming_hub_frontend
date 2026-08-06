import { cx } from "../../lib/cx";
import styles from "./Aviso.module.css";

// Cartel para las limitaciones que el usuario tiene que saber ANTES de cargar
// algo. Dos tonos:
//
//   "aviso"     → falta una integración externa y la función anda a medias (sin
//                 API key de Google no hay geolocalización ni mapa).
//   "pendiente" → el backend todavía no acepta el dato: lo que se cargue no
//                 persiste (el valor del viaje editado a mano).
//
// NO hay datos de ejemplo en ningún lado: si un dato no se puede traer, la
// pantalla falla y lo dice, no lo inventa.
export type TonoAviso = "aviso" | "pendiente";

const TITULO: Record<TonoAviso, string> = {
  aviso: "Atención",
  pendiente: "Pendiente",
};

export function Aviso({
  tono = "aviso",
  titulo,
  className,
  children,
}: {
  tono?: TonoAviso;
  titulo?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(styles.aviso, tono === "pendiente" && styles.avisoPendiente, className)}
      role="status"
    >
      <span className={styles.titulo}>{titulo ?? TITULO[tono]}</span>
      <span>{children}</span>
    </div>
  );
}
