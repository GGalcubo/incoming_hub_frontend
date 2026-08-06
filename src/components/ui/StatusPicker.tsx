import { useState } from "react";
import { useEstados } from "../../hooks/useEstados";
import { cx } from "../../lib/cx";
import type { TripStatus } from "../../types/domain";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import styles from "./StatusPicker.module.css";

interface StatusPickerProps {
  value: TripStatus;
  onChange: (est: TripStatus) => void;
  align?: "left" | "right";
}

export function StatusPicker({ value, onChange, align = "left" }: StatusPickerProps) {
  const [open, setOpen] = useState(false);
  const { estados, metaOf } = useEstados();
  // `es_final` del backend: "el viaje no puede cambiar de estado desde Hub". Un
  // viaje ya cerrado o eliminado no se toca, así que el selector queda inerte.
  const cerrado = metaOf(value)?.esFinal ?? false;

  if (cerrado) {
    return (
      <div className={styles.wrap} onClick={(e) => e.stopPropagation()}>
        <span className={styles.trigger} title="El viaje está en un estado final: no se puede cambiar">
          <Badge status={value} />
        </span>
      </div>
    );
  }

  return (
    <div className={styles.wrap} onClick={(e) => e.stopPropagation()}>
      <button className={styles.trigger} onClick={() => setOpen((o) => !o)} title="Cambiar estado">
        <Badge status={value} />
        <Icon name="chevdown" size={11} />
      </button>
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={cx(styles.menu, align === "right" && styles.menuRight)}>
            {estados.map((s) => (
              <button
                key={s.id}
                className={cx(styles.opt, s.id === value && styles.optActive)}
                onClick={() => {
                  setOpen(false);
                  if (s.id !== value) onChange(s.id);
                }}
              >
                <Badge status={s.id} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
