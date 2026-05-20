import type { Trip } from "../../../types/domain";
import styles from "./steps.module.css";

export function StepResumen({ t }: { t: Trip }) {
  const Item = ({ l, v }: { l: string; v: React.ReactNode }) => (
    <div className={styles.summaryItem}>
      <span className={styles.summaryLabel}>{l}</span>
      <span className={styles.summaryValue}>{v}</span>
    </div>
  );
  return (
    <>
      <h3 className={styles.h2}>Resumen del viaje</h3>
      <div className={styles.summaryList}>
        <Item l="Reserva" v={<span className={styles.mono}>{t.id}</span>} />
        <Item l="Solicitante" v={t.solicitante || "—"} />
        <Item l="Fecha y hora" v={`${t.date} · ${t.time || "—"}`} />
        <Item l="Categoría" v={t.cat} />
        <Item
          l="Destinos"
          v={
            <div className={styles.stack}>
              {t.legs.map((l, i) => (
                <span key={i}>
                  {l.origin || "—"} → {l.destination || "—"}{" "}
                  {l.type === "disposicion" && l.hours ? (
                    <span className={styles.legMeta}>· {l.hours} hs disposición</span>
                  ) : (
                    l.flight && <span className={styles.legMeta}>· {l.flight}</span>
                  )}
                </span>
              ))}
            </div>
          }
        />
        <Item
          l="Pasajeros"
          v={
            <div className={styles.stack}>
              {t.passengers.map((px, i) => {
                const full = `${px.firstName} ${px.lastName}`.trim();
                return (
                  <span key={i}>
                    {full || "—"}
                    {px.phone && ` · ${px.phone}`}
                  </span>
                );
              })}
            </div>
          }
        />
      </div>
    </>
  );
}
