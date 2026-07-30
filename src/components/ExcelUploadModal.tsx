import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ExcelLeg, ExcelRow, LegType } from "../types/domain";
import { cx } from "../lib/cx";
import { validateExcelRow } from "../lib/excelValidate";
import { hasGoogleMapsKey } from "../lib/gmaps";
import { normalizePhone } from "../lib/phone";
import { PlaceCombo } from "../pages/TripWizard/PlaceCombo";
import { AvisoMock } from "./ui/AvisoMock";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Input, Select } from "./ui/Field";
import { Modal } from "./ui/Modal";
import styles from "./ExcelUploadModal.module.css";

interface ExcelUploadModalProps {
  open: boolean;
  onClose: () => void;
  // dates: fechas de los viajes cargados, para que la lista salte a ellas.
  onConfirm: (count: number, dates: string[]) => void;
}

type Stage = "pick" | "validate";

const LEG_TYPE_OPTIONS: { value: LegType; label: string }[] = [
  { value: "in", label: "Llegada (in)" },
  { value: "out", label: "Salida (out)" },
  { value: "otro", label: "Otro" },
  { value: "disposicion", label: "Hs disposición" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

// Reaplica la validación a una fila editada (misma función que usa el parser).
function revalidate(r: ExcelRow): ExcelRow {
  const { errors, warnings } = validateExcelRow(r);
  return { ...r, errors, warnings };
}

export function ExcelUploadModal({ open, onClose, onConfirm }: ExcelUploadModalProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [categorias, setCategorias] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Catálogo de categorías para el dropdown (estricto: solo estos valores).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api.listCategorias().then((c) => {
      if (alive) setCategorias(c);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // Si una edición vuelve a meter errores en una fila seleccionada, la deselecciona.
  useEffect(() => {
    setSelected((s) => {
      let changed = false;
      const next = { ...s };
      rows.forEach((r) => {
        if (r.errors.length > 0 && next[r.row]) {
          next[r.row] = false;
          changed = true;
        }
      });
      return changed ? next : s;
    });
  }, [rows]);

  const reset = () => {
    setStage("pick");
    setFilename("");
    setRows([]);
    setSelected({});
    setSubmitting(false);
    setParsing(false);
    setSyncError(null);
    setDragOver(false);
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

  // ---- edición de filas ----
  const mutateRow = (rowNum: number, fn: (r: ExcelRow) => ExcelRow) => {
    setRows((rs) => rs.map((r) => (r.row === rowNum ? revalidate(fn(r)) : r)));
  };

  const updateRow = (rowNum: number, patch: Partial<ExcelRow>) =>
    mutateRow(rowNum, (r) => ({ ...r, ...patch }));

  const updateLeg = (rowNum: number, i: number, patch: Partial<ExcelLeg>) =>
    mutateRow(rowNum, (r) => {
      const legs = r.legs.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...patch };
        // Cambiar el texto invalida las coords/dirección resuelta (se re-geocodifica al cargar).
        if ("origin" in patch) {
          next.originCoords = undefined;
          next.originResolved = undefined;
        }
        if ("destination" in patch) {
          next.destinationCoords = undefined;
          next.destinationResolved = undefined;
        }
        return next;
      });
      // El destino de un tramo arrastra el origen del siguiente.
      if ("destination" in patch && i + 1 < legs.length) {
        legs[i + 1] = {
          ...legs[i + 1],
          origin: patch.destination ?? "",
          originCoords: undefined,
          originResolved: undefined,
        };
      }
      return { ...r, legs };
    });

  const addLeg = (rowNum: number) =>
    mutateRow(rowNum, (r) => {
      const last = r.legs[r.legs.length - 1];
      return {
        ...r,
        legs: [...r.legs, { type: "otro", origin: last?.destination ?? "", destination: "" }],
      };
    });

  const rmLeg = (rowNum: number, i: number) =>
    mutateRow(rowNum, (r) => ({ ...r, legs: r.legs.filter((_, j) => j !== i) }));

  const setPassenger = (rowNum: number, i: number, name: string) =>
    mutateRow(rowNum, (r) => ({
      ...r,
      passengers: r.passengers.map((p, j) => (j === i ? name : p)),
    }));

  const setPhone = (rowNum: number, i: number, phone: string) =>
    mutateRow(rowNum, (r) => {
      const phones = [...(r.phones ?? [])];
      while (phones.length <= i) phones.push("");
      // Sin espacios ni guiones, igual que en el wizard.
      phones[i] = normalizePhone(phone);
      return { ...r, phones };
    });

  const addPassenger = (rowNum: number) =>
    mutateRow(rowNum, (r) => ({
      ...r,
      passengers: [...r.passengers, ""],
      phones: [...(r.phones ?? []), ""],
    }));

  const rmPassenger = (rowNum: number, i: number) =>
    mutateRow(rowNum, (r) => ({
      ...r,
      passengers: r.passengers.filter((_, j) => j !== i),
      phones: (r.phones ?? []).filter((_, j) => j !== i),
    }));

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
    setSyncError(null);
    try {
      // Geocodifica lo editado (idempotente: respeta lo ya resuelto) antes de crear.
      const { geocodeRows } = await import("../lib/geocode");
      const rowsToSync = await geocodeRows(selectedExcelRows);
      const res = await api.importExcelRows(rowsToSync);

      if (res.count === 0 && res.errors.length > 0) {
        setSyncError(
          "No se cargó ningún viaje. " +
            res.errors.map((e) => `Fila ${e.row}: ${e.message}`).join(" · "),
        );
        return;
      }

      onConfirm(
        res.count,
        rowsToSync.map((r) => r.date),
      );
      reset();
      onClose();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "No se pudo cargar. Reintentá.");
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
    ) : (
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
    );

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Cargar viajes por Excel"
      width={1480}
      footer={footer}
    >
      {stage === "pick" && (
        <div className={styles.pickWrap}>
          <div className={styles.intro}>
            Subí un archivo .xlsx. Vas a poder revisar y editar cada fila antes de cargar los viajes.
          </div>
          {/* El parseo y la validación corren en el navegador (SheetJS); lo que
              necesita a Google es la geocodificación de origen/destino. */}
          {!hasGoogleMapsKey() && (
            <AvisoMock>
              No hay API key de Google Maps configurada: las direcciones del Excel se cargan como
              texto, sin geolocalizar.
            </AvisoMock>
          )}
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
                  <th className={cx(styles.th, styles.thFila)}>Fila</th>
                  <th className={styles.th}>Fecha · Hora</th>
                  <th className={styles.th}>Categoría</th>
                  <th className={styles.th}>Pasajeros</th>
                  <th className={cx(styles.th, styles.thTipo)}>Tipo · Vuelo</th>
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
                    <td className={cx(styles.td, styles.tdFila, styles.mono, styles.cMuted)}>
                      {formatRows(r.rows ?? [r.row])}
                    </td>

                    {/* Fecha · Hora */}
                    <td className={styles.tdWrap}>
                      <div className={styles.stack}>
                        <Input
                          type="date"
                          min={todayISO()}
                          value={r.date}
                          className={styles.cellInput}
                          onChange={(e) => updateRow(r.row, { date: e.target.value })}
                        />
                        <Input
                          type="time"
                          value={r.time}
                          className={styles.cellInput}
                          onChange={(e) => updateRow(r.row, { time: e.target.value })}
                        />
                      </div>
                    </td>

                    {/* Categoría — dropdown estricto del catálogo */}
                    <td className={styles.tdWrap}>
                      <Select
                        value={categorias.includes(r.cat) ? r.cat : ""}
                        className={styles.cellInput}
                        onChange={(e) => updateRow(r.row, { cat: e.target.value })}
                      >
                        <option value="" disabled>
                          Seleccionar…
                        </option>
                        {categorias.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </td>

                    {/* Pasajeros — nombre + teléfono, editable */}
                    <td className={styles.tdWrap}>
                      <div className={styles.stack}>
                        {r.passengers.map((p, i) => (
                          <div key={i} className={styles.paxCard}>
                            <div className={styles.legHead}>
                              <span className={styles.legNum}>Pasajero {i + 1}</span>
                              {r.passengers.length > 1 && (
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  aria-label="Quitar pasajero"
                                  onClick={() => rmPassenger(r.row, i)}
                                >
                                  <Icon name="trash" size={13} />
                                </button>
                              )}
                            </div>
                            <Input
                              value={p}
                              className={styles.cellInput}
                              placeholder="Nombre"
                              onChange={(e) => setPassenger(r.row, i, e.target.value)}
                            />
                            <Input
                              value={r.phones?.[i] ?? ""}
                              type="tel"
                              className={styles.cellInput}
                              placeholder="Teléfono +5411…"
                              onChange={(e) => setPhone(r.row, i, e.target.value)}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          className={styles.addInline}
                          onClick={() => addPassenger(r.row)}
                        >
                          <Icon name="plus" size={12} />
                          Agregar pasajero
                        </button>
                      </div>
                    </td>

                    {/* Tipo · Vuelo — a nivel VIAJE (se guardan en el primer tramo) */}
                    <td className={cx(styles.tdWrap, styles.tdTipo)}>
                      {r.legs[0] &&
                        (() => {
                          const l0 = r.legs[0];
                          const noFlight = l0.type === "otro" || l0.type === "disposicion";
                          return (
                            <div className={styles.stack}>
                              <Select
                                value={l0.type ?? "otro"}
                                className={styles.cellInput}
                                onChange={(e) =>
                                  updateLeg(r.row, 0, {
                                    type: e.target.value as LegType,
                                    flight:
                                      e.target.value === "otro" || e.target.value === "disposicion"
                                        ? ""
                                        : l0.flight,
                                  })
                                }
                              >
                                {LEG_TYPE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </Select>
                              <Input
                                className={styles.cellInput}
                                value={l0.flight ?? ""}
                                disabled={noFlight}
                                placeholder={noFlight ? "—" : "AA995, LA4302…"}
                                onChange={(e) => updateLeg(r.row, 0, { flight: e.target.value })}
                              />
                            </div>
                          );
                        })()}
                    </td>

                    {/* Tramos — origen/destino con autocompletado de Google */}
                    <td className={styles.tdTramos}>
                      <div className={styles.stack}>
                        {r.legs.map((l, i) => (
                          <div key={i} className={styles.legCard}>
                            <div className={styles.legHead}>
                              <span className={styles.legNum}>Tramo {i + 1}</span>
                              {r.legs.length > 1 && (
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  aria-label="Quitar tramo"
                                  onClick={() => rmLeg(r.row, i)}
                                >
                                  <Icon name="trash" size={13} />
                                </button>
                              )}
                            </div>
                            <div className={styles.legGrid}>
                              {/* El origen solo va en el primer tramo; los siguientes heredan
                                  el destino del anterior y solo muestran su destino. */}
                              {i === 0 && (
                                <div className={styles.legPlace}>
                                  <span className={styles.legLabel}>Origen</span>
                                  <PlaceCombo
                                    value={l.origin}
                                    onChange={(v) => updateLeg(r.row, i, { origin: v })}
                                    onPick={(pick) => updateLeg(r.row, i, { origin: pick.description })}
                                  />
                                  {l.originResolved && (
                                    <span className={styles.legResolved}>{l.originResolved}</span>
                                  )}
                                </div>
                              )}
                              <div className={styles.legPlace}>
                                <span className={styles.legLabel}>
                                  {i === 0 ? "Destino" : `Destino (desde ${l.origin || "—"})`}
                                </span>
                                <PlaceCombo
                                  value={l.destination}
                                  onChange={(v) => updateLeg(r.row, i, { destination: v })}
                                  onPick={(pick) => updateLeg(r.row, i, { destination: pick.description })}
                                />
                                {l.destinationResolved && (
                                  <span className={styles.legResolved}>
                                    {l.destinationResolved}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className={styles.addInline}
                          onClick={() => addLeg(r.row)}
                        >
                          <Icon name="plus" size={12} />
                          Agregar tramo
                        </button>
                      </div>
                    </td>

                    <td className={styles.tdWrap}>
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

          {syncError && (
            <div className={styles.syncError}>
              <Icon name="alert" size={13} />
              {syncError}
            </div>
          )}

          <div className={styles.note}>
            Editá los campos directamente en la tabla. Solo se cargan los viajes seleccionados;
            los que tienen errores no se pueden seleccionar hasta corregirlos.
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

type PillTone = "success" | "warning" | "danger";

const PILL_CLASS: Record<PillTone, string> = {
  success: styles.pillSuccess,
  warning: styles.pillWarning,
  danger: styles.pillDanger,
};

function Pill({ label, tone }: { label: string; tone: PillTone }) {
  return <span className={cx(styles.pill, PILL_CLASS[tone])}>{label}</span>;
}
