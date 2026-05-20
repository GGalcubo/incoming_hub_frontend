import { Icon } from "../../../components/ui/Icon";
import { cx } from "../../../lib/cx";
import type { Trip } from "../../../types/domain";
import styles from "./steps.module.css";

export function StepHistorial({ t }: { t: Trip }) {
  const entries = t.history ?? [];
  return (
    <>
      <h3 className={styles.h2}>Historial de modificaciones</h3>
      <p className={styles.p}>Registro cronológico de los cambios realizados sobre este viaje.</p>

      {entries.length === 0 ? (
        <div className={styles.emptyBox}>
          Todavía no hay modificaciones registradas para este viaje.
        </div>
      ) : (
        <div className={styles.timeline}>
          {entries.map((h, i) => {
            const last = i === entries.length - 1;
            return (
              <div key={i} className={styles.entry}>
                <div className={styles.rail}>
                  <span className={styles.dot}>
                    <Icon name="history" size={14} />
                  </span>
                  {!last && <span className={styles.line} />}
                </div>
                <div className={cx(styles.entryBody, last && styles.entryBodyLast)}>
                  <div className={styles.action}>{h.action}</div>
                  <div className={styles.metaRow}>
                    <span className={styles.ts}>{h.ts}</span>
                    <span className={styles.sep}>·</span>
                    <span className={styles.user}>{h.user}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
