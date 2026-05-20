import type { Trip } from "../../../types/domain";
import { h2, p } from "../styles";

export function StepCostos({ t }: { t: Trip }) {
  const c = t.costs;
  const row = (k: keyof typeof c, l: string) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        font: "400 14px/20px Heming",
        color: "var(--fg-secondary)",
      }}
    >
      <span style={{ color: "var(--fg-muted)" }}>{l}</span>
      <span style={{ fontFeatureSettings: '"tnum" 1' }}>
        $ {c[k].toLocaleString("es-AR", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <h3 style={{ ...h2, margin: 0 }}>Costos</h3>
        <span
          style={{
            font: "500 11px/14px Heming",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            padding: "2px 8px",
            borderRadius: 9999,
          }}
        >
          Solo lectura · API Central
        </span>
      </div>
      <p style={p}>
        Los valores se sincronizan desde Central. Si encontrás una diferencia, contactá al
        administrador.
      </p>
      <div
        style={{
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          overflow: "hidden",
          marginTop: 8,
        }}
      >
        {row("viaje", "Viaje")}
        {row("espera", "Espera")}
        {row("peajes", "Peajes")}
        {row("estacionamiento", "Estacionamiento")}
        {row("otros", "Otros")}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "14px",
            background: "var(--bg-app)",
            font: "600 14px/20px Heming",
            color: "var(--fg-primary)",
          }}
        >
          <span>Total</span>
          <span style={{ fontFeatureSettings: '"tnum" 1' }}>
            $ {c.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </>
  );
}
