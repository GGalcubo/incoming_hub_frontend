interface ToastProps {
  msg: string;
}

export function Toast({ msg }: ToastProps) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        background: "var(--bg-elevated)",
        color: "var(--fg-primary)",
        padding: "10px 16px",
        borderRadius: 9999,
        border: "1px solid var(--border-strong)",
        font: "500 13px/18px Heming",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {msg}
    </div>
  );
}
