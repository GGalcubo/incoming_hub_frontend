import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "../../lib/cx";
import styles from "./Field.module.css";

interface FieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  span?: number;
  className?: string;
  style?: CSSProperties;
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  span = 1,
  className,
  style,
}: FieldProps) {
  return (
    <label className={cx(styles.field, span >= 2 && styles.span2, className)} style={style}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.req}> ·</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.error}>{error}</span>}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(styles.input, className)} />;
}

export function Select({
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(styles.input, styles.select, className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(styles.input, styles.textarea, className)} />;
}
