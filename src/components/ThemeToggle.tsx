import type { ThemeMode } from "../hooks/useTheme";
import { Icon } from "./ui/Icon";

interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  collapsed?: boolean;
}

const OPTIONS: { id: ThemeMode; icon: string; label: string }[] = [
  { id: "light", icon: "sun", label: "Claro" },
  { id: "dark", icon: "moon", label: "Oscuro" },
  { id: "system", icon: "monitor", label: "Sistema" },
];

export function ThemeToggle({ mode, onChange, collapsed }: ThemeToggleProps) {
  if (collapsed) {
    const idx = OPTIONS.findIndex((o) => o.id === mode);
    const current = OPTIONS[idx === -1 ? 2 : idx];
    const cycle = () => {
      const next = OPTIONS[(idx + 1) % OPTIONS.length];
      onChange(next.id);
    };
    return (
      <button
        onClick={cycle}
        title={`Tema: ${current.label} (clic para cambiar)`}
        aria-label={`Cambiar tema (actual: ${current.label})`}
        style={{
          width: 32,
          height: 32,
          borderRadius: 9999,
          background: "transparent",
          border: "1px solid var(--border-subtle)",
          color: "var(--fg-tertiary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          transition: "all 180ms cubic-bezier(.2,.8,.2,1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
          e.currentTarget.style.color = "var(--fg-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--fg-tertiary)";
        }}
      >
        <Icon name={current.icon} size={15} />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      style={{
        display: "flex",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 9999,
        padding: 3,
        gap: 2,
      }}
    >
      {OPTIONS.map((o) => {
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            title={o.label}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "none",
              padding: "5px 8px",
              borderRadius: 9999,
              cursor: "pointer",
              background: active ? "var(--brand-500)" : "transparent",
              color: active ? "var(--fg-on-brand)" : "var(--fg-tertiary)",
              font: active ? "600 11px/14px Inter" : "500 11px/14px Inter",
              letterSpacing: ".02em",
              transition: "all 180ms cubic-bezier(.2,.8,.2,1)",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--fg-primary)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--fg-tertiary)";
            }}
          >
            <Icon name={o.icon} size={13} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
