import { STATUSES } from "../../data/seed";
import type { TripStatus } from "../../types/domain";

interface BadgeProps {
  status: TripStatus | string;
}

export function Badge({ status }: BadgeProps) {
  const s =
    STATUSES.find((x) => x.id === status) ?? {
      label: String(status),
      bg: "rgba(95,107,128,.20)",
      fg: "#C2C9D6",
    };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 22,
        padding: "0 10px",
        borderRadius: 9999,
        font: "600 11px/14px Inter",
        letterSpacing: ".06em",
        textTransform: "uppercase",
        background: s.bg,
        color: s.fg,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: 9999, background: s.fg }}
      />
      {s.label}
    </span>
  );
}
