import { useMemo, useRef, useState } from "react";
import {
  MAX_RANGE_DAYS,
  TODAY,
  TOMORROW,
  addDays,
  clampRange,
  dayRange,
  isSingleDay,
  monthRange,
  rangeDays,
  type DateRange,
} from "../data/catalogos";
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
  // Rango de días que se está mirando (un día suelto es `from === to`). Es del
  // componente de arriba porque es lo que se le pide al backend; cambiarlo
  // dispara una carga nueva.
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
  // El orden también vive arriba: con un rango lo resuelve el servidor
  // (`ordering`), así que es parte del pedido y no estado de la tabla.
  sort: TripSort;
  onSortChange: (s: TripSort) => void;
  // Paginación del servidor. `count` es el total del día (todas las páginas).
  page: number;
  pages: number;
  count: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export type SortKey = keyof Trip | "id" | "pasajero";

export interface TripSort {
  key: SortKey;
  dir: "asc" | "desc";
}

type Column = [SortKey, string, number | null];

// Las columnas que el backend sabe ordenar (`ordering` de /viajes/), con el campo
// suyo que corresponde. Son cuatro de las once: origen, destino, pasajero,
// categoría, unidad y observaciones no tienen equivalente allá.
//
// Por fecha se pide fecha + hora: un rango ordenado solo por día deja las horas
// de cada día en cualquier orden.
const ORDERING_FIELD: Partial<Record<SortKey, string>> = {
  id: "id",
  date: "fecha_servicio,hora_servicio",
  time: "hora_servicio",
  est: "estado",
};

/**
 * Si esa columna se puede ordenar con este rango a la vista.
 *
 * Un día suelto entra en una página (el backend pagina de a 20), así que el
 * navegador ordena el resultado ENTERO y valen las once columnas. Un rango no
 * entra: ahí ordena el servidor, y solo sabe las cuatro de `ORDERING_FIELD`.
 * Ordenar las otras seis en el navegador ordenaría la página cargada y no el
 * rango, que se ve igual pero está mal.
 */
export function canSort(key: SortKey, range: DateRange): boolean {
  return isSingleDay(range) || ORDERING_FIELD[key] != null;
}

/** El `ordering` que hay que pedirle al backend, o nada si ordena el navegador. */
export function orderingParam(sort: TripSort, range: DateRange): string | undefined {
  if (isSingleDay(range)) return undefined;
  const field = ORDERING_FIELD[sort.key] ?? ORDERING_FIELD.date!;
  if (sort.dir === "asc") return field;
  return field
    .split(",")
    .map((f) => `-${f}`)
    .join(",");
}

// Atajos del menú de rango. Son funciones porque `TODAY` se calcula al cargar la
// app y una pestaña abierta de un día para el otro tiene que dar el rango de hoy.
const RANGE_PRESETS: { l: string; range: () => DateRange }[] = [
  { l: "Próx. 7 días", range: () => ({ from: TODAY, to: addDays(TODAY, 6) }) },
  { l: `Próx. ${MAX_RANGE_DAYS} días`, range: () => ({ from: TODAY, to: addDays(TODAY, MAX_RANGE_DAYS - 1) }) },
  { l: "Este mes", range: () => monthRange(TODAY) },
  { l: "Últimos 7 días", range: () => ({ from: addDays(TODAY, -6), to: TODAY }) },
];

