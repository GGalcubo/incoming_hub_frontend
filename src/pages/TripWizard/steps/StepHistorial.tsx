import { HAS_BACKEND } from "../../../api/http";
import { AvisoMock } from "../../../components/ui/AvisoMock";
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

      {/* El backend no lleva historial: el viaje llega siempre con `history: []`
          (ver api/viajes.ts, viajeToTrip). Sin backend, lo poco que se ve son
          las entradas del seed. En los dos casos hay que decirlo: una pantalla
          vacía se lee como "este viaje no se tocó nunca", que es distinto. */}
      {HAS_BACKEND ? (
        <AvisoMock tono="pendiente">
          El backend todavía no registra los cambios de los viajes, así que esta pantalla queda
          vacía aunque el viaje se haya modificado.
        </AvisoMock>
      ) : (
        <AvisoMock>
          Sin backend configurado, el historial que se ve es de ejemplo: no se registran los
          cambios que hagas.
        </AvisoMock>
      )}

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
