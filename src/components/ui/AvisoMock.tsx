import { cx } from "../../lib/cx";
import styles from "./AvisoMock.module.css";

// Cartel para lo que TODAVÍA no es real. Dos tonos, según por qué no lo es:
//
//   "demo"      → el dato existe y se puede editar, pero no persiste en el
//                 backend: vive en localStorage y se pierde al cambiar de
//                 navegador o de máquina (los extras del lado cliente).
//   "pendiente" → la funcionalidad no existe todavía, o el front no la usa: no
//                 hay dato que mostrar ni nada que se pierda (historial,
//                 cambio de contraseña).
//
// El inventario completo de qué es real y qué no está en docs/mock-status.md.
export type TonoAviso = "demo" | "pendiente";

const TITULO: Record<TonoAviso, string> = {
  demo: "Datos de demo",
  pendiente: "Pendiente",
};

export function AvisoMock({
  tono = "demo",
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
