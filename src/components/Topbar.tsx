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
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-app)",
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
            color: "var(--fg-primary)",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ font: "400 12px/16px Inter", color: "var(--fg-muted)" }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{actions}</div>
    </div>
  );
}
