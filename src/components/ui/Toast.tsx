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
        background: "#1A2029",
        color: "#F5F7FB",
        padding: "10px 16px",
        borderRadius: 9999,
        border: "1px solid #2A323F",
        font: "500 13px/18px Inter",
        boxShadow: "0 24px 48px rgba(0,0,0,.55)",
      }}
    >
      {msg}
    </div>
  );
}
