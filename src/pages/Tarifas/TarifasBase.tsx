// Tarifario base PIVOTEADO: una fila por ruta (origen → destino) y una columna
// por categoría de vehículo. Cada celda muestra el precio al cliente y, debajo y
// en gris, el costo del proveedor — lo que cada rol puede ver manda:
//   admin     → los dos valores, y edita
//   proveedor → solo su costo (nunca el precio al cliente), y lo edita
//   agencia   → solo el precio al cliente, sin edición
// No hay columna "Estado": las tarifas se crean activas y el estado guardado se
// respeta (una fila inactiva se ve atenuada), pero no se edita desde acá.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import { VEHICLE_CATEGORIAS } from "../../data/tarifasSeed";
import type { UseMe } from "../../hooks/useMe";
import { cx } from "../../lib/cx";
import type { Proveedor, TarifaBase, TarifaBaseInput } from "../../types/tarifas";
import styles from "./Tarifas.module.css";

// Categorías en el orden en que se muestran las columnas.
const CATEGORIAS = [...VEHICLE_CATEGORIAS].sort((a, b) => a.orden - b.orden);

// Una fila de la tabla: la ruta y sus tarifas indexadas por categoría.
interface RutaRow {
  key: string;
  proveedorId: string;
  origen: string;
  destino: string;
  celdas: Record<string, TarifaBase | undefined>;
}

// Los montos del formulario van como string para poder dejar una categoría
// vacía (= esa ruta no se ofrece en ese vehículo).
interface CeldaDraft {
  tarifaProveedor: string;
  tarifaCliente: string;
}

interface RutaDraft {
  proveedorId: string;
  origen: string;
  destino: string;
  celdas: Record<string, CeldaDraft>;
}

const emptyCeldas = (): Record<string, CeldaDraft> =>
  Object.fromEntries(
    CATEGORIAS.map((c) => [c.codigo, { tarifaProveedor: "", tarifaCliente: "" }]),
  );

const emptyDraft = (proveedorId: string): RutaDraft => ({
  proveedorId,
  origen: "",
  destino: "",
  celdas: emptyCeldas(),
});

// Draft cargado con lo que ya existe para esa ruta. Un monto en 0 es "sin
// cargar" (p. ej. una tarifa creada por el proveedor, que no fija el cliente).
const draftFromRow = (row: RutaRow): RutaDraft => ({
  proveedorId: row.proveedorId,
  origen: row.origen,
  destino: row.destino,
  celdas: Object.fromEntries(
    CATEGORIAS.map((c) => {
      const t = row.celdas[c.codigo];
      return [
        c.codigo,
        {
          tarifaProveedor: t && t.tarifaProveedor > 0 ? String(t.tarifaProveedor) : "",
          tarifaCliente: t && t.tarifaCliente > 0 ? String(t.tarifaCliente) : "",
        },
      ];
    }),
  ),
});

