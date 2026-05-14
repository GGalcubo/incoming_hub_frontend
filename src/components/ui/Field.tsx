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
      <span style={{ font: "500 13px/18px Heming", color: "var(--fg-secondary)" }}>
        {label}
        {required && <span style={{ color: "var(--danger-fg)" }}> ·</span>}
      </span>
      {children}
      {hint && !error && (
        <span style={{ font: "400 12px/16px Heming", color: "var(--fg-muted)" }}>{hint}</span>
      )}
      {error && (
        <span style={{ font: "400 12px/16px Heming", color: "var(--danger-fg)" }}>{error}</span>
      )}
    </label>
  );
}

const inputStyle: CSSProperties = {
  fontWeight: 400,
  fontSize: 14,
  lineHeight: "20px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Arial, sans-serif',
  padding: "9px 12px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--input-border)",
  borderRadius: 8,
  backgroundColor: "var(--input-bg)",
  color: "var(--input-fg)",
  caretColor: "var(--input-fg)",
  outline: "none",
  transition: "border-color 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms cubic-bezier(.2,.8,.2,1)",
  width: "100%",
};

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...props.style }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--fg-primary)";
        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,255,255,.20)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--input-border)";
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
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23000000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
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
      style={{ ...inputStyle, minHeight: 72, resize: "vertical", fontFamily: "Heming", ...p.style }}
    />
  );
}
