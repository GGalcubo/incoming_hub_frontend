import { useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../api/client";
import type { ExcelRow } from "../types/domain";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";

interface ExcelUploadModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (count: number) => void;
}

type Stage = "pick" | "validate" | "done";

export function ExcelUploadModal({ open, onClose, onConfirm }: ExcelUploadModalProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStage("pick");
    setFilename("");
    setRows([]);
    setSelected({});
    setSubmitting(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const parsed = await api.parseExcel(f);
    setRows(parsed);
    const sel: Record<number, boolean> = {};
    parsed.forEach((r) => {
      sel[r.row] = r.errors.length === 0;
    });
    setSelected(sel);
    setStage("validate");
  };

  const summary = (() => {
    const ok = rows.filter((r) => r.errors.length === 0).length;
    const warn = rows.filter((r) => r.warnings.length > 0 && r.errors.length === 0).length;
    const err = rows.filter((r) => r.errors.length > 0).length;
    return { ok, warn, err };
  })();

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedRows = rows.filter((r) => selected[r.row]).map((r) => r.row);

  const sync = async () => {
    setSubmitting(true);
    try {
      const res = await api.syncExcelRows(selectedRows);
      onConfirm(res.count);
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
            ? "Sincronizando…"
            : `Sincronizar ${selectedCount} viaje${selectedCount === 1 ? "" : "s"} con Central`}
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
      width={780}
      footer={footer}
    >
      {stage === "pick" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ font: "400 13px/18px Inter", color: "#B5BCC9" }}>
            Subí un archivo .xlsx con la plantilla de Proxy. Vamos a validar fila por fila antes
            de sincronizar con Central.
          </div>
          <label
            style={{
              border: "1.5px dashed #2A323F",
              borderRadius: 12,
              padding: 36,
              textAlign: "center",
              background: "#0A0E14",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1FB874")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A323F")}
          >
            <Icon name="upload" size={28} style={{ color: "#8B95A7" }} />
            <div style={{ font: "600 14px/20px Inter", color: "#F5F7FB" }}>
              Arrastrá el archivo o hacé clic para seleccionar
            </div>
            <div style={{ font: "400 12px/16px Inter", color: "#8B95A7" }}>
              Formato .xlsx · máximo 200 filas
            </div>
            <input type="file" accept=".xlsx,.xls" hidden onChange={onFile} />
          </label>
          <a
            href="#"
            style={{ font: "500 13px/18px Inter", color: "#4FD79A", textDecoration: "none" }}
          >
            Descargar plantilla
          </a>
        </div>
      )}

      {stage === "validate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "400 13px/18px Inter",
              color: "#E7EBF2",
            }}
          >
            <Icon name="excel" size={16} style={{ color: "#4FD79A" }} />
            <span style={{ fontWeight: 500 }}>{filename}</span>
            <span style={{ color: "#8B95A7" }}>· {rows.length} filas detectadas</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Pill label={`${summary.ok} listos`} bg="rgba(31,184,116,.16)" fg="#4FD79A" />
            {summary.warn > 0 && (
              <Pill
                label={`${summary.warn} con avisos`}
                bg="rgba(232,163,23,.16)"
                fg="#F6C24A"
              />
            )}
            {summary.err > 0 && (
              <Pill
                label={`${summary.err} con errores`}
                bg="rgba(232,68,68,.16)"
                fg="#FF7A7A"
              />
            )}
          </div>

          <div style={{ border: "1px solid #1F2733", borderRadius: 12, overflow: "hidden" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", font: "400 13px/18px Inter" }}
            >
              <thead style={{ background: "#0A0E14" }}>
                <tr>
                  <th style={{ ...th, width: 32 }}>
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
                  <th style={th}>Fila</th>
                  <th style={th}>Fecha · Hora</th>
                  <th style={th}>Pasajero</th>
                  <th style={th}>Origen → Destino</th>
                  <th style={th}>Agencia</th>
                  <th style={th}>Estado de validación</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.row}
                    style={{ background: r.errors.length ? "rgba(232,68,68,.06)" : "#11161E" }}
                  >
                    <td style={td}>
                      <input
                        type="checkbox"
                        disabled={r.errors.length > 0}
                        checked={!!selected[r.row]}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [r.row]: e.target.checked }))
                        }
                      />
                    </td>
                    <td
                      style={{
                        ...td,
                        fontFamily: "JetBrains Mono",
                        fontSize: 12,
                        color: "#8B95A7",
                      }}
                    >
                      {r.row}
                    </td>
                    <td style={{ ...td, color: "#E7EBF2" }}>
                      {r.date} ·{" "}
                      {r.time || <span style={{ color: "#5E6878" }}>—</span>}
                    </td>
                    <td style={{ ...td, color: "#E7EBF2" }}>
                      {r.passenger || <span style={{ color: "#5E6878" }}>—</span>}
                    </td>
                    <td style={{ ...td, color: "#E7EBF2" }}>
                      {r.origin} → {r.destination}
                    </td>
                    <td style={{ ...td, color: "#E7EBF2" }}>
                      {r.agency || <span style={{ color: "#5E6878" }}>—</span>}
                    </td>
                    <td style={td}>
                      {r.errors.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {r.errors.map((e, i) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                color: "#FF7A7A",
                                font: "500 12px/16px Inter",
                              }}
                            >
                              <Icon name="alert" size={12} />
                              {e}
                            </span>
                          ))}
                        </div>
                      ) : r.warnings.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {r.warnings.map((w, i) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                color: "#F6C24A",
                                font: "500 12px/16px Inter",
                              }}
                            >
                              <Icon name="info" size={12} />
                              {w}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: "#4FD79A",
                            font: "500 12px/16px Inter",
                          }}
                        >
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

          <div style={{ font: "400 12px/16px Inter", color: "#8B95A7" }}>
            Solo se sincronizan los viajes seleccionados. Los que tienen errores no se pueden
            seleccionar — corregí el archivo y volvé a subir.
          </div>
        </div>
      )}
    </Modal>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        padding: "0 10px",
        borderRadius: 9999,
        font: "600 12px/14px Inter",
        background: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}

const th: CSSProperties = {
  font: "600 11px/14px Inter",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "#8B95A7",
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #1F2733",
};
const td: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #161B23",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};
