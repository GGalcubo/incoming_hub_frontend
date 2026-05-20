import { useMemo, useRef, useState } from "react";
import { STATUSES, TODAY, TOMORROW } from "../data/seed";
import type { Trip, TripStatus } from "../types/domain";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Input } from "../components/ui/Field";
import { cx } from "../lib/cx";
import styles from "./TripsList.module.css";

interface TripsListProps {
  trips: Trip[];
  onOpen: (t: Trip) => void;
  onCopy: () => void;
  onExport: () => void;
}

type SortKey = keyof Trip | "id";

const COLS: [SortKey, string, number | null][] = [
  ["id", "ID", 80],
  ["date", "Fecha", 90],
  ["time", "Hora", 70],
  ["cat", "Categoría", 110],
  ["ori", "Origen", null],
  ["dst", "Destino", null],
  ["pax", "Pax", 60],
  ["est", "Estado", 130],
  ["unit", "Unidad", 90],
  ["obs", "Observaciones", null],
];

function widthClass(w: number | null): string | false {
  return w ? (styles[`w${w}`] ?? false) : false;
}

export function TripsList({ trips, onOpen, onCopy, onExport }: TripsListProps) {
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
          t.passengers.some((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(s)) ||
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
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

  const SortableTH = ({
    k,
    children,
    widthCls,
  }: {
    k: SortKey;
    children: React.ReactNode;
    widthCls?: string | false;
  }) => (
    <th onClick={() => sortBy(k)} className={cx(styles.th, widthCls)}>
      <span className={styles.thInner}>
        {children}
        {sort.key === k && (
          <Icon name="chevdown" size={11} className={sort.dir === "desc" ? styles.flip : undefined} />
        )}
      </span>
    </th>
  );

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.segment}>
          {[
            { id: TODAY, l: "Hoy" },
            { id: TOMORROW, l: "Mañana" },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setDateFilter(o.id)}
              className={cx(styles.segBtn, dateFilter === o.id && styles.segBtnActive)}
            >
              {o.l}
            </button>
          ))}
          {dateFilter !== TODAY && dateFilter !== TOMORROW && (
            <span className={styles.segPill}>{fmtDateLong(dateFilter)}</span>
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
            className={styles.calBtn}
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
            className={styles.hiddenDate}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        <div className={styles.statusWrap}>
          <button onClick={() => setShowStatusMenu((s) => !s)} className={styles.statusBtn}>
            <Icon name="filter" size={14} />
            Estado{statusFilter.length ? ` · ${statusFilter.length}` : ""}
            <Icon name="chevdown" size={12} />
          </button>
          {showStatusMenu && (
            <div className={styles.statusMenu}>
              {STATUSES.map((s) => (
                <label key={s.id} className={styles.statusOpt}>
                  <input
                    type="checkbox"
                    checked={statusFilter.includes(s.id)}
                    onChange={() => toggleStatus(s.id)}
                  />
                  <Badge status={s.id} />
                </label>
              ))}
              {statusFilter.length > 0 && (
                <button onClick={() => setStatusFilter([])} className={styles.clearBtn}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.searchWrap}>
          <Icon name="search" size={14} className={styles.searchIcon} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por viaje, pasajero o agencia"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.spacer} />

        <Button icon="copy" onClick={onCopy}>
          Copiar tabla
        </Button>
        <Button icon="excel" onClick={onExport}>
          Exportar Excel
        </Button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headRow}>
              {COLS.map(([k, l, w]) => (
                <SortableTH key={k} k={k} widthCls={widthClass(w)}>
                  {l}
                </SortableTH>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} onClick={() => onOpen(t)} className={styles.row}>
                <td className={cx(styles.td, styles.tdMono)}>{t.id}</td>
                <td className={styles.td}>{fmtDate(t.date)}</td>
                <td className={cx(styles.td, styles.tdTnum)}>{t.time}</td>
                <td className={styles.td}>{t.cat}</td>
                <td className={styles.td}>{t.ori}</td>
                <td className={styles.td}>{t.dst}</td>
                <td className={styles.td}>{t.pax}</td>
                <td className={styles.td}>
                  <Badge status={t.est} />
                </td>
                <td className={cx(styles.td, styles.tdMono)}>{t.unit || "—"}</td>
                <td
                  className={styles.td}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevealPhone(t.id);
                  }}
                >
                  {revealPhone === t.id ? (
                    <span className={styles.phone}>
                      <Icon name="phone" size={12} />
                      {t.passengers[0].phone}
                    </span>
                  ) : (
                    <span className={styles.obs}>
                      {t.obs || <span className={styles.dim}>— ver pasajero</span>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className={styles.empty}>
                  <div className={styles.emptyTitle}>No hay viajes para mostrar.</div>
                  <div className={styles.emptySub}>
                    Probá cambiar la fecha o limpiar los filtros.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <div className={styles.count}>
          <span className={styles.countNum}>{filtered.length}</span> viajes ·{" "}
          {dateFilter === TODAY
            ? "Hoy"
            : dateFilter === TOMORROW
              ? "Mañana"
              : fmtDateLong(dateFilter)}
        </div>
        <div className={styles.pager}>
          <button disabled title="Anterior" className={styles.pageBtn} aria-label="Anterior">
            <Icon name="chevleft" size={14} />
          </button>
          <span className={styles.pageNum}>1 / 1</span>
          <button disabled title="Siguiente" className={styles.pageBtn} aria-label="Siguiente">
            <Icon name="chevright" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

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
