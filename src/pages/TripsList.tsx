import { useMemo, useRef, useState } from "react";
import { TODAY, TOMORROW } from "../data/catalogos";
import { useEstados } from "../hooks/useEstados";
import type { Trip, TripStatus } from "../types/domain";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Input } from "../components/ui/Field";
import { StatusPicker } from "../components/ui/StatusPicker";
import { cx } from "../lib/cx";
import { copyTableTsv, downloadTableXls } from "../lib/exportTable";
import styles from "./TripsList.module.css";

interface TripsListProps {
  // Los viajes de la página que se está mirando: ya vienen del servidor
  // filtrados por `dateFilter` y cortados por página (ver App).
  trips: Trip[];
  onOpen: (t: Trip) => void;
  onCopy: (msg: string) => void;
  onExport: (msg: string) => void;
  onChangeStatus: (t: Trip, est: TripStatus) => void;
  isOperator?: boolean;
  // Filtros que resuelve el SERVIDOR (viven arriba porque son parte de lo que se
  // le pide): estado, nº de viaje y nombre de pasajero.
  estadoFilter: TripStatus | null;
  onEstadoChange: (est: TripStatus | null) => void;
  qViaje: string;
  onQViajeChange: (q: string) => void;
  qPasajero: string;
  onQPasajeroChange: (q: string) => void;
  // Día que se está mirando. Es del componente de arriba porque es lo que se le
  // pide al backend; cambiarlo dispara una carga nueva.
  dateFilter: string;
  onDateChange: (date: string) => void;
  // Paginación del servidor. `count` es el total del día (todas las páginas).
  page: number;
  pages: number;
  count: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

type SortKey = keyof Trip | "id" | "pasajero";

type Column = [SortKey, string, number | null];

// Columnas para admin: vista completa (la columna "Observaciones" revela el
// celular del pasajero al hacer click).
const ADMIN_COLS: Column[] = [
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

// Columnas para operador de agencia: vista reducida con la columna
// "Apellido y nombre pax" (revela el celular al hacer click) y Observaciones
// como columna simple.
const OPERATOR_COLS: Column[] = [
  ["id", "ID", 80],
  ["date", "Fecha", 90],
  ["time", "Hora", 70],
  ["cat", "Categoría", 110],
  ["ori", "Origen", null],
  ["dst", "Destino", null],
  ["pax", "Pax", 60],
  ["pasajero", "Apellido y nombre pax", null],
  ["est", "Estado", 130],
  ["unit", "Unidad", 90],
  ["obs", "Observaciones", null],
];

function widthClass(w: number | null): string | false {
  return w ? (styles[`w${w}`] ?? false) : false;
}

function destinosOf(t: Trip): string[] {
  const ds = t.legs.map((l) => l.destination.trim()).filter(Boolean);
  if (ds.length) return ds;
  return t.dst ? [t.dst] : [];
}

function paxName(t: Trip): string {
  const p = t.passengers[0];
  return p ? `${p.lastName} ${p.firstName}`.trim() : "";
}

function sortValue(t: Trip, key: SortKey): string | number {
  if (key === "pasajero") return paxName(t).toLowerCase();
  const v = t[key as keyof Trip];
  return (v as string | number) ?? "";
}

function cellText(key: SortKey, t: Trip, statusLabel: (id: TripStatus) => string): string {
  switch (key) {
    case "id":
      return t.id;
    case "date":
      return fmtDate(t.date);
    case "time":
      return t.time;
    case "cat":
      return t.cat;
    case "ori":
      return t.ori;
    case "dst":
      return destinosOf(t).join(" → ");
    case "pax":
      return String(t.pax);
    case "est":
      return statusLabel(t.est);
    case "unit":
      return t.unit || "";
    case "pasajero":
      return paxName(t);
    case "obs":
      return t.obs || "";
    default:
      return "";
  }
}

// Acota una dirección geocodificada a su primer segmento (nombre del lugar),
// p. ej. "NH, Bolívar, C1066AAD, CABA" → "NH".
function shortPlace(s: string): string {
  const first = s.split(",")[0]?.trim();
  return first || s;
}

function PlaceCell({ value }: { value: string }) {
  if (!value) return <span className={styles.dim}>—</span>;
  return (
    <span className={styles.place} title={value}>
      {shortPlace(value)}
    </span>
  );
}

function DestinosCell({ trip }: { trip: Trip }) {
  const ds = destinosOf(trip);
  if (!ds.length) return <span className={styles.dim}>—</span>;
  if (ds.length === 1) {
    return (
      <span className={styles.place} title={ds[0]}>
        {shortPlace(ds[0])}
      </span>
    );
  }
  return (
    <span className={styles.destinos}>
      {ds.map((d, i) => (
        <span key={i} className={styles.destinoLine} title={d}>
          <span className={styles.destinoNum}>{i + 1}</span>
          <span className={styles.place}>{shortPlace(d)}</span>
        </span>
      ))}
    </span>
  );
}

export function TripsList({
  trips,
  onOpen,
  onCopy,
  onExport,
  onChangeStatus,
  isOperator = false,
  estadoFilter,
  onEstadoChange,
  qViaje,
  onQViajeChange,
  qPasajero,
  onQPasajeroChange,
  dateFilter,
  onDateChange,
  page,
  pages,
  count,
  onPageChange,
  loading = false,
}: TripsListProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { estados, metaOf } = useEstados();
  const statusLabel = (id: TripStatus) => metaOf(id)?.label ?? String(id);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "time",
    dir: "asc",
  });
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [revealPhone, setRevealPhone] = useState<string | null>(null);

