import { useState } from "react";
import { STATUSES } from "../../data/catalogos";
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
            {STATUSES.map((s) => (
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