/** Orden inicial: por hora dentro de un día, cronológico en un rango. */
export function defaultSort(range: DateRange): TripSort {
  return { key: isSingleDay(range) ? "time" : "date", dir: "asc" };
}

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
  range,
  onRangeChange,
  sort,
  onSortChange,
  page,
  pages,
  count,
  onPageChange,
  loading = false,
}: TripsListProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { estados, metaOf } = useEstados();
  const statusLabel = (id: TripStatus) => metaOf(id)?.label ?? String(id);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  // El rango que se está armando en el menú. Va aparte del que se está mirando:
  // mover "Desde" no tiene que disparar una carga hasta que el rango esté entero.
  const [draft, setDraft] = useState<DateRange>(range);
  const unDia = isSingleDay(range);
  const [revealPhone, setRevealPhone] = useState<string | null>(null);

  const cols = isOperator ? OPERATOR_COLS : ADMIN_COLS;

  // Fecha, estado y búsqueda los resuelve el SERVIDOR (ver App → api.listTrips):
  // lo que llega acá ya está filtrado y paginado. El filtro por fecha se repite
  // igual, para que un viaje recién creado FUERA del rango no se cuele en la
  // lista antes de que la recarga traiga la página correcta.
  //
  // El ORDEN es de esta página solo cuando se mira UN DÍA, y ahí alcanza porque
  // un día entra en una página (el backend pagina de a 20): ordenar acá ordena
  // el resultado entero, no un pedazo, y valen las once columnas.
  //
  // Un rango NO entra en una página, así que el orden viene del servidor
  // (`ordering`, ver orderingParam) y acá no se toca: reordenar la página
  // cargada daría una lista que parece ordenada y no lo está.
  const filtered = useMemo(() => {
    const r = trips.filter((t) => t.date >= range.from && t.date <= range.to);
    if (!isSingleDay(range)) return r;
    return [...r].sort((a, b) => {
      const A = sortValue(a, sort.key);
      const B = sortValue(b, sort.key);
      const c = A < B ? -1 : A > B ? 1 : 0;
      return sort.dir === "asc" ? c : -c;
    });
  }, [trips, range, sort]);

  const sortBy = (key: SortKey) => {
    if (!canSort(key, range)) return;
    onSortChange(
      sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
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
    const nombre = unDia ? range.from : `${range.from}_a_${range.to}`;
    downloadTableXls(exportHeaders, filtered.map(rowCells), `viajes-${nombre}.xls`);
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
  }) => {
    const puede = canSort(k, range);
    return (
      <th
        onClick={() => sortBy(k)}
        className={cx(styles.th, widthCls, !puede && styles.thFixed)}
        title={
          puede
            ? undefined
            : "Con un rango de fechas el orden lo hace el servidor, que solo ordena por ID, fecha, hora y estado"
        }
      >
        <span className={styles.thInner}>
          {children}
          {puede && sort.key === k && (
            <Icon
              name="chevdown"
              size={11}
              className={sort.dir === "desc" ? styles.flip : undefined}
            />
          )}
        </span>
      </th>
    );
  };

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
              onClick={() => onRangeChange(dayRange(o.id))}
              className={cx(styles.segBtn, unDia && range.from === o.id && styles.segBtnActive)}
            >
              {o.l}
            </button>
          ))}
          {!(unDia && (range.from === TODAY || range.from === TOMORROW)) && (
            <span className={styles.segPill}>{rangeLabel(range)}</span>
          )}
          <button
            onClick={() => {
              const input = dateInputRef.current;
              if (!input) return;
              if (typeof input.showPicker === "function") input.showPicker();
              else input.click();
            }}
            title="Elegir un día"
            aria-label="Elegir un día"
            className={styles.calBtn}
          >
            <Icon name="calendar" size={14} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            // El calendario suelto elige UN día. El rango tiene su propio menú:
            // son dos gestos distintos y mezclarlos en un solo input obliga a
            // dos clicks para lo que se hace todo el tiempo (mirar un día).
            value={unDia ? range.from : ""}
            onChange={(e) => {
              if (e.target.value) onRangeChange(dayRange(e.target.value));
            }}
            className={styles.hiddenDate}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        {/* Rango de fechas: hasta MAX_RANGE_DAYS días de una. El tope es del
            front, no del backend (`fecha_servicio__gte/__lte` no lo imponen):
            la lista se pagina de a 20 y un rango abierto son decenas de
            llamadas para llenar la tabla. */}
        <div className={styles.rangeWrap}>
          <button
            onClick={() => {
              setDraft(range);
              setShowRangeMenu((v) => !v);
            }}
            className={cx(styles.statusBtn, !unDia && styles.statusBtnActive)}
            title={`Ver varios días (hasta ${MAX_RANGE_DAYS})`}
          >
            <Icon name="calendar" size={14} />
            {unDia ? "Rango" : `${rangeDays(range)} días`}
            <Icon name="chevdown" size={12} />
          </button>
          {showRangeMenu && (
            <div className={styles.rangeMenu}>
              <div className={styles.rangeRow}>
                <label className={styles.rangeField}>
                  <span className={styles.rangeCap}>Desde</span>
                  <input
                    type="date"
                    value={draft.from}
                    onChange={(e) => {
                      const from = e.target.value;
                      if (!from) return;
                      setDraft(clampRange({ from, to: from > draft.to ? from : draft.to }, "from"));
                    }}
                    className={styles.rangeInput}
                  />
                </label>
                <Icon name="arrowright" size={14} className={styles.rangeArrow} />
                <label className={styles.rangeField}>
                  <span className={styles.rangeCap}>Hasta</span>
                  <input
                    type="date"
                    value={draft.to}
                    // El tope de días lo pone el propio calendario: así no hay
                    // que rechazar nada después de elegirlo.
                    min={draft.from}
                    max={addDays(draft.from, MAX_RANGE_DAYS - 1)}
                    onChange={(e) => {
                      const to = e.target.value;
                      if (!to) return;
                      setDraft(clampRange({ from: to < draft.from ? to : draft.from, to }, "to"));
                    }}
                    className={styles.rangeInput}
                  />
                </label>
              </div>

              <div className={styles.rangeHint}>
                {rangeDays(draft)} {rangeDays(draft) === 1 ? "día" : "días"} · máximo{" "}
                {MAX_RANGE_DAYS}
              </div>

              <div className={styles.rangePresets}>
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.l}
                    onClick={() => setDraft(p.range())}
                    className={styles.presetBtn}
                  >
                    {p.l}
                  </button>
                ))}
              </div>

              <div className={styles.rangeActions}>
                <button onClick={() => setShowRangeMenu(false)} className={styles.clearBtn}>
                  Cancelar
                </button>
                <Button
                  icon="check"
                  onClick={() => {
                    setShowRangeMenu(false);
                    onRangeChange(draft);
                  }}
                >
                  Ver
                </Button>
              </div>
            </div>
          )}
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
          {unDia && range.from === TODAY
            ? "Hoy"
            : unDia && range.from === TOMORROW
              ? "Mañana"
              : rangeLabel(range)}
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

/** Cómo se nombra lo que se está mirando: un día, o los dos extremos del rango. */
function rangeLabel(r: DateRange) {
  if (isSingleDay(r)) return fmtDateLong(r.from);
  return `${fmtDateLong(r.from)} – ${fmtDateLong(r.to)}`;
}
