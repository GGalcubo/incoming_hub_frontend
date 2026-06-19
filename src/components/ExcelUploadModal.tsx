import { useState } from "react";
import { api } from "../api/client";
import type { ExcelRow, LegType } from "../types/domain";
import { cx } from "../lib/cx";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";
import styles from "./ExcelUploadModal.module.css";

interface ExcelUploadModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (count: number, dates: string[]) => void;
}

type Stage = "pick" | "validate" | "done";

export function ExcelUploadModal({ open, onClose, onConfirm }: ExcelUploadModalProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);

  const reset = () => {
    setStage("pick");
    setFilename("");
    setRows([]);
    setSelected({});
    setSubmitting(false);
    setDragOver(false);
    setParsing(false);
  };

  const handleFile = async (f: File) => {
    setFilename(f.name);
    setParsing(true);
    try {
      const parsed = await api.parseExcel(f);
      setRows(parsed);
      const sel: Record<number, boolean> = {};
      parsed.forEach((r) => {
        sel[r.row] = r.errors.length === 0;
      });
      setSelected(sel);
      setStage("validate");
    } finally {
      setParsing(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleFile(f);
  };

  const onDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) return;
    await handleFile(f);
  };

  const summary = (() => {
    const ok = rows.filter((r) => r.errors.length === 0).length;
    const warn = rows.filter((r) => r.warnings.length > 0 && r.errors.length === 0).length;
    const err = rows.filter((r) => r.errors.length > 0).length;
    return { ok, warn, err };
  })();

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedExcelRows = rows.filter((r) => selected[r.row]);

  const sync = async () => {
    setSubmitting(true);
    try {
      const res = await api.importExcelRows(selectedExcelRows);
      onConfirm(
        res.count,
        selectedExcelRows.map((r) => r.date),
      );
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const footer =
    stage === "pick" ? (
      <Button
        onClick={() => {
          onClose();
          reset();
        }}
      >
        Cancelar
      </Button>
    ) : stage === "validate" ? (
      <>
        <Button
          onClick={() => {
            onClose();
            reset();
          }}
        >
          Cancelar
        </Button>
        <Button kind="primary" disabled={selectedCount === 0 || submitting} onClick={sync}>
          {submitting
            ? "Cargando…"
            : `Cargar ${selectedCount} viaje${selectedCount === 1 ? "" : "s"}`}
        </Button>
      </>
    ) : null;

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Cargar viajes por Excel"
      width={1240}
      footer={footer}
    >
      {stage === "pick" && (
        <div className={styles.pickWrap}>
          <div className={styles.intro}>
            Subí un archivo .xlsx. Vamos a validar fila por fila antes de cargar los viajes.
          </div>
          {parsing ? (
            <div className={styles.parsing}>
              <span className={styles.spinner} />
              <div className={styles.dropTitle}>Procesando y geolocalizando…</div>
              <div className={styles.dropSub}>{filename}</div>
            </div>
          ) : (
            <label
              className={cx(styles.dropzone, dragOver && styles.dropzoneActive)}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragOver) setDragOver(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOver(false);
              }}
              onDrop={onDrop}
            >
              <Icon name="upload" size={28} className={styles.dropIcon} />
              <div className={styles.dropTitle}>
                Arrastrá el archivo o hacé clic para seleccionar
              </div>
              <div className={styles.dropSub}>Formato .xlsx · máximo 200 filas</div>
              <input type="file" accept=".xlsx,.xls" hidden onChange={onFile} />
            </label>
          )}
          <a href="/plantilla-viajes.xlsx" download className={styles.templateLink}>
            Descargar plantilla
          </a>
        </div>
      )}

      {stage === "validate" && (
        <div className={styles.validateWrap}>
          <div className={styles.fileLine}>
            <Icon name="excel" size={16} className={styles.fileIcon} />
            <span className={styles.fileName}>{filename}</span>
            <span className={styles.fileCount}>· {rows.length} filas detectadas</span>
          </div>

          <div className={styles.pillRow}>
            <Pill label={`${summary.ok} listos`} tone="success" />
            {summary.warn > 0 && <Pill label={`${summary.warn} con avisos`} tone="warning" />}
            {summary.err > 0 && <Pill label={`${summary.err} con errores`} tone="danger" />}
          </div>

          <div className={styles.tableBox}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th className={cx(styles.th, styles.thCheck)}>
                    <input
                      type="checkbox"
                      checked={
                        selectedCount === rows.filter((r) => r.errors.length === 0).length &&
                        selectedCount > 0
                      }
                      onChange={(e) => {
                        const next: Record<number, boolean> = {};
                        rows.forEach((r) => {
                          next[r.row] = e.target.checked && r.errors.length === 0;
                        });
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th className={styles.th}>Fila</th>
                  <th className={styles.th}>Viaje</th>
                  <th className={styles.th}>Fecha · Hora</th>
                  <th className={styles.th}>Categoría</th>
                  <th className={styles.th}>Tipo</th>
                  <th className={styles.th}>Pasajeros</th>
                  <th className={styles.th}>Tramos</th>
                  <th className={styles.th}>Estado de validación</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} className={r.errors.length ? styles.rowErr : styles.rowOk}>
                    <td className={styles.td}>
                      <input
                        type="checkbox"
                        disabled={r.errors.length > 0}
                        checked={!!selected[r.row]}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [r.row]: e.target.checked }))
                        }
                      />
                    </td>
                    <td className={cx(styles.td, styles.mono, styles.cMuted)}>
                      {formatRows(r.rows ?? [r.row])}
                    </td>
                    <td className={cx(styles.td, styles.mono, styles.cSecondary)}>
                      {r.tripRef || <span className={styles.cDim}>—</span>}
                    </td>
                    <td className={cx(styles.td, styles.cSecondary)}>
                      {r.date} · {r.time || <span className={styles.cDim}>—</span>}
                    </td>
                    <td className={cx(styles.td, styles.cSecondary)}>
                      {r.cat || <span className={styles.cDim}>—</span>}
                    </td>
                    <td className={cx(styles.td, styles.cSecondary)}>
                      {r.legs[0]?.type ? (
                        TIPO_LABEL[r.legs[0].type]
                      ) : (
                        <span className={styles.cDim}>—</span>
                      )}
                    </td>
                    <td className={cx(styles.tdWrap, styles.cSecondary)}>
                      {r.passengers.length === 0 ? (
                        <span className={styles.cDim}>—</span>
                      ) : (
                        <div className={styles.stack}>
                          {r.passengers.map((p, i) => (
                            <span key={i}>
                              {p}
                              {r.phones?.[i] && (
                                <span className={styles.legFlight}>· {r.phones[i]}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={cx(styles.tdWrap, styles.cSecondary)}>
                      <div className={styles.stack}>
                        {r.legs.map((l, i) => (
                          <span key={i} className={styles.legItem}>
                            <span>
                              {l.origin} → {l.destination}
                              {l.flight && <span className={styles.legFlight}>· {l.flight}</span>}
                            </span>
                            {(l.originResolved || l.destinationResolved) && (
                              <span className={styles.legResolved}>
                                {l.originResolved ?? l.origin} → {l.destinationResolved ?? l.destination}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={styles.td}>
                      {r.errors.length > 0 ? (
                        <div className={styles.stack}>
                          {r.errors.map((e, i) => (
                            <span key={i} className={cx(styles.msg, styles.msgErr)}>
                              <Icon name="alert" size={12} />
                              {e}
                            </span>
                          ))}
                        </div>
                      ) : r.warnings.length > 0 ? (
                        <div className={styles.stack}>
                          {r.warnings.map((w, i) => (
                            <span key={i} className={cx(styles.msg, styles.msgWarn)}>
                              <Icon name="info" size={12} />
                              {w}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={cx(styles.msg, styles.msgOk)}>
                          <Icon name="check" size={12} />
                          Sin observaciones
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.note}>
            Solo se cargan los viajes seleccionados. Los que tienen errores no se pueden
            seleccionar — corregí el archivo y volvé a subir.
          </div>
        </div>
      )}
    </Modal>
  );
}

// Concatena las filas de Excel de un viaje. Colapsa tramos consecutivos en un
// rango ("4–6") y separa los salteados con coma ("4, 6, 8"), para que en
// multi-tramo se vean todas las filas y no solo la primera.
function formatRows(rows: number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}–${prev}`);
    if (i < sorted.length) {
      start = sorted[i];
      prev = sorted[i];
    }
  }
  return parts.join(", ");
}

// El tipo de servicio es uno por VIAJE (no por tramo): se toma del primer
// tramo, que es el que lo lleva. Mismos labels que el Select del wizard.
const TIPO_LABEL: Record<LegType, string> = {
  in: "Llegada (in)",
  out: "Salida (out)",
  otro: "Otro",
  disposicion: "Hs disposición",
};

type PillTone = "success" | "warning" | "danger";

const PILL_CLASS: Record<PillTone, string> = {
  success: styles.pillSuccess,
  warning: styles.pillWarning,
  danger: styles.pillDanger,
};

function Pill({ label, tone }: { label: string; tone: PillTone }) {
  return <span className={cx(styles.pill, PILL_CLASS[tone])}>{label}</span>;
}
