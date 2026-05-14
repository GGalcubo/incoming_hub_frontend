import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

export type ButtonKind =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerSolid"
  | "amber";

export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  kind?: ButtonKind;
  size?: ButtonSize;
  icon?: string;
  children?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  style?: CSSProperties;
}

const VARIANTS: Record<ButtonKind, CSSProperties> = {
  primary: { background: "var(--brand-500)", color: "var(--fg-on-brand)", fontWeight: 600 },
  secondary: {
    background: "var(--bg-elevated)",
    color: "var(--fg-primary)",
    borderColor: "var(--border-strong)",
  },
  ghost: { background: "transparent", color: "var(--fg-tertiary)" },
  danger: {
    background: "transparent",
    color: "var(--danger-fg)",
    borderColor: "var(--danger-border)",
  },
  dangerSolid: {
    background: "var(--danger-solid)",
    color: "var(--fg-on-danger)",
    fontWeight: 600,
  },
  amber: { background: "var(--warning-solid)", color: "var(--fg-on-brand)", fontWeight: 600 },
};

const HOVER: Record<ButtonKind, string> = {
  primary: "var(--brand-400)",
  secondary: "var(--border-subtle)",
  ghost: "var(--bg-elevated)",
  danger: "var(--danger-bg)",
  dangerSolid: "var(--danger-solid-hover)",
  amber: "var(--warning-solid-hover)",
};

export function Button({
  kind = "secondary",
  size = "md",
  icon,
  children,
  onClick,
  type = "button",
  disabled,
  style,
}: ButtonProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "Heming",
    fontWeight: 500,
    lineHeight: "20px",
    borderRadius: 9999,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    padding: size === "sm" ? "6px 12px" : size === "lg" ? "11px 20px" : "9px 18px",
    fontSize: size === "sm" ? 13 : 14,
    opacity: disabled ? 0.4 : 1,
    transition: "all 180ms cubic-bezier(.2,.8,.2,1)",
    whiteSpace: "nowrap",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...VARIANTS[kind], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = HOVER[kind];
        if (kind === "ghost") e.currentTarget.style.color = "var(--fg-primary)";
        if (kind === "secondary") e.currentTarget.style.borderColor = "var(--border-stronger)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = (VARIANTS[kind].background as string) ?? "";
        if (kind === "ghost") e.currentTarget.style.color = "var(--fg-tertiary)";
        if (kind === "secondary") e.currentTarget.style.borderColor = "var(--border-strong)";
      }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}
