import { cx } from "../../../lib/cx";
import type { Trip } from "../../../types/domain";
import styles from "./steps.module.css";

export function StepCostos({ t }: { t: Trip }) {
  const c = t.costs;
  const row = (k: keyof typeof c, l: string) => (
    <div className={styles.costRow}>
      <span className={styles.costLabel}>{l}</span>
      <span className={styles.tnum}>
        $ {c[k].toLocaleString("es-AR", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
  return (
    <>
      <div className={styles.costHeader}>
        <h3 className={cx(styles.h2, styles.h2Flush)}>Costos</h3>
        <span className={styles.roTag}>Solo lectura · API Central</span>
      </div>
      <p className={styles.p}>
        Los valores se sincronizan desde Central. Si encontrás una diferencia, contactá al
        administrador.
      </p>
      <div className={styles.costTable}>
        {row("viaje", "Viaje")}
        {row("espera", "Espera")}
        {row("peajes", "Peajes")}
        {row("estacionamiento", "Estacionamiento")}
        {row("otros", "Otros")}
        <div className={styles.costTotalRow}>
          <span>Total</span>
          <span className={styles.tnum}>
            $ {c.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </>
  );
}
