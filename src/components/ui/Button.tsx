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
  primary: { background: "#1FB874", color: "#0A0E14", fontWeight: 600 },
  secondary: { background: "#1A2029", color: "#F5F7FB", borderColor: "#2A323F" },
  ghost: { background: "transparent", color: "#B5BCC9" },
  danger: { background: "transparent", color: "#FF7A7A", borderColor: "rgba(232,68,68,.30)" },
  dangerSolid: { background: "#E84444", color: "#fff", fontWeight: 600 },
  amber: { background: "#E8A317", color: "#0A0E14", fontWeight: 600 },
};

const HOVER: Record<ButtonKind, string> = {
  primary: "#4FD79A",
  secondary: "#1F2733",
  ghost: "#1A2029",
  danger: "rgba(232,68,68,.16)",
  dangerSolid: "#FF6B6B",
  amber: "#F6C24A",
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
    fontFamily: "Inter",
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
        if (kind === "ghost") e.currentTarget.style.color = "#F5F7FB";
        if (kind === "secondary") e.currentTarget.style.borderColor = "#3F4856";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = (VARIANTS[kind].background as string) ?? "";
        if (kind === "ghost") e.currentTarget.style.color = "#B5BCC9";
        if (kind === "secondary") e.currentTarget.style.borderColor = "#2A323F";
      }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}