const monto = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export function TarifasBase({ me }: { me: UseMe }) {
  const { flash } = useToast();
  const qc = useQueryClient();
  const { isAdmin, isProvider, isAgency, proveedorId } = me;
  // Proveedor y admin editan; el cliente (agencia) solo consulta.
  const canEdit = isAdmin || isProvider;
  // "Los proveedores no deben ver el costo final al cliente".
  const showCliente = !isProvider;
  // "Agencia: no puede editar ni ver proveedores".
  const showProveedor = !isAgency;
  // El proveedor ve solo su tarifario (el filtro lo aplica la API): la columna
  // "Proveedor" sobra. Para admin/agencia es la que distingue una fila de otra.
  const showDueno = !isProvider;

  const [origenFilter, setOrigenFilter] = useState("");
  const [destinoFilter, setDestinoFilter] = useState("");
  const [duenoFilter, setDuenoFilter] = useState("");
  const [editing, setEditing] = useState<RutaRow | null>(null);
  const [draft, setDraft] = useState<RutaDraft | null>(null);
  const [toDelete, setToDelete] = useState<RutaRow | null>(null);

  const { data: tarifas = [], isLoading } = useQuery({
    queryKey: ["tarifasBase", proveedorId],
    queryFn: () => api.listTarifasBase(),
  });
  const { data: lugares = [] } = useQuery({
    queryKey: ["tarifaLugares"],
    queryFn: () => api.listTarifaLugares(),
  });
  const { data: proveedores = [] } = useQuery({
    queryKey: ["proveedores"],
    queryFn: () => api.listProveedores(),
  });
  const nombreDe = (id: string) => proveedores.find((p) => p.id === id)?.nombre ?? id;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarifasBase"] });
  // El proveedor logueado no elige dueño: la API fuerza el suyo igual.
  const draftOwner = proveedorId ?? "";

  // Pivot: agrupa las tarifas base por (dueño, origen, destino) y cuelga cada
  // una en la columna de su categoría.
  const rows = useMemo(() => {
    const map = new Map<string, RutaRow>();
    for (const t of tarifas) {
      if (origenFilter && t.origen !== origenFilter) continue;
      if (destinoFilter && t.destino !== destinoFilter) continue;
      if (duenoFilter && t.proveedorId !== duenoFilter) continue;
      const key = `${t.proveedorId}|${t.origen}|${t.destino}`;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          proveedorId: t.proveedorId,
          origen: t.origen,
          destino: t.destino,
          celdas: {},
        };
        map.set(key, row);
      }
      row.celdas[t.categoria] = t;
    }
    return [...map.values()].sort(
      (a, b) =>
        a.proveedorId.localeCompare(b.proveedorId) ||
        a.origen.localeCompare(b.origen) ||
        a.destino.localeCompare(b.destino),
    );
  }, [tarifas, origenFilter, destinoFilter, duenoFilter]);

  // Guardar una ruta = un alta/edición/baja por categoría. El orden importa:
  // primero las bajas y ediciones, después las altas, para que el chequeo de
  // duplicados de la API no choque contra una tarifa que se está por liberar.
  const saveMut = useMutation({
    mutationFn: async ({ draft: d, original }: { draft: RutaDraft; original: RutaRow | null }) => {
      const dueno = draftOwner || d.proveedorId;
      const bajas: (() => Promise<unknown>)[] = [];
      const ediciones: (() => Promise<unknown>)[] = [];
      const altas: (() => Promise<unknown>)[] = [];

      for (const c of CATEGORIAS) {
        const celda = d.celdas[c.codigo];
        const previa = original?.celdas[c.codigo];
        const prov = monto(celda.tarifaProveedor);
        const cli = monto(celda.tarifaCliente);
        const cargada = (showProveedor && prov > 0) || (showCliente && cli > 0);

        if (!cargada) {
          // Se vació la categoría: se borra la tarifa que hubiera.
          if (previa) bajas.push(() => api.deleteTarifaBase(previa.id));
          continue;
        }
        // Los montos que el rol no ve nunca se tocan (los conserva la API).
        const input: TarifaBaseInput = {
          proveedorId: dueno,
          origen: d.origen,
          destino: d.destino,
          categoria: c.codigo,
          tarifaProveedor: showProveedor ? prov : (previa?.tarifaProveedor ?? 0),
          tarifaCliente: showCliente ? cli : (previa?.tarifaCliente ?? 0),
          activo: previa?.activo ?? true,
        };
        if (previa) {
          ediciones.push(() => api.updateTarifaBase({ ...input, id: previa.id }));
        } else {
          altas.push(() => api.createTarifaBase(input));
        }
      }

      if (bajas.length + ediciones.length + altas.length === 0) return;
      for (const op of [...bajas, ...ediciones, ...altas]) await op();
    },
    onSuccess: (_r, vars) => {
      invalidate();
      flash(vars.original ? "Tarifas actualizadas" : "Ruta creada", "success");
      closeModal();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "No se pudo guardar", "error"),
  });

  // Borrar una ruta borra sus tarifas (una por categoría cargada).
  const deleteMut = useMutation({
    mutationFn: async (row: RutaRow) => {
      for (const t of Object.values(row.celdas)) {
        if (t) await api.deleteTarifaBase(t.id);
      }
    },
    onSuccess: () => {
      invalidate();
      flash("Tarifas eliminadas", "success");
      setToDelete(null);
    },
    onError: (e) => flash(e instanceof Error ? e.message : "No se pudo eliminar", "error"),
  });

  const openNew = () => {
    setEditing(null);
    // Si el admin está filtrando por un proveedor, la ruta nueva arranca con ese.
    setDraft(emptyDraft(draftOwner || duenoFilter));
  };
  const openEdit = (row: RutaRow) => {
    setEditing(row);
    setDraft(draftFromRow(row));
  };
  const closeModal = () => {
    setDraft(null);
    setEditing(null);
  };

  // Columnas dinámicas según lo que el rol puede ver.
  const cols = [
    ...(showDueno ? ["minmax(120px, 1.2fr)"] : []), // proveedor dueño
    "minmax(72px, 0.8fr)", // origen
    "minmax(72px, 0.8fr)", // destino
    ...CATEGORIAS.map(() => "minmax(92px, 1fr)"),
    ...(canEdit ? ["84px"] : []),
  ].join(" ");

  return (
    <>
      <div className={styles.toolbar}>
        <Field label="Origen" className={styles.filterField}>
          <Select value={origenFilter} onChange={(e) => setOrigenFilter(e.target.value)}>
            <option value="">Todos</option>
            {lugares.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Destino" className={styles.filterField}>
          <Select value={destinoFilter} onChange={(e) => setDestinoFilter(e.target.value)}>
            <option value="">Todos</option>
            {lugares.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        {showDueno && (
          <Field label="Proveedor" className={styles.filterField}>
            <Select value={duenoFilter} onChange={(e) => setDuenoFilter(e.target.value)}>
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className={styles.spacer} />
        {canEdit && (
          <Button kind="primary" icon="plus" onClick={openNew}>
            Nueva ruta
          </Button>
        )}
      </div>

      {showCliente && showProveedor && (
        <div className={styles.hint}>
          En cada categoría: precio al cliente y, debajo, el costo del proveedor.
        </div>
      )}

      <div className={styles.tableWrap}>
        <div className={styles.headRow} style={{ gridTemplateColumns: cols }}>
          {showDueno && <div className={styles.th}>Proveedor</div>}
          <div className={styles.th}>Origen</div>
          <div className={styles.th}>Destino</div>
          {CATEGORIAS.map((c) => (
            <div key={c.codigo} className={cx(styles.th, styles.num)} title={c.vehiculo}>
              {c.nombre}
            </div>
          ))}
          {canEdit && <div className={cx(styles.th, styles.num)}>Acciones</div>}
        </div>

        {isLoading ? (
          <div className={styles.empty}>Cargando tarifas…</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>No hay tarifas para el filtro seleccionado.</div>
        ) : (
          rows.map((row) => (
            <div key={row.key} className={styles.row} style={{ gridTemplateColumns: cols }}>
              {showDueno && <div className={styles.td}>{nombreDe(row.proveedorId)}</div>}
              <div className={styles.td}>{row.origen}</div>
              <div className={styles.td}>{row.destino}</div>
              {CATEGORIAS.map((c) => (
                <Celda
                  key={c.codigo}
                  tarifa={row.celdas[c.codigo]}
                  showCliente={showCliente}
                  showProveedor={showProveedor}
                />
              ))}
              {canEdit && (
                <div className={styles.tdActions}>
                  <button
                    className={styles.iconBtn}
                    title="Editar tarifas de la ruta"
                    onClick={() => openEdit(row)}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <button
                    className={cx(styles.iconBtn, styles.iconBtnDanger)}
                    title="Eliminar ruta"
                    onClick={() => setToDelete(row)}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {draft && (
        <RutaModal
          draft={draft}
          setDraft={setDraft}
          lugares={lugares}
          proveedores={proveedores}
          showDueno={showDueno}
          showCliente={showCliente}
          showProveedor={showProveedor}
          saving={saveMut.isPending}
          editing={!!editing}
          onClose={closeModal}
          onSave={() => saveMut.mutate({ draft, original: editing })}
        />
      )}

      {toDelete && (
        <Modal
          open
          onClose={() => setToDelete(null)}
          title="Eliminar tarifas de la ruta"
          width={440}
          footer={
            <>
              <Button onClick={() => setToDelete(null)}>Cancelar</Button>
              <Button
                kind="dangerSolid"
                icon="trash"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(toDelete)}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <div className={styles.hint}>
            Se eliminarán las {Object.values(toDelete.celdas).filter(Boolean).length} tarifas de{" "}
            {toDelete.origen} → {toDelete.destino}. Esta acción no se puede deshacer.
          </div>
        </Modal>
      )}
    </>
  );
}

// Celda de categoría: el valor que manda para el rol arriba y, si el rol ve los
// dos, el costo del proveedor abajo en gris.
function Celda({
  tarifa,
  showCliente,
  showProveedor,
}: {
  tarifa: TarifaBase | undefined;
  showCliente: boolean;
  showProveedor: boolean;
}) {
  if (!tarifa) return <div className={cx(styles.cell, styles.cellVacia)}>—</div>;
  const cli = tarifa.tarifaCliente > 0 ? `u$s ${tarifa.tarifaCliente}` : "—";
  const prov = tarifa.tarifaProveedor > 0 ? `u$s ${tarifa.tarifaProveedor}` : "—";
  return (
    <div className={cx(styles.cell, !tarifa.activo && styles.cellInactiva)}>
      <span className={styles.cellMain}>{showCliente ? cli : prov}</span>
      {showCliente && showProveedor && <span className={styles.cellSub}>prov {prov}</span>}
    </div>
  );
}

function RutaModal({
  draft,
  setDraft,
  lugares,
  proveedores,
  showDueno,
  showCliente,
  showProveedor,
  saving,
  editing,
  onClose,
  onSave,
}: {
  draft: RutaDraft;
  setDraft: (d: RutaDraft) => void;
  lugares: string[];
  proveedores: Proveedor[];
  showDueno: boolean;
  showCliente: boolean;
  showProveedor: boolean;
  saving: boolean;
  editing: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<RutaDraft>) => setDraft({ ...draft, ...patch });
  const setCelda = (codigo: string, patch: Partial<CeldaDraft>) =>
    setDraft({
      ...draft,
      celdas: { ...draft.celdas, [codigo]: { ...draft.celdas[codigo], ...patch } },
    });

  // Una categoría cuenta como cargada si tiene alguno de los montos visibles, y
  // como completa si los tiene todos: vacía se ignora (o se borra), a medias no
  // se puede guardar.
  const cargada = (c: CeldaDraft) =>
    (showProveedor && monto(c.tarifaProveedor) > 0) || (showCliente && monto(c.tarifaCliente) > 0);
  const completa = (c: CeldaDraft) =>
    (!showProveedor || monto(c.tarifaProveedor) > 0) &&
    (!showCliente || monto(c.tarifaCliente) > 0);

  const celdas = CATEGORIAS.map((c) => draft.celdas[c.codigo]);
  const algunaCargada = celdas.some(cargada);
  const todasCompletas = celdas.every((c) => !cargada(c) || completa(c));
  const rutaOk =
    !!draft.proveedorId && !!draft.origen && !!draft.destino && draft.origen !== draft.destino;
  // Al editar se admite dejar todo vacío: equivale a borrar la ruta.
  const valid = rutaOk && todasCompletas && (editing || algunaCargada);

  const montoCols = [
    "minmax(120px, 1.4fr)",
    ...(showCliente ? ["1fr"] : []),
    ...(showProveedor ? ["1fr"] : []),
  ].join(" ");

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Editar tarifas de la ruta" : "Nueva ruta"}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button kind="primary" icon="check" disabled={!valid || saving} onClick={onSave}>
            Guardar
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
        {showDueno && (
          <Field label="Proveedor" required span={2}>
            <Select
              value={draft.proveedorId}
              onChange={(e) => set({ proveedorId: e.target.value })}
            >
              <option value="">—</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Origen" required>
          <Select value={draft.origen} onChange={(e) => set({ origen: e.target.value })}>
            <option value="">—</option>
            {lugares.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Destino"
          required
          error={
            draft.origen && draft.origen === draft.destino
              ? "Origen y destino no pueden coincidir."
              : undefined
          }
        >
          <Select value={draft.destino} onChange={(e) => set({ destino: e.target.value })}>
            <option value="">—</option>
            {lugares.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className={styles.catHead} style={{ gridTemplateColumns: montoCols }}>
        <div className={styles.th}>Categoría</div>
        {showCliente && <div className={styles.th}>Cliente (u$s)</div>}
        {showProveedor && <div className={styles.th}>Proveedor (u$s)</div>}
      </div>
      {CATEGORIAS.map((c) => {
        const celda = draft.celdas[c.codigo];
        const incompleta = cargada(celda) && !completa(celda);
        return (
          <div key={c.codigo} className={styles.catRow} style={{ gridTemplateColumns: montoCols }}>
            <div>
              <div className={styles.catName}>{c.nombre}</div>
              <div className={styles.catVeh}>{c.vehiculo}</div>
            </div>
            {showCliente && (
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="—"
                aria-label={`Tarifa cliente ${c.nombre}`}
                aria-invalid={incompleta && !monto(celda.tarifaCliente)}
                value={celda.tarifaCliente}
                onChange={(e) => setCelda(c.codigo, { tarifaCliente: e.target.value })}
              />
            )}
            {showProveedor && (
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="—"
                aria-label={`Tarifa proveedor ${c.nombre}`}
                aria-invalid={incompleta && !monto(celda.tarifaProveedor)}
                value={celda.tarifaProveedor}
                onChange={(e) => setCelda(c.codigo, { tarifaProveedor: e.target.value })}
              />
            )}
          </div>
        );
      })}
      <div className={styles.hint}>
        Dejá una categoría vacía si esa ruta no se ofrece con ese vehículo.
        {!todasCompletas && " Completá los montos de las categorías que cargaste."}
      </div>
    </Modal>
  );
}
