import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../api/client";
import type { Persona } from "../api/backend";
import { Icon } from "../components/ui/Icon";
import { Input, Select } from "../components/ui/Field";
import { cx } from "../lib/cx";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./Passengers.module.css";

const COLUMNS = ["Nombre", "Apellido", "Teléfono", "Email", "Agencia", "Fecha creado"];

const ROW_HEIGHT = 45;

export function PassengersList() {
  const [agencyFilter, setAgencyFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim(), 300);

  const { data: access } = useQuery({
    queryKey: ["passengersAccess"],
    queryFn: () => api.passengersAccess(),
    staleTime: 5 * 60_000,
  });
  const isAdmin = access?.isAdmin ?? false;
  const agencias = access?.agencies ?? [];
  const agencyName = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of agencias) m.set(a.id, a.nombre);
    return m;
  }, [agencias]);

  // Admin: filtro libre por el dropdown. No-admin: forzado a su propia agencia.
  const agenciaId = isAdmin
    ? agencyFilter
      ? Number(agencyFilter)
      : null
    : access?.ownAgencyId ?? null;

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["personas", search, agenciaId],
    queryFn: ({ pageParam }) =>
      api.listPersonas({ page: pageParam, search, agencia: agenciaId }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.next ? allPages.length + 1 : undefined,
    enabled: !!access,
  });

  const rows = useMemo<Persona[]>(
    () => data?.pages.flatMap((p) => p.results) ?? [],
    [data],
  );
  const total = data?.pages[0]?.count ?? 0;

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  // Pide la siguiente página cuando el último ítem virtual entra en rango.
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const showEmpty = !isLoading && !isError && rows.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.agencyWrap}>
          {isAdmin ? (
            <Select
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
            >
              <option value="">Todas las agencias</option>
              {agencias.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </Select>
          ) : (
            <Select value={agenciaId ?? ""} disabled>
              <option value={agenciaId ?? ""}>
                {(agenciaId != null && agencyName.get(agenciaId)) || "Tu agencia"}
              </option>
            </Select>
          )}
        </div>

        <div className={styles.searchWrap}>
          <Icon name="search" size={14} className={styles.searchIcon} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.spacer} />
      </div>

      <div className={styles.tableWrap} ref={parentRef}>
        <div className={styles.headGrid}>
          {COLUMNS.map((label) => (
            <div key={label} className={styles.cellTh}>
              {label}
            </div>
          ))}
        </div>

        {showEmpty ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No hay pasajeros para mostrar.</div>
            <div className={styles.emptySub}>
              Probá cambiar la agencia o limpiar la búsqueda.
            </div>
          </div>
        ) : isLoading ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Cargando pasajeros…</div>
          </div>
        ) : isError ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No se pudieron cargar los pasajeros.</div>
            <div className={styles.emptySub}>
              {error instanceof Error ? error.message : "Reintentá en unos segundos."}
            </div>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualItems.map((vi) => {
              const p = rows[vi.index];
              const { firstName, lastName } = splitName(p.nombre);
              return (
                <div
                  key={p.id}
                  className={styles.rowGrid}
                  style={{
                    height: vi.size,
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <div className={styles.cell}>{firstName || "—"}</div>
                  <div className={styles.cell}>{lastName || <span className={styles.dim}>—</span>}</div>
                  <div className={cx(styles.cell, styles.tdMono)}>{p.telefono || "—"}</div>
                  <div className={styles.cell}>
                    {p.email || <span className={styles.dim}>—</span>}
                  </div>
                  <div className={styles.cell}>
                    {agencyName.get(p.agencia) ?? <span className={styles.dim}>—</span>}
                  </div>
                  <div className={cx(styles.cell, styles.tdTnum)}>{fmtDate(p.fecha_creacion)}</div>
                </div>
              );
            })}
          </div>
        )}

        {isFetchingNextPage && (
          <div className={styles.loadingMore}>Cargando más…</div>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.count}>
          <span className={styles.countNum}>{rows.length}</span>
          {total > rows.length ? ` de ${total}` : ""} pasajeros
        </div>
      </div>
    </div>
  );
}

function splitName(nombre: string): { firstName: string; lastName: string } {
  const parts = nombre.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function fmtDate(s: string) {
  if (!s) return "—";
  const date = s.slice(0, 10);
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y.slice(2)}`;
}
