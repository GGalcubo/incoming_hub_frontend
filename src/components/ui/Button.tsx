import type { CSSProperties, ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Icon } from "./Icon";
import styles from "./Button.module.css";

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
  // Acción en vuelo: el botón queda bloqueado y muestra el spinner en lugar del
  // icono, así se ve que está esperando la respuesta del servidor.
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Button({
  kind = "secondary",
  size = "md",
  icon,
  children,
  onClick,
  type = "button",
  disabled,
  loading,
  className,
  style,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading || undefined}
      className={cx(styles.btn, styles[size], styles[kind], loading && styles.busy, className)}
      style={style}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />
      )}
      {children}
    </button>
  );
}
