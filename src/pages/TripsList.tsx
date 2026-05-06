import { useMemo, useState } from "react";
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
  onCargarExcel: () => void;
  onCopy: () => void;
  onExport: () => void;
}

type SortKey = keyof Trip | "id";

export function TripsList({ trips, onOpen, onCargarExcel, onCopy, onExport }: TripsListProps) {
  const isMobile = useIsMobile();
  const [dateFilter, setDateFilter] = useState<"today" | "tomorrow">("today");
  const [statusFilter, setStatusFilter] = useState<TripStatus[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "time",
    dir: "asc",
  });
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [revealPhone, setRevealPhone] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const targetDate = dateFilter === "today" ? TODAY : TOMORROW;
    let r = trips.filter((t) => t.date === targetDate);
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
        background: "#0A0E14",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 28px",
          background: "#0A0E14",
          borderBottom: "1px solid #1F2733",
          flex: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "#11161E",
            border: "1px solid #1F2733",
            borderRadius: 9999,
            padding: 3,
          }}
        >
          {[
            { id: "today" as const, l: "Hoy" },
            { id: "tomorrow" as const, l: "Mañana" },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setDateFilter(o.id)}
              style={{
                border: "none",
                background: dateFilter === o.id ? "#1FB874" : "transparent",
                color: dateFilter === o.id ? "#0A0E14" : "#B5BCC9",
                font: dateFilter === o.id ? "600 13px/18px Inter" : "500 13px/18px Inter",
                padding: "5px 14px",
                borderRadius: 9999,
                cursor: "pointer",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowStatusMenu((s) => !s)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#1A2029",
              border: "1px solid #2A323F",
              borderRadius: 9999,
              padding: "7px 14px",
              font: "500 13px/18px Inter",
              color: "#F5F7FB",
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
                background: "#11161E",
                border: "1px solid #1F2733",
                borderRadius: 12,
                boxShadow: "0 6px 16px rgba(0,0,0,.45), 0 2px 4px rgba(0,0,0,.30)",
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
                    font: "400 13px/18px Inter",
                    color: "#E7EBF2",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1A2029")}
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
                    color: "#4FD79A",
                    font: "500 13px/18px Inter",
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
              color: "#8B95A7",
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
        <Button kind="primary" icon="upload" onClick={onCargarExcel}>
          Cargar Excel
        </Button>
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "#0A0E14" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", font: "400 13px/18px Inter" }}
        >
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 1, background: "#0A0E14" }}>
              {COLS.map(([k, l, w]) => (
                <SortableTH
                  key={k}
                  k={k}
                  style={{
                    font: "600 11px/14px Inter",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "#8B95A7",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderBottom: "1px solid #1F2733",
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
                onMouseEnter={(e) => (e.currentTarget.style.background = "#11161E")}
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
                        color: "#6FAEFF",
                        font: "500 13px JetBrains Mono",
                      }}
                    >
                      <Icon name="phone" size={12} />
                      {t.passengers[0].phone}
                    </span>
                  ) : (
                    <span style={{ color: "#B5BCC9" }}>
                      {t.obs || (
                        <span style={{ color: "#5E6878" }}>— ver pasajero</span>
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
                  style={{ padding: "60px 24px", textAlign: "center", color: "#8B95A7" }}
                >
                  <div style={{ font: "500 14px/20px Inter", color: "#E7EBF2" }}>
                    No hay viajes para mostrar.
                  </div>
                  <div style={{ font: "400 13px/18px Inter" }}>
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
          borderTop: "1px solid #1F2733",
          background: "#0A0E14",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flex: "none",
          font: "400 13px/18px Inter",
          color: "#8B95A7",
          gap: 12,
        }}
      >
        <div style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: "#F5F7FB", fontWeight: 500 }}>{filtered.length}</span>{" "}
          viajes · {dateFilter === "today" ? "Hoy" : "Mañana"}
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
              font: "500 13px/18px Inter",
              color: "#F5F7FB",
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
  borderBottom: "1px solid #161B23",
  color: "#E7EBF2",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};
const tdMono: CSSProperties = { ...td, fontFamily: "JetBrains Mono", fontSize: 12, color: "#8B95A7" };

const paginationBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9999,
  background: "#1A2029",
  border: "1px solid #2A323F",
  color: "#8B95A7",
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
