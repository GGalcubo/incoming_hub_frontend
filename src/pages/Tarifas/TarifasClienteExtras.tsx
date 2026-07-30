import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Field";
import { useToast } from "../../context/ToastContext";
import type { UseMe } from "../../hooks/useMe";
import { cx } from "../../lib/cx";
import type { TarifaClienteExtras as Extras } from "../../types/tarifas";
import { AvisoMock } from "./AvisoMock";
import styles from "./Tarifas.module.css";

// Cada fila del form: una unidad (espera/hora/km) con el valor facturado al
// cliente. Es el espejo de los extras de proveedor, con una sola columna: acá no
// existe el costo del proveedor.
type MontoKey = Exclude<keyof Extras, "clienteId">;

interface ExtraRow {
  label: string;
  unit: string;
  key: MontoKey;
}

const ROWS: ExtraRow[] = [
  { label: "Espera", unit: "u$s por minuto", key: "espera" },
  { label: "Hora de disponibilidad", unit: "u$s por hora", key: "horaDispo" },
  { label: "Km adicional", unit: "u$s por km", key: "km" },
];

export function TarifasClienteExtras({ me }: { me: UseMe }) {
  const { flash } = useToast();
  const qc = useQueryClient();
  const { isAdmin } = me;
  // El caché de react-query sobrevive al logout: atamos las queries al usuario
  // para no arrastrar el scope ni los extras de la sesión anterior.
  const userKey = me.me?.username ?? null;

  // Hay un set de extras POR CLIENTE: la agencia ve el suyo (lo fija el scope de
  // la API) y el admin elige a cuál mirar.
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes", userKey],
    queryFn: () => api.listClientes(),
  });
  const { data: scope, isLoading: scopeLoading } = useQuery({
    queryKey: ["clienteScope", userKey],
    queryFn: () => api.clienteScope(),
  });

  const [elegido, setElegido] = useState("");
  // scope === null → admin (puede elegir); un string → su propia agencia.
  const target = scope === null ? elegido || (clientes[0]?.id ?? "") : (scope ?? "");
  const canEdit = isAdmin;

  const { data } = useQuery({
    queryKey: ["tarifasClienteExtras", target],
    queryFn: () => api.getTarifasClienteExtras(target),
    enabled: !!target,
  });
  const [form, setForm] = useState<Extras | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (patch: Partial<Extras>) => api.updateTarifasClienteExtras(patch, target),
    onSuccess: (saved) => {
      qc.setQueryData(["tarifasClienteExtras", target], saved);
      setForm(saved);
      flash("Extras actualizados", "success");
    },
    onError: (e) => flash(e instanceof Error ? e.message : "No se pudo guardar", "error"),
  });

  if (scopeLoading) return <div className={styles.empty}>Cargando extras…</div>;
  if (!target) {
    return (
      <div className={styles.empty}>
        {scope === null
          ? "No hay clientes cargados."
          : "No pudimos determinar tu agencia: pedile al administrador que la asocie a tu usuario."}
      </div>
    );
  }
  if (!form || form.clienteId !== target) {
    return <div className={styles.empty}>Cargando extras…</div>;
  }

  const set = (key: MontoKey, value: number) => setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <div className={styles.formCard}>
      <AvisoMock>
        Los extras todavía no existen en el backend: lo que cargues acá se guarda solo en este
        navegador y no lo ve el resto del equipo.
      </AvisoMock>

      {scope === null && (
        <Field label="Cliente" style={{ marginBottom: 14 }}>
          <Select value={target} onChange={(e) => setElegido(e.target.value)}>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <p className={styles.hint} style={{ marginBottom: 12 }}>
        Cada cliente tiene un único set de extras.{" "}
        {canEdit ? "Definí el valor que se le factura." : "Valores facturados a tu agencia."}
      </p>

      {ROWS.map((r) => (
        <div key={r.label} className={cx(styles.extrasGroup, styles.extrasGroupSingle)}>
          <div>
            <div className={styles.extrasLabel}>{r.label}</div>
            <div className={styles.extrasUnit}>{r.unit}</div>
          </div>
          <Field label="Cliente">
            <Input
              type="number"
              min={0}
              step="0.01"
              disabled={!canEdit}
              value={form[r.key] || ""}
              onChange={(e) => set(r.key, Number(e.target.value))}
            />
          </Field>
        </div>
      ))}

      {canEdit && (
        <div className={styles.formActions}>
          <Button
            kind="primary"
            icon="check"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate(form)}
          >
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  );
}
