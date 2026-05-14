import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, footer, width = 560 }: ModalProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-overlay)",
        backdropFilter: "blur(4px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          maxHeight: "calc(100vh - 48px)",
          background: "var(--bg-surface)",
          borderRadius: 16,
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ font: "600 17px/24px Heming", color: "var(--fg-primary)" }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--fg-muted)",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div
          style={{
            padding: "20px 24px",
            overflow: "auto",
            flex: 1,
            color: "var(--fg-secondary)",
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
