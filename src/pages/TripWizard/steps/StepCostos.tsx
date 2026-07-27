import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Field";
import { useMe } from "../../../hooks/useMe";
import { cx } from "../../../lib/cx";
import type { Trip, TripCosts } from "../../../types/domain";
import type { TarifaExtras } from "../../../types/tarifas";
import styles from "./steps.module.css";

// Rubros de extras que el proveedor/admin carga a mano sobre el costo base. La
// espera NO está acá: se carga en minutos y el monto se calcula solo.
const EXTRA_ROWS: { key: keyof TripCosts; label: string }[] = [
  { key: "peajes", label: "Peajes" },
  { key: "estacionamiento", label: "Estacionamiento" },
  { key: "otros", label: "Otros" },
];

// La espera se cobra por bloques: la unidad mínima es de 15 minutos.
const ESPERA_UNIDAD = 15;
const ESPERA_OPCIONES = [15, 30, 45, 60, 75, 90];

export function StepCostos({ t, set }: { t: Trip; set: (patch: Partial<Trip>) => void }) {
  const { isProvider, isAgency, proveedorId } = useMe();
  const [extras, setExtras] = useState<TarifaExtras | null>(null);
  const c = t.costs;
  const sym = c.moneda === "USD" ? "u$s" : "$";
  // El proveedor solo carga los costos de SUS viajes (los que tiene asignados).
  const esPropio = !isProvider || t.proveedorId === proveedorId;
  // Proveedor (dueño del viaje) y admin editan costos; el cliente (agencia) es
  // solo lectura.
  const canEdit = !isAgency && esPropio;
  // "Los proveedores no deben ver el costo final al cliente": para el proveedor la
  // base es SU costo (tarifaProveedor); para el resto, el precio al cliente (viaje).
  const base = isProvider ? c.tarifaProveedor ?? 0 : c.viaje;
  const baseLabel = isProvider ? "Costo base (proveedor)" : "Viaje";
  const cerrado = t.est === "FINALIZADO";

  // Valor por minuto de espera que le corresponde ver a este rol.
  const esperaRate = extras ? (isProvider ? extras.esperaProveedor : extras.esperaCliente) : null;
  const esperaMin = c.esperaMin ?? 0;
  // Monto de espera del lado que se está mirando. Para el proveedor, si el viaje
  // viene de Central (sin desglose por rol), no hay monto suyo: se muestra 0.
  const esperaMonto = isProvider ? c.esperaProveedor ?? 0 : c.espera;

  const extrasSum = esperaMonto + c.peajes + c.estacionamiento + c.otros;
  const totalShown = base + extrasSum;

  // Tarifa de extras del proveedor del viaje (valor por minuto de espera); si
  // todavía no tiene proveedor, las del tarifario general. Sin ella no se puede
  // calcular.
  useEffect(() => {
    let active = true;
    api
      .getTarifasExtras(t.proveedorId)
      .then((e) => {
        if (active) setExtras(e);
      })
      .catch(() => {
        /* sin tarifas cargadas: se muestra el aviso y no se puede editar la espera */
      });
    return () => {
      active = false;
    };
  }, [t.proveedorId]);

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

  // Carga los minutos de espera y calcula los dos montos (proveedor y cliente) a
  // partir del valor/minuto de la tarifa de extras. Redondea a la unidad mínima.
  const setEsperaMin = (min: number) => {
    if (!extras) return;
    const m = Math.max(0, Math.round(min / ESPERA_UNIDAD) * ESPERA_UNIDAD);
    const next: TripCosts = {
      ...c,
      esperaMin: m,
      espera: +(m * extras.esperaCliente).toFixed(2),
      esperaProveedor: +(m * extras.esperaProveedor).toFixed(2),
    };
    next.total = next.viaje + next.espera + next.peajes + next.estacionamiento + next.otros;
    set({ costs: next });
  };

  const esperaEditable = canEdit && !cerrado && !!extras;
  // Si el viaje ya trae minutos que no son de la lista (p. ej. 105), se agrega el
  // chip para que la selección actual quede visible.
  const opciones = ESPERA_OPCIONES.includes(esperaMin) || esperaMin === 0
    ? ESPERA_OPCIONES
    : [...ESPERA_OPCIONES, esperaMin].sort((a, b) => a - b);

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
          ? "Cargá los minutos de espera y los extras del viaje. La espera se cobra por bloques de 15 minutos y el monto se calcula solo. Los montos están en dólares."
          : !esPropio
            ? "Este viaje está asignado a otro proveedor: solo podés cargar los costos de los viajes propios."
            : "Valores del viaje. Ante una diferencia, contactá al administrador."}
      </p>

      <div className={styles.costTable}>
        <div className={styles.costRow}>
          <span className={styles.costLabel}>{baseLabel}</span>
          <span className={styles.tnum}>{fmt(base)}</span>
        </div>

        {/* Espera: se elige en minutos (unidad mínima 15) y el monto se calcula. */}
        <div className={cx(styles.costRow, styles.costRowStack)}>
          <div className={styles.costRowHead}>
            <span className={styles.costLabel}>Espera</span>
            <span className={styles.tnum}>{fmt(esperaMonto)}</span>
          </div>
          {esperaEditable ? (
            <>
              <div className={styles.esperaChips}>
                <button
                  type="button"
                  className={cx(styles.esperaChip, esperaMin === 0 && styles.esperaChipActive)}
                  onClick={() => setEsperaMin(0)}
                >
                  Sin espera
                </button>
                {opciones.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={cx(styles.esperaChip, esperaMin === m && styles.esperaChipActive)}
                    onClick={() => setEsperaMin(m)}
                  >
                    {m} min
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.esperaChip}
                  onClick={() => setEsperaMin(esperaMin + ESPERA_UNIDAD)}
                  title="Sumar un bloque de 15 minutos"
                >
                  +15
                </button>
              </div>
              <span className={styles.esperaHint}>
                {esperaMin > 0 && esperaRate != null
                  ? `${esperaMin} min × ${fmt(esperaRate)}/min = ${fmt(esperaMonto)}`
                  : `Unidad mínima 15 min${esperaRate != null ? ` · ${fmt(esperaRate)} por minuto` : ""}`}
              </span>
            </>
          ) : (
            <span className={styles.esperaHint}>
              {esperaMin > 0
                ? `${esperaMin} min de espera`
                : canEdit && !cerrado
                  ? "No hay tarifa de espera cargada."
                  : "Sin espera"}
            </span>
          )}
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