  const cols = isOperator ? OPERATOR_COLS : ADMIN_COLS;

  // Fecha, estado y búsqueda los resuelve el SERVIDOR (ver App → api.listTrips):
  // lo que llega acá ya está filtrado y paginado. El filtro por fecha se repite
  // igual, para que un viaje recién creado en OTRO día no se cuele en la lista
  // antes de que la recarga traiga la página correcta.
  //
  // El ORDEN sí es de esta página: el backend solo sabe ordenar por
  // `fecha_servicio` y la lista ya está acotada a un día, así que no hay nada
  // que delegarle (ver docs/pendientes.md).
  const filtered = useMemo(() => {
    const r = trips.filter((t) => t.date === dateFilter);
    return [...r].sort((a, b) => {
      const A = sortValue(a, sort.key);
      const B = sortValue(b, sort.key);
      const c = A < B ? -1 : A > B ? 1 : 0;
      return sort.dir === "asc" ? c : -c;
    });
  }, [trips, dateFilter, sort]);

  const sortBy = (key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

  const exportHeaders = cols.map(([, label]) => label);
  const rowCells = (t: Trip): string[] => cols.map(([k]) => cellText(k, t, statusLabel));

  const handleCopy = async () => {
    if (!filtered.length) {
      onCopy("No hay viajes para copiar");
      return;
    }
    try {
      await copyTableTsv(exportHeaders, filtered.map(rowCells));
      onCopy(`${filtered.length} viajes copiados al portapapeles`);
    } catch {
      onCopy("No se pudo copiar la tabla");
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      onExport("No hay viajes para exportar");
      return;
    }
    downloadTableXls(exportHeaders, filtered.map(rowCells), `viajes-${dateFilter}.xls`);
    onExport(`Exportando ${filtered.length} viajes a Excel`);
  };

  const togglePhone = (t: Trip) => setRevealPhone((cur) => (cur === t.id ? null : t.id));

  const renderCell = (key: SortKey, t: Trip) => {
    switch (key) {
      case "id":
        return (
          <td key={key} className={cx(styles.td, styles.tdId)}>
            {t.id}
          </td>
        );
      case "date":
        return (
          <td key={key} className={styles.td}>
            {fmtDate(t.date)}
          </td>
        );
      case "time":
        return (
          <td key={key} className={cx(styles.td, styles.tdTnum)}>
            {t.time}
          </td>
        );
      case "cat":
        return (
          <td key={key} className={styles.td}>
            {t.cat}
          </td>
        );
      case "ori":
        return (
          <td key={key} className={cx(styles.td, styles.tdPlace)}>
            <PlaceCell value={t.ori} />
          </td>
        );
      case "dst":
        return (
          <td key={key} className={cx(styles.td, styles.tdPlace)}>
            <DestinosCell trip={t} />
          </td>
        );
      case "pax":
        return (
          <td key={key} className={styles.td}>
            {t.pax}
          </td>
        );
      case "pasajero":
        return (
          <td
            key={key}
            className={styles.td}
            onClick={(e) => {
              e.stopPropagation();
              togglePhone(t);
            }}
          >
            {revealPhone === t.id && t.passengers[0] ? (
              <span className={styles.phone}>
                <Icon name="phone" size={12} />
                {t.passengers[0].phone}
              </span>
            ) : (
              <span className={styles.place} title={paxName(t)}>
                {paxName(t) || <span className={styles.dim}>—</span>}
              </span>
            )}
          </td>
        );
      case "est":
        return (
          <td key={key} className={styles.td}>
            <StatusPicker value={t.est} onChange={(est) => onChangeStatus(t, est)} />
          </td>
        );
      case "unit":
        return (
          <td key={key} className={cx(styles.td, styles.tdMono)}>
            {t.unit || "—"}
          </td>
        );
      case "obs":
        // Operador: columna simple. Admin: revela el celular al hacer click.
        if (isOperator) {
          return (
            <td key={key} className={styles.td}>
              <span className={styles.obs}>
                {t.obs || <span className={styles.dim}>—</span>}
              </span>
            </td>
          );
        }
        return (
          <td
            key={key}
            className={styles.td}
            onClick={(e) => {
              e.stopPropagation();
              togglePhone(t);
            }}
          >
            {revealPhone === t.id && t.passengers[0] ? (
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
        );
      default:
        return <td key={key} className={styles.td} />;
    }
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
              onClick={() => onDateChange(o.id)}
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
              if (e.target.value) onDateChange(e.target.value);
            }}
            className={styles.hiddenDate}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        {/* Un solo estado por vez: el backend filtra por `estado=<id>`, que es un
            entero. Antes era multi-select pero filtraba solo la página cargada,
            así que un estado con viajes en la página 2 aparecía como vacío. */}
        <div className={styles.statusWrap}>
          <button onClick={() => setShowStatusMenu((s) => !s)} className={styles.statusBtn}>
            <Icon name="filter" size={14} />
            {estadoFilter == null ? "Estado" : `Estado · ${statusLabel(estadoFilter)}`}
            <Icon name="chevdown" size={12} />
          </button>
          {showStatusMenu && (
            <div className={styles.statusMenu}>
              {estados.map((s) => (
                <label key={s.id} className={styles.statusOpt}>
                  <input
                    type="radio"
                    name="estado"
                    checked={estadoFilter === s.id}
                    onChange={() => {
                      setShowStatusMenu(false);
                      onEstadoChange(s.id);
                    }}
                  />
                  <Badge status={s.id} />
                </label>
              ))}
              {estadoFilter != null && (
                <button
                  onClick={() => {
                    setShowStatusMenu(false);
                    onEstadoChange(null);
                  }}
                  className={styles.clearBtn}
                >
                  Limpiar filtro
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dos búsquedas, no una: el backend no tiene un `search` que cruce las
            dos cosas. `search` mira el nº de viaje y la referencia;
            `pasajeros__persona__nombre__icontains`, el nombre del pasajero.
            Las dos filtran contra TODO el día, no contra la página cargada. */}
        <div className={styles.searchWrap}>
          <Icon name="search" size={14} className={styles.searchIcon} />
          <Input
            value={qViaje}
            onChange={(e) => onQViajeChange(e.target.value)}
            placeholder="Nº de viaje o referencia"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.searchWrap}>
          <Icon name="search" size={14} className={styles.searchIcon} />
          <Input
            value={qPasajero}
            onChange={(e) => onQPasajeroChange(e.target.value)}
            placeholder="Pasajero"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.spacer} />

        <Button icon="copy" onClick={handleCopy}>
          Copiar tabla
        </Button>
        <Button icon="excel" onClick={handleExport}>
          Exportar Excel
        </Button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headRow}>
              {cols.map(([k, l, w]) => (
                <SortableTH key={k} k={k} widthCls={widthClass(w)}>
                  {l}
                </SortableTH>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} onClick={() => onOpen(t)} className={styles.row}>
                {cols.map(([k]) => renderCell(k, t))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={cols.length} className={styles.empty}>
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
          {/* Se muestran las filas de esta página y, si el día tiene más, el
              total: "12 de 47 viajes". */}
          <span className={styles.countNum}>{filtered.length}</span>
          {count > filtered.length ? ` de ${count}` : ""} viajes ·{" "}
          {dateFilter === TODAY
            ? "Hoy"
            : dateFilter === TOMORROW
              ? "Mañana"
              : fmtDateLong(dateFilter)}
        </div>
        <div className={styles.pager}>
          <button
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
            title="Anterior"
            className={styles.pageBtn}
            aria-label="Anterior"
          >
            <Icon name="chevleft" size={14} />
          </button>
          <span className={styles.pageNum}>
            {page} / {pages}
          </span>
          <button
            disabled={loading || page >= pages}
            onClick={() => onPageChange(page + 1)}
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
