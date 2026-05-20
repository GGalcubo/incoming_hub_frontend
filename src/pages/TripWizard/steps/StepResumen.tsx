import type { Trip } from "../../../types/domain";
import { h2 } from "../styles";

export function StepResumen({ t }: { t: Trip }) {
  const Item = ({ l, v }: { l: string; v: React.ReactNode }) => (
    <div
      style={{
        display: "flex",
        padding: "8px 0",
        borderBottom: "1px dashed var(--border-subtle)",
        gap: 18,
      }}
    >
      <span
        style={{
          font: "500 12px/16px Heming",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          width: 160,
          flex: "none",
        }}
      >
        {l}
      </span>
      <span style={{ font: "400 14px/20px Heming", color: "var(--fg-secondary)" }}>{v}</span>
    </div>
  );
  return (
    <>
      <h3 style={h2}>Resumen del viaje</h3>
      <div style={{ marginTop: 8 }}>
        <Item l="Reserva" v={<span style={{ fontFamily: "JetBrains Mono" }}>{t.id}</span>} />
        <Item l="Solicitante" v={t.solicitante || "—"} />
        <Item l="Fecha y hora" v={`${t.date} · ${t.time || "—"}`} />
        <Item l="Categoría" v={t.cat} />
        <Item
          l="Destinos"
          v={
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {t.legs.map((l, i) => (
                <span key={i}>
                  {l.origin || "—"} → {l.destination || "—"}{" "}
                  {l.type === "disposicion" && l.hours ? (
                    <span
                      style={{
                        color: "var(--fg-muted)",
                        fontFamily: "JetBrains Mono",
                        fontSize: 12,
                      }}
                    >
                      · {l.hours} hs disposición
                    </span>
                  ) : (
                    l.flight && (
                      <span
                        style={{
                          color: "var(--fg-muted)",
                          fontFamily: "JetBrains Mono",
                          fontSize: 12,
                        }}
                      >
                        · {l.flight}
                      </span>
                    )
                  )}
                </span>
              ))}
            </div>
          }
        />
        <Item
          l="Pasajeros"
          v={
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
