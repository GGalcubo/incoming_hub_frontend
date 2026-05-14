import { STATUSES } from "../../data/seed";
import type { TripStatus } from "../../types/domain";

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
  const bg = `var(--status-${key}-bg, var(--status-enespera-bg))`;
  const fg = `var(--status-${key}-fg, var(--status-enespera-fg))`;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 22,
        padding: "0 10px",
        borderRadius: 9999,
        font: "600 11px/14px Heming",
        letterSpacing: ".06em",
        textTransform: "uppercase",
        background: bg,
        color: fg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: fg }} />
      {label}
    </span>
  );
}
