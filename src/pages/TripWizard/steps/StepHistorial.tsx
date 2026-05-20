import { Icon } from "../../../components/ui/Icon";
import type { Trip } from "../../../types/domain";
import { h2, p } from "../styles";

export function StepHistorial({ t }: { t: Trip }) {
  const entries = t.history ?? [];
  return (
    <>
      <h3 style={h2}>Historial de modificaciones</h3>
      <p style={p}>Registro cronológico de los cambios realizados sobre este viaje.</p>

      {entries.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border-subtle)",
            borderRadius: 12,
            padding: "28px 16px",
            textAlign: "center",
            font: "400 13px/18px Heming",
            color: "var(--fg-muted)",
            marginTop: 8,
          }}
        >
          Todavía no hay modificaciones registradas para este viaje.
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {entries.map((h, i) => {
            const last = i === entries.length - 1;
            return (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: "none",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9999,
                      background: "var(--brand-tint)",
                      color: "var(--brand-500)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <Icon name="history" size={14} />
                  </span>
                  {!last && (
                    <span style={{ flex: 1, width: 1, background: "var(--border-strong)" }} />
                  )}
                </div>
                <div style={{ paddingBottom: last ? 0 : 18, minWidth: 0 }}>
                  <div style={{ font: "600 14px/20px Heming", color: "var(--fg-primary)" }}>
                    {h.action}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        font: "400 12px/16px Heming",
                        color: "var(--fg-muted)",
                        fontFeatureSettings: '"tnum" 1',
                      }}
                    >
                      {h.ts}
                    </span>
                    <span style={{ color: "var(--fg-tertiary)" }}>·</span>
                    <span style={{ font: "400 12px/16px Heming", color: "var(--fg-tertiary)" }}>
                      {h.user}
                    </span>
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
