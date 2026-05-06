import type { ReactNode } from "react";

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <div
      style={{
        height: 64,
        padding: "0 28px",
        borderBottom: "1px solid #1F2733",
        background: "#0A0E14",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flex: "none",
      }}
    >
      <div>
        <div
          style={{
            font: "600 17px/24px Inter",
            letterSpacing: "-.005em",
            color: "#F5F7FB",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ font: "400 12px/16px Inter", color: "#8B95A7" }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{actions}</div>
    </div>
  );
}
