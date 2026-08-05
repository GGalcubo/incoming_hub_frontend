import type { Trip } from "../../../types/domain";
import styles from "./steps.module.css";

const TYPE_LABELS: Record<string, string> = {
  in: "Llegada (in)",
  out: "Salida (out)",
  otro: "Otro",
  disposicion: "Hs disposición",
};

const TYPE_CLASSES: Record<string, string> = {
  in: styles.legType_in,
  out: styles.legType_out,
  otro: styles.legType_otro,
  disposicion: styles.legType_disposicion,
};

export function StepResumen({ t }: { t: Trip }) {
  const Item = ({ l, v }: { l: string; v: React.ReactNode }) => (
    <div className={styles.summaryItem}>
      <span className={styles.summaryLabel}>{l}</span>
      <span className={styles.summaryValue}>{v}</span>
    </div>
  );

  // Detalle de la categoría elegida en el paso Tarifa: ruta tarifada y modalidad
  // (en "horas a disposición" el precio depende de las horas, así que se muestran).
  const tar = t.tarifa;
  // Una categoría elegida sin tarifa para la ruta se guarda igual, con el costo
  // en cero: se avisa acá para que nadie confirme el viaje creyéndolo cotizado.
  const catMeta = [
    tar?.origen && tar?.destino ? `${tar.origen} → ${tar.destino}` : "",
    tar?.modalidad === "horas"
      ? `${tar.horas ?? 1} hs a disposición`
      : tar?.categoria
        ? "Traslado"
        : "",
    t.cat && !t.costs.viaje ? "Servicio a cotizar por el proveedor" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <h3 className={styles.h2}>Resumen del viaje</h3>
      <div className={styles.summaryList}>
        <Item l="Reserva" v={<span className={styles.mono}>{t.id}</span>} />
        <Item l="Agencia" v={t.agc || "—"} />
        <Item l="Solicitante" v={t.solicitante || "—"} />
        <Item l="Fecha y hora" v={`${t.date} · ${t.time || "—"}`} />
        <Item
          l="Categoría"
          v={
            <div className={styles.stack}>
              <span>{t.cat || "—"}</span>
              {catMeta && <span className={styles.summaryMeta}>{catMeta}</span>}
            </div>
          }
        />
        <Item
          l="Destinos"
          v={
            <div className={styles.stack}>
              {t.legs.map((l, i) => (
                <div key={i} className={styles.legBlock}>
                  <div className={styles.legRow}>
                    <span className={styles.legDir}>Desde</span>
                    <span>{l.origin || "—"}</span>
                  </div>
                  <div className={styles.legRow}>
                    <span className={styles.legDir}>Hasta</span>
                    <span>{l.destination || "—"}</span>
                  </div>
                  <div className={styles.legRow}>
                    <span className={styles.legDir}>Tipo</span>
                    <span className={`${styles.legMeta} ${TYPE_CLASSES[l.type] ?? ""}`}>
                      {TYPE_LABELS[l.type] ?? l.type}
                      {l.type === "disposicion" && l.hours
                        ? ` · ${l.hours} hs`
                        : l.flight
                          ? ` · ${l.flight}`
                          : ""}
                    </span>
                  </div>
                </div>
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
        <Item
          l="Observaciones"
          v={<span className={styles.summaryNote}>{t.obs?.trim() || "—"}</span>}
        />
      </div>
    </>
  );
}
