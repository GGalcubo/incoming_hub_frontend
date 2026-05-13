import type { CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  span?: number;
  style?: CSSProperties;
}

export function Field({ label, required, error, hint, children, span = 1, style }: FieldProps) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        gridColumn: `span ${span}`,
        ...style,
      }}
    >
      <span style={{ font: "500 13px/18px Inter", color: "var(--fg-secondary)" }}>
        {label}
        {required && <span style={{ color: "var(--danger-fg)" }}> ·</span>}
      </span>
      {children}
      {hint && !error && (
        <span style={{ font: "400 12px/16px Inter", color: "var(--fg-muted)" }}>{hint}</span>
      )}
      {error && (
        <span style={{ font: "400 12px/16px Inter", color: "var(--danger-fg)" }}>{error}</span>
      )}
    </label>
  );
}

const inputStyle: CSSProperties = {
  font: "400 14px/20px Inter",
  padding: "9px 12px",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  background: "var(--bg-surface)",
  color: "var(--fg-primary)",
  outline: "none",
  transition: "all 180ms cubic-bezier(.2,.8,.2,1)",
  width: "100%",
};

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...props.style }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--brand-500)";
        e.currentTarget.style.boxShadow = "0 0 0 3px var(--brand-glow)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.boxShadow = "none";
        props.onBlur?.(e);
      }}
    />
  );
}

export function Select({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      style={{
        ...inputStyle,
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B95A7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: 32,
        ...p.style,
      }}
    >
      {children}
    </select>
  );
}

export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...p}
      style={{ ...inputStyle, minHeight: 72, resize: "vertical", fontFamily: "Inter", ...p.style }}
    />
  );
}
