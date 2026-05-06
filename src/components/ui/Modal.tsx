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
        background: "rgba(10,14,20,.72)",
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
          background: "#11161E",
          borderRadius: 16,
          border: "1px solid #1F2733",
          boxShadow: "0 24px 48px rgba(0,0,0,.55), 0 8px 16px rgba(0,0,0,.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #1F2733",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ font: "600 17px/24px Inter", color: "#F5F7FB" }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#8B95A7",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "20px 24px", overflow: "auto", flex: 1, color: "#E7EBF2" }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid #1F2733",
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
