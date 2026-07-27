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
import type { Cliente, TarifaCliente, TarifaClienteInput } from "../../types/tarifas";
import styles from "./Tarifas.module.css";

const CAT_NOMBRE = new Map(VEHICLE_CATEGORIAS.map((c) => [c.codigo, c.nombre]));

const emptyDraft = (clienteId: string): TarifaClienteInput => ({
  clienteId,
  origen: "",
  destino: "",
  categoria: VEHICLE_CATEGORIAS[0]?.codigo ?? "",
  tarifa: 0,
  activo: true,
});

export function TarifasClienteBase({ me }: { me: UseMe }) {
  const { flash } = useToast();
  const qc = useQueryClient();
  const { isAdmin, isAgency } = me;
  // El caché de react-query sobrevive al logout: atamos las queries al usuario
  // para no mostrar (ni por un instante) el tarifario de la sesión anterior.
  const userKey = me.me?.username ?? null;
  // Solo el admin edita el tarifario de clientes; la agencia lo consulta.
  const canEdit = isAdmin;
  // La agencia ve solo su propio tarifario (el filtro lo aplica la API): la
  // columna "Cliente" sobra. Para el admin es la que distingue una fila de otra.
  const showDueno = !isAgency;

  const [origenFilter, setOrigenFilter] = useState("");
  const [destinoFilter, setDestinoFilter] = useState("");
  const [duenoFilter, setDuenoFilter] = useState("");
  const [editing, setEditing] = useState<TarifaCliente | null>(null);
  const [draft, setDraft] = useState<TarifaClienteInput | null>(null);
  const [toDelete, setToDelete] = useState<TarifaCliente | null>(null);

  const { data: tarifas = [], isLoading } = useQuery({
    queryKey: ["tarifasCliente", userKey],
    queryFn: () => api.listTarifasCliente(),
  });
  const { data: lugares = [] } = useQuery({
    queryKey: ["tarifaLugares"],
    queryFn: () => api.listTarifaLugares(),
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes", userKey],
    queryFn: () => api.listClientes(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarifasCliente"] });

  const saveMut = useMutation({
    mutationFn: (input: { draft: TarifaClienteInput; id?: string }) =>
      input.id
        ? api.updateTarifaCliente({ ...input.draft, id: input.id })
        : api.createTarifaCliente(input.draft),
    onSuccess: (_r, vars) => {
      invalidate();
      flash(vars.id ? "Tarifa actualizada" : "Tarifa creada", "success");
      closeModal();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "No se pudo guardar", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteTarifaCliente(id),
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
          (!duenoFilter || t.clienteId === duenoFilter),
      ),
    [tarifas, origenFilter, destinoFilter, duenoFilter],
  );

  const openNew = () => {
    setEditing(null);
    // Si el admin está filtrando por un cliente, la nueva tarifa arranca con ese.
    setDraft(emptyDraft(duenoFilter));
  };
  const openEdit = (t: TarifaCliente) => {
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
    ...(showDueno ? ["minmax(120px, 1.4fr)"] : []), // cliente dueño
    "minmax(80px, 1fr)", // origen
    "minmax(80px, 1fr)", // destino
    "minmax(110px, 1.2fr)", // categoría
    "minmax(90px, 0.9fr)", // tarifa
    "88px", // estado
    ...(canEdit ? ["96px"] : []),
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
          <Field label="Cliente" className={styles.filterField}>
            <Select value={duenoFilter} onChange={(e) => setDuenoFilter(e.target.value)}>
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
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
          {showDueno && <div className={styles.th}>Cliente</div>}
          <div className={styles.th}>Origen</div>
          <div className={styles.th}>Destino</div>
          <div className={styles.th}>Categoría</div>
          <div className={cx(styles.th, styles.num)}>Cliente</div>
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
              {showDueno && <div className={styles.td}>{t.clienteId}</div>}
              <div className={styles.td}>{t.origen}</div>
              <div className={styles.td}>{t.destino}</div>
              <div className={styles.td}>{CAT_NOMBRE.get(t.categoria) ?? t.categoria}</div>
              <div className={cx(styles.td, styles.num)}>u$s {t.tarifa}</div>
              <div className={styles.td}>
                <span className={cx(styles.badge, t.activo ? styles.badgeOn : styles.badgeOff)}>
                  {t.activo ? "Activa" : "Inactiva"}
                </span>
              </div>
              {canEdit && (
                <div className={styles.tdActions}>
                  <button className={styles.iconBtn} title="Editar" onClick={() => openEdit(t)}>
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
        <TarifaClienteModal
          draft={draft}
          setDraft={setDraft}
          lugares={lugares}
          clientes={clientes}
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
            {CAT_NOMBRE.get(toDelete.categoria) ?? toDelete.categoria}) de {toDelete.clienteId}.
            Esta acción no se puede deshacer.
          </div>
        </Modal>
      )}
    </>
  );
}

function TarifaClienteModal({
  draft,
  setDraft,
  lugares,
  clientes,
  saving,
  title,
  onClose,
  onSave,
}: {
  draft: TarifaClienteInput;
  setDraft: (d: TarifaClienteInput) => void;
  lugares: string[];
  clientes: Cliente[];
  saving: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<TarifaClienteInput>) => setDraft({ ...draft, ...patch });
  const valid =
    !!draft.clienteId &&
    !!draft.origen &&
    !!draft.destino &&
    draft.origen !== draft.destino &&
    !!draft.categoria &&
    draft.tarifa > 0;

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
        <Field label="Cliente" required span={2}>
          <Select value={draft.clienteId} onChange={(e) => set({ clienteId: e.target.value })}>
            <option value="">—</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </Field>
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
            {VEHICLE_CATEGORIAS.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre} · {c.vehiculo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tarifa cliente (u$s)" required>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.tarifa || ""}
            onChange={(e) => set({ tarifa: Number(e.target.value) })}
          />
        </Field>
        <Field label="Estado">
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
