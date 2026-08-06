import { useEffect, useState } from "react";
import { api } from "../api/client";
import { PASSWORD_MIN_LEN, type MeProfile, type RoleEnum } from "../api/backend";
import { HAS_AUTH } from "../api/http";
import type { User } from "../types/domain";
import { AvisoMock } from "./ui/AvisoMock";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Field";
import { Modal } from "./ui/Modal";
import styles from "./UserSettingsModal.module.css";

interface UserSettingsModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  // El mensaje depende de qué se guardó (perfil, o perfil + contraseña).
  onSave: (mensaje: string) => void;
}

const ROLE_LABELS: Record<RoleEnum, string> = {
  admin: "Administrador",
  agency_staff: "Staff de agencia",
  agency_operator: "Operador de agencia",
  provider: "Proveedor",
};

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
}

const EMPTY_FORM: FormState = { first_name: "", last_name: "", email: "" };

export function UserSettingsModal({ open, user, onClose, onSave }: UserSettingsModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Datos de sistema (solo lectura): el backend no permite editarlos desde aquí.
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<RoleEnum | null>(null);
  // Cambio de contraseña: va por su propio endpoint (POST /auth/change-password/)
  // y pide la actual. Es opcional: si los tres campos quedan vacíos, Guardar solo
  // actualiza el perfil.
  const [passActual, setPassActual] = useState("");
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPassActual("");
    setPass("");
    setPassConfirm("");
    setForm(EMPTY_FORM);
    setUsername(user?.user ?? "");
    setLoading(true);
    api
      .getMe()
      .then((me: MeProfile) => {
        setForm({
          first_name: me.first_name ?? "",
          last_name: me.last_name ?? "",
          email: me.email ?? "",
        });
        setUsername(me.username ?? "");
        setRole(me.role);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar el perfil"))
      .finally(() => setLoading(false));
  }, [open, user]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // El cambio de contraseña es opcional: con los tres campos vacíos, Guardar solo
  // actualiza el perfil.
  const cambiaPass = !!(passActual || pass || passConfirm);

  const handleSave = async () => {
    if (cambiaPass) {
      if (!passActual) {
        setError("Ingresá tu contraseña actual.");
        return;
      }
      if (pass.length < PASSWORD_MIN_LEN) {
        setError(`La contraseña nueva necesita al menos ${PASSWORD_MIN_LEN} caracteres.`);
        return;
      }
      if (pass !== passConfirm) {
        setError("Las contraseñas no coinciden");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateMe({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
      });
      // La contraseña va después y en su propio endpoint: si falla (la actual no
      // es la que era), el perfil ya quedó guardado y el modal sigue abierto con
      // el error, así que se reintenta solo esa parte.
      if (cambiaPass) {
        await api.changePassword(passActual, pass);
        setPassActual("");
        setPass("");
        setPassConfirm("");
      }
      onSave(cambiaPass ? "Perfil y contraseña actualizados" : "Perfil actualizado");
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

        {/* Sin backend de auth el perfil no sale de /auth/me/: se arma con el
            username y lo editado se guarda en localStorage. */}
        {!HAS_AUTH && (
          <AvisoMock>
            No hay backend de usuarios: el perfil es de prueba y los cambios quedan guardados
            solo en este navegador.
          </AvisoMock>
        )}

        <div className={`${styles.section} ${styles.sectionFirst}`}>Datos de sistema</div>
        <div className={styles.row}>
          <Field label="Usuario" hint="No editable.">
            <Input value={username} disabled readOnly />
          </Field>
          <Field label="Rol" hint="Lo asigna un administrador.">
            <Input value={roleLabel} disabled readOnly />
          </Field>
        </div>

        <div className={styles.section}>Datos personales</div>
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
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="tu@empresa.com"
            disabled={loading}
          />
        </Field>

        <div className={styles.section}>Cambiar contraseña</div>
        {/* Sin backend de auth entra cualquiera con cualquier clave: no hay
            contraseña real que cambiar y el formulario es de mentira. */}
        {!HAS_AUTH && (
          <AvisoMock>
            El login es de prueba (entra cualquier usuario con cualquier contraseña), así que
            cambiarla no tiene efecto.
          </AvisoMock>
        )}
        <Field label="Contraseña actual" hint="Dejá los tres campos vacíos si no la vas a cambiar.">
          <Input
            type="password"
            value={passActual}
            onChange={(e) => setPassActual(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={loading}
          />
        </Field>
        <div className={styles.row}>
          <Field label="Nueva contraseña" hint={`Mínimo ${PASSWORD_MIN_LEN} caracteres.`}>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={loading}
            />
          </Field>
          <Field label="Confirmar contraseña">
            <Input
              type="password"
              value={passConfirm}
              onChange={(e) => setPassConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={loading}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
