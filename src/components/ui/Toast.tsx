interface ToastProps {
  msg: string;
  kind?: "default" | "success";
}

export function Toast({ msg, kind = "default" }: ToastProps) {
  if (!msg) return null;
  const success = kind === "success";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        background: success ? "#16a34a" : "var(--bg-elevated)",
        color: success ? "#ffffff" : "var(--fg-primary)",
        padding: "12px 20px",
        borderRadius: 9999,
        border: success ? "1px solid #15803d" : "1px solid var(--border-strong)",
        font: success ? "600 14px/20px Heming" : "500 13px/18px Heming",
        boxShadow: success
          ? "0 10px 25px rgba(22,163,74,0.35), 0 4px 10px rgba(0,0,0,0.15)"
          : "var(--shadow-lg)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {success && (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: 9999,
            background: "rgba(255,255,255,0.2)",
            font: "700 13px/1 Heming",
          }}
        >
          ✓
        </span>
      )}
      {msg}
    </div>
  );
}
