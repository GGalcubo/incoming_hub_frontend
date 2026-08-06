import type { CSSProperties } from "react";
import { STATUSES } from "../../data/catalogos";
import type { TripStatus } from "../../types/domain";
import styles from "./Badge.module.css";

interface BadgeProps {
  status: TripStatus | string;
}

function tokenKey(id: string) {
  return id.toLowerCase().replace(/_/g, "");
}

export function Badge({ status }: BadgeProps) {
  const meta = STATUSES.find((x) => x.id === status);
  const id = meta?.id ?? String(status);
  const label = meta?.label ?? String(status);
  const key = tokenKey(id);

  const vars = {
    "--badge-bg": `var(--status-${key}-bg, var(--status-enespera-bg))`,
    "--badge-fg": `var(--status-${key}-fg, var(--status-enespera-fg))`,
  } as CSSProperties;

  return (
    <span className={styles.badge} style={vars}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}
