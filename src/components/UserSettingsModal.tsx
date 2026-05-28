import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { MeProfile, RoleEnum } from "../api/backend";
import type { User } from "../types/domain";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Field";
import { Modal } from "./ui/Modal";
import styles from "./UserSettingsModal.module.css";

interface UserSettingsModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSave: () => void;
}

const ROLE_LABELS: Record<RoleEnum, string> = {
  admin: "Administrador",
  agency_staff: "Staff de agencia",
  agency_operator: "Operador de agencia",
};

interface FormState {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
}

const EMPTY_FORM: FormState = { first_name: "", last_name: "", username: "", email: "" };

export function UserSettingsModal({ open, user, onClose, onSave }: UserSettingsModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [role, setRole] = useState<RoleEnum | null>(null);
  // Cambio de contraseña: el backend no expone endpoint, son campos mockup.
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPass("");
    setPassConfirm("");
    setForm((f) => ({ ...EMPTY_FORM, username: user?.user ?? f.username }));
    setLoading(true);
    api
      .getMe()
      .then((me: MeProfile) => {
        setForm({
          first_name: me.first_name ?? "",
          last_name: me.last_name ?? "",
          username: me.username ?? "",
          email: me.email ?? "",
        });
        setRole(me.role);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar el perfil"))
      .finally(() => setLoading(false));
  }, [open, user]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (pass && pass !== passConfirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateMe({
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
        email: form.email,
      });
      onSave();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = role ? ROLE_LABELS[role] : "—";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings de usuario"
      width={480}
      footer={
        <>
          <Button kind="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button kind="primary" icon="check" onClick={handleSave} disabled={loading || saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className={styles.grid}>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.row}>
          <Field label="Nombre">
            <Input
              value={form.first_name}
              onChange={set("first_name")}
              placeholder="Nombre"
              disabled={loading}
            />
          </Field>
          <Field label="Apellido">
            <Input
              value={form.last_name}
              onChange={set("last_name")}
              placeholder="Apellido"
              disabled={loading}
            />
          </Field>
        </div>
        <Field label="Usuario">
          <Input
            value={form.username}
            onChange={set("username")}
            placeholder="nombre.usuario"
            disabled={loading}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="tu@empresa.com"
            disabled={loading}
          />
        </Field>
        <Field label="Rol" hint="No editable. Lo asigna un administrador.">
          <Input value={roleLabel} disabled readOnly />
        </Field>

        <div className={styles.section}>Cambiar contraseña</div>
        <Field label="Nueva contraseña" hint="Próximamente — aún no disponible.">
          <Input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled
          />
        </Field>
        <Field label="Confirmar contraseña">
          <Input
            type="password"
            value={passConfirm}
            onChange={(e) => setPassConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled
          />
        </Field>
      </div>
    </Modal>
  );
}
