import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { HAS_BACKEND } from "../../../api/http";
import { AvisoMock } from "../../../components/ui/AvisoMock";
import { Icon } from "../../../components/ui/Icon";
import { useMe } from "../../../hooks/useMe";
import { cx } from "../../../lib/cx";
import type { HistoryEntry, Trip } from "../../../types/domain";
import styles from "./steps.module.css";

export function StepHistorial({ t }: { t: Trip }) {
  // El historial viene recortado por rol desde api.listHistorial: el admin ve
  // todo, la agencia y el proveedor solo los cambios de costos de su columna. El
  // rol se lee acá SOLO para el texto: el filtro no depende de la vista.
  // `lado` null = ve todo (admin). Mientras el perfil carga queda indefinido: si
  // no, el admin ve un parpadeo de "costos de cliente" antes de resolverse el rol.
  const { isAdmin, isProvider, loading: cargandoRol } = useMe();
  const lado = cargandoRol ? undefined : isAdmin ? null : isProvider ? "proveedor" : "cliente";
  // El historial lo sirve el backend por su propio endpoint
  // (GET /viajes/{id}/historial/): no viene con el viaje, así que se pide acá.
  // Sin backend, el mock devuelve el historial de ejemplo del viaje del seed.
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setEntries(null);
    setError("");
    api
      .listHistorial(t.id)
      .then((h) => {
        if (active) setEntries(h);
      })
      .catch((e) => {
        if (!active) return;
        setEntries([]);
        setError(e instanceof Error ? e.message : "No se pudo cargar el historial.");
      });
    return () => {
      active = false;
    };
  }, [t.id]);

  return (
    <>
      <h3 className={styles.h2}>Historial de modificaciones</h3>
      <p className={styles.p}>
        {lado
          ? `Cambios registrados sobre los costos de ${lado} de este viaje, del más reciente al más antiguo.`
          : lado === null
            ? "Cambios registrados sobre este viaje, del más reciente al más antiguo. Incluye los de sus destinos, pasajeros y costos."
            : "Cambios registrados sobre este viaje, del más reciente al más antiguo."}
      </p>

      {!HAS_BACKEND && (
        <AvisoMock>
          Sin backend configurado, el historial que se ve es de ejemplo: no se registran los
          cambios que hagas.
        </AvisoMock>
      )}

      {error && <div className={styles.histError}>{error}</div>}

      {entries === null ? (
        <div className={styles.emptyBox}>Cargando historial…</div>
      ) : entries.length === 0 ? (
        <div className={styles.emptyBox}>
          {lado
            ? `Todavía no hay cambios registrados en los costos de ${lado} de este viaje.`
            : "Todavía no hay modificaciones registradas para este viaje."}
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
                  {h.changes && h.changes.length > 0 && (
                    <ul className={styles.changes}>
                      {h.changes.map((c, j) => (
                        <li key={j} className={styles.change}>
                          <span className={styles.changeField}>{c.field}</span>
                          <span className={styles.changeFrom}>{c.from}</span>
                          <Icon name="arrowright" size={12} />
                          <span className={styles.changeTo}>{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
