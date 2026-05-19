import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AGENCIES } from "../data/seed";
import type { Passenger, Trip } from "../types/domain";
import { Icon } from "../components/ui/Icon";
import { Input, Select } from "../components/ui/Field";
import { useIsMobile } from "../hooks/useIsMobile";

interface PassengersListProps {
  trips: Trip[];
  loading: boolean;
}

interface PassengerRow extends Passenger {
  agc: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

export function PassengersList({ trips, loading }: PassengersListProps) {
  const isMobile = useIsMobile();
  const [agencyFilter, setAgencyFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo<PassengerRow[]>(() => {
    const map = new Map<string, PassengerRow>();
    for (const t of trips) {
      for (const p of t.passengers) {
        const key = p.name.trim();
        if (!key) continue;
        const prev = map.get(key);
        if (!prev) {
          map.set(key, { ...p, agc: t.agc, createdAt: t.date });
        } else {
          if (t.date < prev.createdAt) prev.createdAt = t.date;
          if (t.date >= prev.createdAt) prev.agc = t.agc;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [trips]);

  const filtered = useMemo(() => {
    let r = rows;
    if (agencyFilter) r = r.filter((p) => p.agc === agencyFilter);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.phone.toLowerCase().includes(s) ||
          (p.email ?? "").toLowerCase().includes(s) ||
          p.agc.toLowerCase().includes(s),
      );
    }
    return r;
  }, [rows, agencyFilter, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPage = () => setPage(1);

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
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 220 }}>
          <Select
            value={agencyFilter}
            onChange={(e) => {
              setAgencyFilter(e.target.value);
              resetPage();
            }}
          >
            <option value="">Todas las agencias</option>
            {AGENCIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
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
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
            placeholder="Buscar por nombre, email o teléfono"
            style={{ paddingLeft: 34 }}
          />
        </div>

        <div style={{ flex: 1 }} />
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-app)" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", font: "400 13px/18px Heming" }}
        >
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-app)" }}>
              {[
                ["Nombre", null],
                ["Teléfono", 160],
                ["Email", null],
                ["Agencia", 160],
                ["Fecha creado", 130],
              ].map(([l, w]) => (
                <th
                  key={l as string}
                  style={{
                    font: "600 11px/14px Heming",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "var(--fg-muted)",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border-subtle)",
                    width: w ? (w as number) : "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p) => (
              <tr key={p.name}>
                <td style={td}>{p.name}</td>
                <td style={{ ...td, fontFamily: "JetBrains Mono", fontSize: 12 }}>
                  {p.phone || "—"}
                </td>
                <td style={td}>{p.email || <span style={{ color: "var(--fg-disabled)" }}>—</span>}</td>
                <td style={td}>{p.agc}</td>
                <td style={{ ...td, fontFeatureSettings: '"tnum" 1' }}>{fmtDate(p.createdAt)}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: "60px 24px", textAlign: "center", color: "var(--fg-muted)" }}
                >
                  <div
                    style={{
                      font: "500 14px/20px Heming",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    {loading ? "Cargando pasajeros…" : "No hay pasajeros para mostrar."}
                  </div>
                  {!loading && (
                    <div style={{ font: "400 13px/18px Heming" }}>
                      Probá cambiar la agencia o limpiar la búsqueda.
                    </div>
                  )}
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
          pasajeros
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Anterior"
            style={safePage <= 1 ? paginationBtnDisabled : paginationBtn}
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
            {safePage} / {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            title="Siguiente"
            style={safePage >= totalPages ? paginationBtnDisabled : paginationBtn}
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
const paginationBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9999,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-strong)",
  color: "var(--fg-primary)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const paginationBtnDisabled: CSSProperties = {
  ...paginationBtn,
  color: "var(--fg-muted)",
  cursor: "not-allowed",
  opacity: 0.5,
};

function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
