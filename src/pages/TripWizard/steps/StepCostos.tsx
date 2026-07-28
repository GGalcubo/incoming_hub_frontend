import { Fragment, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { HAS_BACKEND } from "../../../api/http";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Field";
import { useMe } from "../../../hooks/useMe";
import { totalCliente, totalProveedor, withTotals } from "../../../lib/costs";
import { cx } from "../../../lib/cx";
import type { Trip, TripCosts } from "../../../types/domain";
import type { TarifaExtras } from "../../../types/tarifas";
import styles from "./steps.module.css";
import { TripComentarios } from "./TripComentarios";

// Las dos columnas del cuadro de costos: lo que se le factura al cliente y lo
// que cobra el proveedor. Cada rol ve solo las que le corresponden.
type Col = "cliente" | "proveedor";

const COL_LABEL: Record<Col, string> = { cliente: "Cliente", proveedor: "Proveedor" };

// Campos numéricos de TripCosts (los que se muestran en el cuadro).
type NumKey =
  | "viaje"
  | "espera"
  | "peajes"
  | "estacionamiento"
  | "otros"
  | "tarifaProveedor"
  | "esperaProveedor"
  | "peajesProveedor"
  | "estacionamientoProveedor"
  | "otrosProveedor";

interface CostRow {
  label: string;
  cliente: NumKey;
  proveedor: NumKey;
}

// Fila del tramo base: sale del tarifario (paso Tarifa), solo el admin la ajusta.
const BASE_ROW: CostRow = { label: "Viaje", cliente: "viaje", proveedor: "tarifaProveedor" };

// Rubros de extras que se cargan a mano. La espera NO está acá: se carga en
// minutos y los dos montos se calculan solos.
const EXTRA_ROWS: CostRow[] = [
  { label: "Peajes", cliente: "peajes", proveedor: "peajesProveedor" },
  { label: "Estacionamiento", cliente: "estacionamiento", proveedor: "estacionamientoProveedor" },
  { label: "Otros", cliente: "otros", proveedor: "otrosProveedor" },
];

// La espera se cobra por bloques: la unidad mínima es de 15 minutos.
const ESPERA_UNIDAD = 15;

// Minutos de espera a partir del monto ya cargado. Cada rol la deriva de SU
// columna (es la única que ve). Sin tarifa de espera no hay forma de dividir: 0.
function derivarEsperaMin(
  c: TripCosts,
  extras: TarifaExtras | null,
  isProvider: boolean,
): number {
  const monto = isProvider ? (c.esperaProveedor ?? 0) : c.espera;
  const valorMin = isProvider ? extras?.esperaProveedor : extras?.esperaCliente;
  if (!monto || !valorMin) return 0;
  return Math.max(0, Math.round(monto / valorMin / ESPERA_UNIDAD) * ESPERA_UNIDAD);
}

export function StepCostos({ t, set }: { t: Trip; set: (patch: Partial<Trip>) => void }) {
  const { isAdmin, isProvider, proveedorId } = useMe();
  const [extras, setExtras] = useState<TarifaExtras | null>(null);
  // Borrador del input de minutos: mientras se tipea no redondeamos (si no,
  // escribir "45" pasaría por "4" y se convertiría en 0). Se aplica al salir.
  const [esperaDraft, setEsperaDraft] = useState<string | null>(null);
  const c = t.costs;
  const sym = c.moneda === "USD" ? "u$s" : "$";
  const cerrado = t.est === "FINALIZADO";
  // El proveedor solo carga los costos de SUS viajes (los que tiene asignados).
  const esPropio = !isProvider || t.proveedorId === proveedorId;

  // Columnas visibles: el proveedor nunca ve el precio al cliente y el cliente
  // (agencia) nunca ve el costo del proveedor. Solo el admin ve las dos. Con el
  // rol todavía sin resolver se cae a la de cliente, que es la más restrictiva.
  const cols: Col[] = isProvider ? ["proveedor"] : isAdmin ? ["cliente", "proveedor"] : ["cliente"];

  // El admin edita las dos columnas; el proveedor, la suya en sus viajes; la
  // agencia (cliente) es solo lectura.
  const canEditCol = (col: Col) =>
    !cerrado && (isAdmin || (isProvider && col === "proveedor" && esPropio));
  // El tramo base sale del tarifario elegido en el paso Tarifa. Contra el backend
  // real lo calcula el servidor a partir de la tarifa del tramo y no se edita a
  // mano: para cambiarlo hay que elegir otra tarifa. Sin backend, el admin lo
  // corrige acá.
  const canEditBase = !cerrado && isAdmin && !HAS_BACKEND;
  const canEditAlgo = cols.some(canEditCol);

  // Minutos de espera. El backend guarda el MONTO, no los minutos: cuando el
  // viaje viene del servidor los reconstruimos dividiendo por el valor/minuto de
  // la tarifa (redondeado a la unidad de cobro).
  const esperaMin = c.esperaMin ?? derivarEsperaMin(c, extras, isProvider);
  // Los minutos son uno solo para las dos columnas (es el mismo tiempo de
  // espera): los carga quien puede editar costos, y cada monto sale del
  // valor/minuto del tarifario correspondiente.
  const esperaEditable = !cerrado && canEditAlgo && !!extras;

  // Tarifa de extras del proveedor del viaje (valor por minuto de espera); si
  // todavía no tiene proveedor, las del tarifario general. Sin ella no se puede
  // calcular la espera. El backend todavía no expone estos valores por proveedor:
  // con backend real se usa el set general del mock.
  useEffect(() => {
    let active = true;
    api
      .getTarifasExtras(HAS_BACKEND ? undefined : t.proveedorId)
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

  const valueOf = (key: NumKey) => c[key] ?? 0;

  // Actualiza un rubro y recalcula los dos totales (cliente y proveedor).
  const setCost = (key: NumKey, value: number) => {
    set({ costs: withTotals({ ...c, [key]: value } as TripCosts) });
  };

  // Carga los minutos de espera y calcula los dos montos a partir del valor/
  // minuto de la tarifa de extras. Redondea a la unidad mínima.
  const setEsperaMin = (min: number) => {
    if (!extras) return;
    const m = Math.max(0, Math.round(min / ESPERA_UNIDAD) * ESPERA_UNIDAD);
    set({
      costs: withTotals({
        ...c,
        esperaMin: m,
        espera: +(m * extras.esperaCliente).toFixed(2),
        esperaProveedor: +(m * extras.esperaProveedor).toFixed(2),
      }),
    });
  };

  // Valor/minuto de espera de cada columna (para el detalle bajo el selector).
  const rateOf = (col: Col) =>
    extras ? (col === "proveedor" ? extras.esperaProveedor : extras.esperaCliente) : null;

  const totalOf = (col: Col) => (col === "proveedor" ? totalProveedor(c) : totalCliente(c));

  const gridStyle = {
    gridTemplateColumns: `1fr ${cols.map(() => "minmax(104px, auto)").join(" ")}`,
  };

  const commitEsperaDraft = () => {
    if (esperaDraft !== null) setEsperaMin(Number(esperaDraft) || 0);
    setEsperaDraft(null);
  };

  const stepEspera = (delta: number) => {
    setEsperaDraft(null);
    setEsperaMin(esperaMin + delta);
  };

  return (
    <>
      <div className={styles.costHeader}>
        <h3 className={cx(styles.h2, styles.h2Flush)}>Costos</h3>
        {cerrado ? (
          <span className={styles.roTag}>Viaje cerrado</span>
        ) : canEditAlgo ? (
          <span className={styles.roTag}>Editable</span>
        ) : (
          <span className={styles.roTag}>Solo lectura</span>
        )}
      </div>
      <p className={styles.p}>
        {!esPropio
          ? "Este viaje está asignado a otro proveedor: solo podés cargar los costos de los viajes propios."
          : canEditAlgo
            ? isAdmin
              ? "Cargá los minutos de espera y los extras de cada columna: lo que se le factura al cliente y lo que cobra el proveedor. La espera se cobra por bloques de 15 minutos y el monto se calcula solo. Los montos están en dólares."
              : "Cargá los minutos de espera y tus extras del viaje. La espera se cobra por bloques de 15 minutos y el monto se calcula solo. Los montos están en dólares."
            : "Valores del viaje. Ante una diferencia, contactá al administrador."}
      </p>

      <div className={styles.costGrid} style={gridStyle}>
        <span className={styles.costHeadCell} />
        {cols.map((col) => (
          <span key={col} className={cx(styles.costHeadCell, styles.costHeadNum)}>
            {COL_LABEL[col]}
          </span>
        ))}

        {/* Tramo base: precio de la categoría según el tarifario. */}
        <span className={cx(styles.costCell, styles.costLabel)}>{BASE_ROW.label}</span>
        {cols.map((col) => (
          <span key={col} className={cx(styles.costCell, styles.costCellNum)}>
            {canEditBase ? (
              <Input
                type="number"
                min={0}
                step="0.01"
                className={styles.costInput}
                value={valueOf(BASE_ROW[col]) || ""}
                onChange={(e) => setCost(BASE_ROW[col], Number(e.target.value))}
              />
            ) : (
              <span className={styles.tnum}>{fmt(valueOf(BASE_ROW[col]))}</span>
            )}
          </span>
        ))}

        {/* Espera: se elige en minutos (unidad mínima 15) y los montos se calculan. */}
        <span className={cx(styles.costCell, styles.costLabel)}>
          Espera
          <span className={styles.esperaStep}>
            <button
              type="button"
              className={styles.esperaStepBtn}
              disabled={!esperaEditable || esperaMin === 0}
              onClick={() => stepEspera(-ESPERA_UNIDAD)}
              title="Restar un bloque de 15 minutos"
            >
              −
            </button>
            <Input
              type="number"
              min={0}
              step={ESPERA_UNIDAD}
              className={styles.esperaStepInput}
              disabled={!esperaEditable}
              value={esperaDraft ?? String(esperaMin)}
              onChange={(e) => setEsperaDraft(e.target.value)}
              onBlur={commitEsperaDraft}
            />
            <span className={styles.esperaUnit}>min</span>
            <button
              type="button"
              className={styles.esperaStepBtn}
              disabled={!esperaEditable}
              onClick={() => stepEspera(ESPERA_UNIDAD)}
              title="Sumar un bloque de 15 minutos"
            >
              +
            </button>
          </span>
          <span className={styles.esperaHint}>
            {!extras
              ? canEditAlgo
                ? "No hay tarifa de espera cargada."
                : `${esperaMin} min de espera`
              : `Unidad mínima 15 min · ${cols
                  .map((col) => `${fmt(rateOf(col) ?? 0)}/min ${COL_LABEL[col].toLowerCase()}`)
                  .join(" · ")}`}
          </span>
        </span>
        {cols.map((col) => (
          <span key={col} className={cx(styles.costCell, styles.costCellNum)}>
            <span className={styles.tnum}>
              {fmt(valueOf(col === "proveedor" ? "esperaProveedor" : "espera"))}
            </span>
          </span>
        ))}

        {EXTRA_ROWS.map((r) => (
          <Fragment key={r.label}>
            <span className={cx(styles.costCell, styles.costLabel)}>{r.label}</span>
            {cols.map((col) => (
              <span key={col} className={cx(styles.costCell, styles.costCellNum)}>
                {canEditCol(col) ? (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className={styles.costInput}
                    value={valueOf(r[col]) || ""}
                    onChange={(e) => setCost(r[col], Number(e.target.value))}
                  />
                ) : (
                  <span className={styles.tnum}>{fmt(valueOf(r[col]))}</span>
                )}
              </span>
            ))}
          </Fragment>
        ))}

        <span className={styles.costTotalCell}>Total</span>
        {cols.map((col) => (
          <span key={col} className={cx(styles.costTotalCell, styles.costTotalNum)}>
            <span className={styles.tnum}>{fmt(totalOf(col))}</span>
          </span>
        ))}
      </div>

      {canEditAlgo && (
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

      {/* Comentarios: los ve y los deja cualquier rol. */}
      <TripComentarios tripId={t.id} />
    </>
  );
}
