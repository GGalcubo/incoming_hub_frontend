import { useEffect, useState } from "react";
import type { User } from "../types/domain";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Field";
import { Modal } from "./ui/Modal";

interface UserSettingsModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (prefs: UserPrefs) => void;
}

export interface UserPrefs {
  email: string;
}

const PREFS_KEY = "proxy:userPrefs";

export function loadUserPrefs(): UserPrefs {
  const defaults: UserPrefs = { email: "" };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<UserPrefs>) };
  } catch {
    return defaults;
  }
}

export function saveUserPrefs(prefs: UserPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function UserSettingsModal({ open, user, onClose, onSave }: UserSettingsModalProps) {
  const [prefs, setPrefs] = useState<UserPrefs>(loadUserPrefs);

  useEffect(() => {
    if (open) setPrefs(loadUserPrefs());
  }, [open]);

  const handleSave = () => {
    saveUserPrefs(prefs);
    onSave(prefs);
    onClose();
  };

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
          <Button kind="primary" icon="check" onClick={handleSave}>
            Guardar
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Usuario">
          <Input value={user?.user ?? ""} disabled readOnly />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={prefs.email}
            onChange={(e) => setPrefs({ email: e.target.value })}
            placeholder="tu@empresa.com"
          />
        </Field>
      </div>
    </Modal>
  );
}
