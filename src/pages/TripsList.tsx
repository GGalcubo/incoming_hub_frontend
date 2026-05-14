import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { STATUSES, TODAY, TOMORROW } from "../data/seed";
import type { Trip, TripStatus } from "../types/domain";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Input } from "../components/ui/Field";
import { useIsMobile } from "../hooks/useIsMobile";

interface TripsListProps {
  trips: Trip[];
  onOpen: (t: Trip) => void;
  onCopy: () => void;
  onExport: () => void;
}

type SortKey = keyof Trip | "id";

export function TripsList({ trips, onOpen, onCopy, onExport }: TripsListProps) {
  const isMobile = useIsMobile();
  const [dateFilter, setDateFilter] = useState<string>(TODAY);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<TripStatus[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "time",
    dir: "asc",
  });
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [revealPhone, setRevealPhone] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = trips.filter((t) => t.date === dateFilter);
    if (statusFilter.length) r = r.filter((t) => statusFilter.includes(t.est));
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        (t) =>
          t.id.toLowerCase().includes(s) ||
          t.passengers.some((p) => p.name.toLowerCase().includes(s)) ||
          t.agc.toLowerCase().includes(s),
      );
    }
    r = [...r].sort((a, b) => {
      const A = a[sort.key as keyof Trip] ?? "";
      const B = b[sort.key as keyof Trip] ?? "";
      const c = A < B ? -1 : A > B ? 1 : 0;
      return sort.dir === "asc" ? c : -c;
    });
    return r;
  }, [trips, dateFilter, statusFilter, q, sort]);

  const toggleStatus = (id: TripStatus) => {
    setStatusFilter((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const sortBy = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const SortableTH = ({
    k,
    children,
    style,
  }: {
    k: SortKey;
    children: React.ReactNode;
    style?: CSSProperties;
  }) => (
    <th onClick={() => sortBy(k)} style={{ cursor: "pointer", userSelect: "none", ...style }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {children}
        {sort.key === k && (
          <Icon
            name="chevdown"
            size={11}
            style={{ transform: sort.dir === "desc" ? "rotate(180deg)" : "none" }}
          />
        )}
      </span>
    </th>
  );

  const COLS: [SortKey, string, number | null][] = [
    ["id", "ID", 80],
    ["date", "Fecha", 90],
    ["time", "Hora", 70],
    ["pax", "Pax", 60],
    ["cat", "Categoría", 110],
    ["ori", "Origen", null],
    ["dst", "Destino", null],
    ["est", "Estado", 130],
    ["unit", "Unidad", 90],
    ["agc", "Agencia", 130],
    ["ref", "Ref ext", 110],
    ["obs", "Observaciones", null],
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-app)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 28px",
          background: "var(--bg-app)",
          borderBottom: "1px solid var(--border-subtle)",
          flex: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 9999,
            padding: 3,
          }}
        >
          {[
            { id: TODAY, l: "Hoy" },
            { id: TOMORROW, l: "Mañana" },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setDateFilter(o.id)}
              style={{
                border: "none",
                background: dateFilter === o.id ? "var(--brand-500)" : "transparent",
                color: dateFilter === o.id ? "var(--fg-on-brand)" : "var(--fg-tertiary)",
                font: dateFilter === o.id ? "600 13px/18px Heming" : "500 13px/18px Heming",
                padding: "5px 14px",
                borderRadius: 9999,
                cursor: "pointer",
              }}
            >
              {o.l}
            </button>
          ))}
          {dateFilter !== TODAY && dateFilter !== TOMORROW && (
            <span
              style={{
                background: "var(--brand-500)",
                color: "var(--fg-on-brand)",
                font: "600 13px/18px Heming",
                padding: "5px 14px",
                borderRadius: 9999,
              }}
            >
              {fmtDateLong(dateFilter)}
            </span>
          )}
          <button
            onClick={() => {
              const input = dateInputRef.current;
              if (!input) return;
              if (typeof input.showPicker === "function") input.showPicker();
              else input.click();
            }}
            title="Elegir fecha"
            aria-label="Elegir fecha"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--fg-tertiary)",
              padding: "5px 10px",
              borderRadius: 9999,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="calendar" size={14} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={dateFilter}
            onChange={(e) => {
              if (e.target.value) setDateFilter(e.target.value);
            }}
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowStatusMenu((s) => !s)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              borderRadius: 9999,
              padding: "7px 14px",
              font: "500 13px/18px Heming",
              color: "var(--fg-primary)",
              cursor: "pointer",
            }}
          >
            <Icon name="filter" size={14} />
            Estado{statusFilter.length ? ` · ${statusFilter.length}` : ""}
            <Icon name="chevdown" size={12} />
          </button>
          {showStatusMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                zIndex: 10,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                boxShadow: "var(--shadow-md)",
                padding: 6,
                minWidth: 220,
              }}
            >
              {STATUSES.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    font: "400 13px/18px Heming",
                    color: "var(--fg-secondary)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <input
                    type="checkbox"
                    checked={statusFilter.includes(s.id)}
                    onChange={() => toggleStatus(s.id)}
                  />
                  <Badge status={s.id} />
                </label>
              ))}
              {statusFilter.length > 0 && (
                <button
                  onClick={() => setStatusFilter([])}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--fg-link)",
                    font: "500 13px/18px Heming",
                    padding: "7px 10px",
                    cursor: "pointer",
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Icon
            name="search"
            size={14}
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--fg-muted)",
            }}
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por viaje, pasajero o agencia"
            style={{ paddingLeft: 34 }}
          />
        </div>

        <div style={{ flex: 1 }} />

        <Button icon="copy" onClick={onCopy}>
          Copiar tabla
        </Button>
        <Button icon="excel" onClick={onExport}>
          Exportar Excel
        </Button>
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-app)" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", font: "400 13px/18px Heming" }}
        >
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-app)" }}>
              {COLS.map(([k, l, w]) => (
                <SortableTH
                  key={k}
                  k={k}
                  style={{
                    font: "600 11px/14px Heming",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "var(--fg-muted)",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border-subtle)",
                    width: w ? w : "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {l}
                </SortableTH>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                onClick={() => onOpen(t)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={tdMono}>{t.id}</td>
                <td style={td}>{fmtDate(t.date)}</td>
                <td style={{ ...td, fontFeatureSettings: '"tnum" 1' }}>{t.time}</td>
                <td style={td}>{t.pax}</td>
                <td style={td}>{t.cat}</td>
                <td style={td}>{t.ori}</td>
                <td style={td}>{t.dst}</td>
                <td style={td}>
                  <Badge status={t.est} />
                </td>
                <td style={tdMono}>{t.unit || "—"}</td>
                <td style={td}>{t.agc}</td>
                <td style={tdMono}>{t.ref}</td>
                <td
                  style={td}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevealPhone(t.id);
                  }}
                >
                  {revealPhone === t.id ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--info-fg)",
                        font: "500 13px JetBrains Mono",
                      }}
                    >
                      <Icon name="phone" size={12} />
                      {t.passengers[0].phone}
                    </span>
                  ) : (
                    <span style={{ color: "var(--fg-tertiary)" }}>
                      {t.obs || (
                        <span style={{ color: "var(--fg-disabled)" }}>— ver pasajero</span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  style={{ padding: "60px 24px", textAlign: "center", color: "var(--fg-muted)" }}
                >
                  <div
                    style={{
                      font: "500 14px/20px Heming",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    No hay viajes para mostrar.
                  </div>
                  <div style={{ font: "400 13px/18px Heming" }}>
                    Probá cambiar la fecha o limpiar los filtros.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          minHeight: 48,
          padding: isMobile ? "10px 16px" : "0 28px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-app)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flex: "none",
          font: "400 13px/18px Heming",
          color: "var(--fg-muted)",
          gap: 12,
        }}
      >
        <div style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--fg-primary)", fontWeight: 500 }}>{filtered.length}</span>{" "}
          viajes · {dateFilter === TODAY ? "Hoy" : dateFilter === TOMORROW ? "Mañana" : fmtDateLong(dateFilter)}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            disabled
            title="Anterior"
            style={paginationBtn}
            aria-label="Anterior"
          >
            <Icon name="chevleft" size={14} />
          </button>
          <span
            style={{
              font: "500 13px/18px Heming",
              color: "var(--fg-primary)",
              padding: "0 6px",
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            1 / 1
          </span>
          <button
            disabled
            title="Siguiente"
            style={paginationBtn}
            aria-label="Siguiente"
          >
            <Icon name="chevright" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

const td: CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--border-subtle)",
  color: "var(--fg-secondary)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};
const tdMono: CSSProperties = {
  ...td,
  fontFamily: "JetBrains Mono",
  fontSize: 12,
  color: "var(--fg-muted)",
};

const paginationBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9999,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-strong)",
  color: "var(--fg-muted)",
  cursor: "not-allowed",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  opacity: 0.5,
};

function fmtDate(s: string) {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
}

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDateLong(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]}`;
}
