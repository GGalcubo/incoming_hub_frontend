import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { HAS_BACKEND } from "../../api/http";
import { AvisoMock } from "../../components/ui/AvisoMock";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import type { UseMe } from "../../hooks/useMe";
import { cx } from "../../lib/cx";
import type {
  Proveedor,
  TarifaBase,
  TarifaBaseInput,
  VehicleCategoria,
} from "../../types/tarifas";
import styles from "./Tarifas.module.css";

// Qué columna de precio mira la pantalla. Es la MISMA tarifa: el backend guarda
// una sola por (proveedor, ruta, categoría) con los dos precios adentro, así que
// "Tarifas Proveedor" muestra el costo y "Tarifas Cliente" el precio de venta.
export type LadoTarifa = "proveedor" | "cliente";

const emptyDraft = (proveedorId: string, categoria: string): TarifaBaseInput => ({
  proveedorId,
  origen: "",
  destino: "",
  categoria,
  tarifaProveedor: 0,
  tarifaCliente: 0,
  activo: true,
});

export function TarifasBase({ me, lado = "proveedor" }: { me: UseMe; lado?: LadoTarifa }) {
  const { flash } = useToast();
  const qc = useQueryClient();
  const { isAdmin, isProvider, isAgency, proveedorId } = me;
  // Proveedor y admin editan; el cliente (agencia) solo consulta.
  const canEdit = isAdmin || isProvider;
  // "Los proveedores no deben ver el costo final al cliente"; la agencia, a la
  // inversa, nunca ve el costo del proveedor. Sobre eso, cada pantalla recorta a
  // su columna: la de Cliente no muestra el costo aunque sea el admin.
  const showCliente = !isProvider;
  const showProveedor = !isAgency && lado === "proveedor";
  // El proveedor ve solo su tarifario (el filtro lo aplica el backend): la
  // columna "Proveedor" sobra. Para admin/agencia distingue una fila de otra.
  const showDueno = !isProvider;

  const [origenFilter, setOrigenFilter] = useState("");
  const [destinoFilter, setDestinoFilter] = useState("");
  const [duenoFilter, setDuenoFilter] = useState("");
  const [editing, setEditing] = useState<TarifaBase | null>(null);
  const [draft, setDraft] = useState<TarifaBaseInput | null>(null);
  const [toDelete, setToDelete] = useState<TarifaBase | null>(null);

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
  // Categorías de vehículo del catálogo del backend (no una lista fija del front:
  // el id de la categoría es parte de la tarifa).
  const { data: categorias = [] } = useQuery({
    queryKey: ["categoriasTarifa"],
    queryFn: () => api.listCategoriasTarifa(),
  });
  const nombreDe = (id: string) => proveedores.find((p) => p.id === id)?.nombre ?? id;
  const nombreCategoria = (codigo: string) =>
    categorias.find((c) => c.codigo === codigo)?.nombre ?? codigo;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarifasBase"] });
  // El proveedor logueado no elige dueño: la API fuerza el suyo igual.
  const draftOwner = proveedorId ?? "";

  const saveMut = useMutation({
    mutationFn: (input: { draft: TarifaBaseInput; id?: string }) =>
      input.id
        ? api.updateTarifaBase({ ...input.draft, id: input.id })
        : api.createTarifaBase(input.draft),
    onSuccess: (_r, vars) => {
      invalidate();
      flash(vars.id ? "Tarifa actualizada" : "Tarifa creada", "success");
      closeModal();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "No se pudo guardar", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteTarifaBase(id),
    onSuccess: () => {
      invalidate();
      flash("Tarifa eliminada", "success");
      setToDelete(null);
    },
    onError: (e) => flash(e instanceof Error ? e.message : "No se pudo eliminar", "error"),
  });

  const rows = useMemo(
    () =>
      tarifas.filter(
        (t) =>
          (!origenFilter || t.origen === origenFilter) &&
          (!destinoFilter || t.destino === destinoFilter) &&
          (!duenoFilter || t.proveedorId === duenoFilter),
      ),
    [tarifas, origenFilter, destinoFilter, duenoFilter],
  );

  const openNew = () => {
    setEditing(null);
    // Si el admin está filtrando por un proveedor, la nueva tarifa arranca con ese.
    setDraft(emptyDraft(draftOwner || duenoFilter, categorias[0]?.codigo ?? ""));
  };
  const openEdit = (t: TarifaBase) => {
    setEditing(t);
    const { id: _id, ...rest } = t;
    void _id;
    setDraft(rest);
  };
  const closeModal = () => {
    setDraft(null);
    setEditing(null);
  };

  // Columnas dinámicas según lo que el rol puede ver.
  const cols = [
    ...(showDueno ? ["minmax(120px, 1.2fr)"] : []), // proveedor dueño
    "minmax(80px, 1fr)", // origen
    "minmax(80px, 1fr)", // destino
    "minmax(110px, 1.2fr)", // categoría
    ...(showProveedor ? ["minmax(90px, 0.9fr)"] : []),
    ...(showCliente ? ["minmax(90px, 0.9fr)"] : []),
    "88px", // estado
    ...(canEdit ? ["96px"] : []),
  ].join(" ");

  return (
    <>
      {/* Con backend el tarifario es real (/tarifarios/tarifas/); sin él, el ABM
          entero vive en el localStorage de este navegador. */}
      {!HAS_BACKEND && (
        <AvisoMock>
          Sin backend configurado, el tarifario es de prueba: lo que cargues, edites o borres
          queda solo en este navegador.
        </AvisoMock>
      )}

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
            Nueva tarifa
          </Button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.headRow} style={{ gridTemplateColumns: cols }}>
          {showDueno && <div className={styles.th}>Proveedor</div>}
          <div className={styles.th}>Origen</div>
          <div className={styles.th}>Destino</div>
          <div className={styles.th}>Categoría</div>
          {showProveedor && <div className={cx(styles.th, styles.num)}>Proveedor</div>}
          {showCliente && <div className={cx(styles.th, styles.num)}>Cliente</div>}
          <div className={styles.th}>Estado</div>
          {canEdit && <div className={cx(styles.th, styles.num)}>Acciones</div>}
        </div>

        {isLoading ? (
          <div className={styles.empty}>Cargando tarifas…</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>No hay tarifas para el filtro seleccionado.</div>
        ) : (
          rows.map((t) => (
            <div
              key={t.id}
              className={cx(styles.row, !t.activo && styles.rowInactive)}
              style={{ gridTemplateColumns: cols }}
            >
              {showDueno && <div className={styles.td}>{nombreDe(t.proveedorId)}</div>}
              <div className={styles.td}>{t.origen}</div>
              <div className={styles.td}>{t.destino}</div>
              <div className={styles.td}>{nombreCategoria(t.categoria)}</div>
              {showProveedor && (
                <div className={cx(styles.td, styles.num)}>u$s {t.tarifaProveedor}</div>
              )}
              {showCliente && (
                <div className={cx(styles.td, styles.num)}>u$s {t.tarifaCliente}</div>
              )}
              <div className={styles.td}>
                <span className={cx(styles.badge, t.activo ? styles.badgeOn : styles.badgeOff)}>
                  {t.activo ? "Activa" : "Inactiva"}
                </span>
              </div>
              {canEdit && (
                <div className={styles.tdActions}>
                  <button
                    className={styles.iconBtn}
                    title="Editar"
                    onClick={() => openEdit(t)}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <button
                    className={cx(styles.iconBtn, styles.iconBtnDanger)}
                    title="Eliminar"
                    onClick={() => setToDelete(t)}
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
        <TarifaModal
          draft={draft}
          setDraft={setDraft}
          lugares={lugares}
          proveedores={proveedores}
          categorias={categorias}
          showDueno={showDueno}
          // En el formulario los precios se muestran por ROL, no por pantalla:
          // la tarifa es una sola y el backend pide el costo del proveedor
          // siempre, así que el admin carga las dos columnas también desde
          // "Tarifas Cliente".
          showCliente={!isProvider}
          showProveedor={!isAgency}
          saving={saveMut.isPending}
          title={editing ? "Editar tarifa" : "Nueva tarifa"}
          onClose={closeModal}
          onSave={() => saveMut.mutate({ draft, id: editing?.id })}
        />
      )}

      {toDelete && (
        <Modal
          open
          onClose={() => setToDelete(null)}
          title="Eliminar tarifa"
          width={440}
          footer={
            <>
              <Button onClick={() => setToDelete(null)}>Cancelar</Button>
              <Button
                kind="dangerSolid"
                icon="trash"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(toDelete.id)}
              >
                Eliminar
              </Button>
            </>
          }
        >
          <div className={styles.hint}>
            Se eliminará la tarifa {toDelete.origen} → {toDelete.destino} (
            {nombreCategoria(toDelete.categoria)}). Esta acción no se puede deshacer.
          </div>
        </Modal>
      )}
    </>
  );
}

function TarifaModal({
  draft,
  setDraft,
  lugares,
  proveedores,
  categorias,
  showDueno,
  showCliente,
  showProveedor,
  saving,
  title,
  onClose,
  onSave,
}: {
  draft: TarifaBaseInput;
  setDraft: (d: TarifaBaseInput) => void;
  lugares: string[];
  proveedores: Proveedor[];
  categorias: VehicleCategoria[];
  showDueno: boolean;
  showCliente: boolean;
  showProveedor: boolean;
  saving: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<TarifaBaseInput>) => setDraft({ ...draft, ...patch });
  const numOk = (v: number) => v > 0;
  const valid =
    !!draft.proveedorId &&
    !!draft.origen &&
    !!draft.destino &&
    draft.origen !== draft.destino &&
    !!draft.categoria &&
    (!showProveedor || numOk(draft.tarifaProveedor)) &&
    (!showCliente || numOk(draft.tarifaCliente));

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={520}
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
        <Field label="Categoría de vehículo" required span={2}>
          <Select value={draft.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            {categorias.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.vehiculo ? `${c.nombre} · ${c.vehiculo}` : c.nombre}
              </option>
            ))}
          </Select>
        </Field>
        {showProveedor && (
          <Field label="Tarifa proveedor (u$s)" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.tarifaProveedor || ""}
              onChange={(e) => set({ tarifaProveedor: Number(e.target.value) })}
            />
          </Field>
        )}
        {showCliente && (
          <Field label="Tarifa cliente (u$s)" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.tarifaCliente || ""}
              onChange={(e) => set({ tarifaCliente: Number(e.target.value) })}
            />
          </Field>
        )}
        <Field label="Estado" span={2}>
          <Select
            value={draft.activo ? "1" : "0"}
            onChange={(e) => set({ activo: e.target.value === "1" })}
          >
            <option value="1">Activa</option>
            <option value="0">Inactiva</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
