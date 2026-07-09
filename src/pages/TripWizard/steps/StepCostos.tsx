import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Field";
import { useMe } from "../../../hooks/useMe";
import { cx } from "../../../lib/cx";
import type { Trip, TripCosts } from "../../../types/domain";
import styles from "./steps.module.css";

// Rubros de extras que el proveedor/admin puede cargar sobre el costo base.
const EXTRA_ROWS: { key: keyof TripCosts; label: string }[] = [
  { key: "espera", label: "Espera" },
  { key: "peajes", label: "Peajes" },
  { key: "estacionamiento", label: "Estacionamiento" },
  { key: "otros", label: "Otros" },
];

export function StepCostos({ t, set }: { t: Trip; set: (patch: Partial<Trip>) => void }) {
  const { isProvider, isAgency } = useMe();
  const c = t.costs;
  const sym = c.moneda === "USD" ? "u$s" : "$";
  // Proveedor y admin editan costos; el cliente (agencia) es solo lectura.
  const canEdit = !isAgency;
  // "Los proveedores no deben ver el costo final al cliente": para el proveedor la
  // base es SU costo (tarifaProveedor); para el resto, el precio al cliente (viaje).
  const base = isProvider ? c.tarifaProveedor ?? 0 : c.viaje;
  const baseLabel = isProvider ? "Costo base (proveedor)" : "Viaje";
  const extrasSum = c.espera + c.peajes + c.estacionamiento + c.otros;
  const totalShown = base + extrasSum;
  const cerrado = t.est === "FINALIZADO";

  const fmt = (n: number) =>
    `${sym} ${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

  // Actualiza un rubro y recalcula el total al cliente (viaje + extras). El total
  // que se muestra al proveedor se calcula aparte (no se persiste el del cliente
  // como si fuera suyo).
  const setCost = (key: keyof TripCosts, value: number) => {
    const next: TripCosts = { ...c, [key]: value };
    next.total = next.viaje + next.espera + next.peajes + next.estacionamiento + next.otros;
    set({ costs: next });
  };

  return (
    <>
      <div className={styles.costHeader}>
        <h3 className={cx(styles.h2, styles.h2Flush)}>Costos</h3>
        {canEdit ? (
          cerrado ? (
            <span className={styles.roTag}>Viaje cerrado</span>
          ) : (
            <span className={styles.roTag}>Editable</span>
          )
        ) : (
          <span className={styles.roTag}>Solo lectura</span>
        )}
      </div>
      <p className={styles.p}>
        {canEdit
          ? "Cargá los extras del viaje. Los montos están en dólares."
          : "Valores del viaje. Ante una diferencia, contactá al administrador."}
      </p>

      <div className={styles.costTable}>
        <div className={styles.costRow}>
          <span className={styles.costLabel}>{baseLabel}</span>
          <span className={styles.tnum}>{fmt(base)}</span>
        </div>

        {EXTRA_ROWS.map((r) => (
          <div key={r.key} className={styles.costRow}>
            <span className={styles.costLabel}>{r.label}</span>
            {canEdit && !cerrado ? (
              <Input
                type="number"
                min={0}
                step="0.01"
                value={(c[r.key] as number) || ""}
                onChange={(e) => setCost(r.key, Number(e.target.value))}
                style={{ maxWidth: 140, textAlign: "right" }}
              />
            ) : (
              <span className={styles.tnum}>{fmt(c[r.key] as number)}</span>
            )}
          </div>
        ))}

        <div className={styles.costTotalRow}>
          <span>{isProvider ? "Total proveedor" : "Total"}</span>
          <span className={styles.tnum}>{fmt(totalShown)}</span>
        </div>
      </div>

      {canEdit && !cerrado && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Button kind="primary" icon="check" onClick={() => set({ est: "FINALIZADO" })}>
            Cerrar viaje
          </Button>
        </div>
      )}
      {cerrado && (
        <p className={styles.p} style={{ marginTop: 12 }}>
          El viaje está cerrado (finalizado). Los costos quedan fijados.
        </p>
      )}
    </>
  );
}
