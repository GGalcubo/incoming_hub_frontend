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
  className,
  style,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(styles.btn, styles[size], styles[kind], className)}
      style={style}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}
