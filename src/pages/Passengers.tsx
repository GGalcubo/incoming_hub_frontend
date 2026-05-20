import { useMemo, useState } from "react";
import { AGENCIES } from "../data/seed";
import type { Passenger, Trip } from "../types/domain";
import { Icon } from "../components/ui/Icon";
import { Input, Select } from "../components/ui/Field";
import { cx } from "../lib/cx";
import styles from "./Passengers.module.css";

interface PassengersListProps {
  trips: Trip[];
  loading: boolean;
}

interface PassengerRow extends Passenger {
  agc: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

const COLUMNS: [string, "w160" | "w130" | null][] = [
  ["Nombre", null],
  ["Apellido", null],
  ["Teléfono", "w160"],
  ["Email", null],
  ["Agencia", "w160"],
  ["Fecha creado", "w130"],
];

export function PassengersList({ trips, loading }: PassengersListProps) {
  const [agencyFilter, setAgencyFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo<PassengerRow[]>(() => {
    const map = new Map<string, PassengerRow>();
    for (const t of trips) {
      for (const p of t.passengers) {
        const key = `${p.firstName} ${p.lastName}`.trim();
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
    return Array.from(map.values()).sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
    );
  }, [trips]);

  const filtered = useMemo(() => {
    let r = rows;
    if (agencyFilter) r = r.filter((p) => p.agc === agencyFilter);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) ||
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
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.agencyWrap}>
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

        <div className={styles.searchWrap}>
          <Icon name="search" size={14} className={styles.searchIcon} />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
            placeholder="Buscar por nombre, email o teléfono"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.spacer} />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headRow}>
              {COLUMNS.map(([label, w]) => (
                <th key={label} className={cx(styles.th, w && styles[w])}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p) => (
              <tr key={`${p.firstName} ${p.lastName}`}>
                <td className={styles.td}>{p.firstName}</td>
                <td className={styles.td}>{p.lastName}</td>
                <td className={cx(styles.td, styles.tdMono)}>{p.phone || "—"}</td>
                <td className={styles.td}>
                  {p.email || <span className={styles.dim}>—</span>}
                </td>
                <td className={styles.td}>{p.agc}</td>
                <td className={cx(styles.td, styles.tdTnum)}>{fmtDate(p.createdAt)}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  <div className={styles.emptyTitle}>
                    {loading ? "Cargando pasajeros…" : "No hay pasajeros para mostrar."}
                  </div>
                  {!loading && (
                    <div className={styles.emptySub}>
                      Probá cambiar la agencia o limpiar la búsqueda.
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <div className={styles.count}>
          <span className={styles.countNum}>{filtered.length}</span> pasajeros
        </div>
        <div className={styles.pager}>
          <button
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Anterior"
            className={styles.pageBtn}
            aria-label="Anterior"
          >
            <Icon name="chevleft" size={14} />
          </button>
          <span className={styles.pageNum}>
            {safePage} / {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            title="Siguiente"
            className={styles.pageBtn}
            aria-label="Siguiente"
          >
            <Icon name="chevright" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
