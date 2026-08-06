import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Field";
import { useToast } from "../../context/ToastContext";
import type { UseMe } from "../../hooks/useMe";
import type { TarifaExtras } from "../../types/tarifas";
import styles from "./Tarifas.module.css";

// Los montos del set (todo menos el dueño): las claves editables del form.
type MontoKey = Exclude<keyof TarifaExtras, "proveedorId">;

// Cada fila del form: una unidad (espera/hora/km) con su valor proveedor y cliente.
interface ExtraRow {
  label: string;
  unit: string;
  provKey: MontoKey;
  cliKey: MontoKey;
}

const ROWS: ExtraRow[] = [
  { label: "Espera", unit: "u$s por minuto", provKey: "esperaProveedor", cliKey: "esperaCliente" },
  {
    label: "Hora de disponibilidad",
    unit: "u$s por hora",
    provKey: "horaDispoProveedor",
    cliKey: "horaDispoCliente",
  },
  { label: "Km adicional", unit: "u$s por km", provKey: "kmProveedor", cliKey: "kmCliente" },
];

export function TarifasExtras({ me }: { me: UseMe }) {
  const { flash } = useToast();
  const qc = useQueryClient();
  const { isAdmin, isProvider, isAgency, proveedorId } = me;
  const showCliente = !isProvider; // el proveedor no ve el costo al cliente
  const showProveedor = !isAgency;

  // Hay un set de extras POR PROVEEDOR: el proveedor edita el suyo y no puede
  // cambiar de dueño; admin/agencia eligen a cuál mirar.
  const { data: proveedores = [] } = useQuery({
    queryKey: ["proveedores"],
    queryFn: () => api.listProveedores(),
  });
  const [elegido, setElegido] = useState("");
  const target = proveedorId ?? (elegido || proveedores[0]?.id) ?? "";
  // Solo el admin edita extras ajenos; el proveedor, únicamente los suyos.
  const canEdit = isProvider ? target === proveedorId : isAdmin;

  const { data } = useQuery({
    queryKey: ["tarifasExtras", target],
    queryFn: () => api.getTarifasExtras(target),
    enabled: !!target,
  });
  const [form, setForm] = useState<TarifaExtras | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (patch: Partial<TarifaExtras>) => api.updateTarifasExtras(patch, target),
    onSuccess: (saved) => {
      qc.setQueryData(["tarifasExtras", target], saved);
      setForm(saved);
      flash("Extras actualizados", "success");
    },
    onError: (e) => flash(e instanceof Error ? e.message : "No se pudo guardar", "error"),
  });

  if (!target) return <div className={styles.empty}>No hay proveedores cargados.</div>;
  if (!form || form.proveedorId !== target) {
    return <div className={styles.empty}>Cargando extras…</div>;
  }

  const set = (key: MontoKey, value: number) => setForm((f) => (f ? { ...f, [key]: value } : f));

  // Se manda SOLO lo que este usuario puede editar: así un proveedor nunca toca
  // los valores cliente (que ni ve) y el PATCH deja lo demás como estaba.
  const patchEditable = (f: TarifaExtras): Partial<TarifaExtras> => {
    const patch: Partial<TarifaExtras> = { proveedorId: f.proveedorId };
    for (const r of ROWS) {
      if (showProveedor && canEdit) patch[r.provKey] = f[r.provKey];
      if (showCliente && isAdmin) patch[r.cliKey] = f[r.cliKey];
    }
    return patch;
  };

  return (
    <div className={styles.formCard}>

      {!isProvider && (
        <Field label="Proveedor" style={{ marginBottom: 14 }}>
          <Select value={target} onChange={(e) => setElegido(e.target.value)}>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <p className={styles.hint} style={{ marginBottom: 12 }}>
        Cada proveedor tiene un único set de extras. {showProveedor && showCliente
          ? "Definí el valor que cobra el proveedor y el que se factura al cliente."
          : showProveedor
            ? "Definí el valor que cobra el proveedor."
            : "Valores facturados al cliente."}
      </p>

      {ROWS.map((r) => (
        <div key={r.label} className={styles.extrasGroup}>
          <div>
            <div className={styles.extrasLabel}>{r.label}</div>
            <div className={styles.extrasUnit}>{r.unit}</div>
          </div>
          {showProveedor && (
            <Field label="Proveedor">
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={!canEdit}
                value={form[r.provKey] || ""}
                onChange={(e) => set(r.provKey, Number(e.target.value))}
              />
            </Field>
          )}
          {showCliente && (
            <Field label="Cliente">
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={!isAdmin}
                value={form[r.cliKey] || ""}
                onChange={(e) => set(r.cliKey, Number(e.target.value))}
              />
            </Field>
          )}
        </div>
      ))}

      {canEdit && (
        <div className={styles.formActions}>
          <Button
            kind="primary"
            icon="check"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate(patchEditable(form))}
          >
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  );
}
