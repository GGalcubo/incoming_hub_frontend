import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "../types/domain";
import { Icon } from "./ui/Icon";

interface TopbarProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  user?: User | null;
  onLogout?: () => void;
  onCargarExcel?: () => void;
  onOpenSettings?: () => void;
}

interface NavItem {
  label: string;
  icon: string;
  to: string;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  {
    label: "Viajes",
    icon: "list",
    to: "/viajes",
    match: (p) => p === "/viajes" || p.startsWith("/viajes/"),
  },
  {
    label: "Pasajeros",
    icon: "users",
    to: "/pasajeros",
    match: (p) => p.startsWith("/pasajeros"),
  },
];

export function Topbar({
  title,
  subtitle,
  actions,
  user,
  onLogout,
  onCargarExcel,
  onOpenSettings,
}: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const showGlobal = Boolean(user);
  const showPageRow = Boolean(title || subtitle || actions);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-app)",
        borderBottom: "1px solid var(--border-subtle)",
        flex: "none",
      }}
    >
      {showGlobal && (
        <div
          style={{
            height: 56,
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            borderBottom: showPageRow ? "1px solid var(--border-subtle)" : undefined,
          }}
        >
          <button
            onClick={() => navigate("/viajes")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            title="Inicio"
          >
            <img
              src="/brand/isologo-blanco.png"
              alt="Incoming Hub"
              style={{ height: 26, width: "auto", display: "block" }}
            />
          </button>

          <nav style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
            {NAV.map((item) => {
              const active = item.match(location.pathname);
              return (
                <NavButton
                  key={item.to}
                  active={active}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => navigate(item.to)}
                />
              );
            })}
            {onCargarExcel && (
              <NavButton
                active={false}
                icon="upload"
                label="Cargar Excel"
                onClick={onCargarExcel}
              />
            )}
            <NavButton
              active={location.pathname === "/viajes/nuevo"}
              icon="plus"
              label="Nuevo viaje"
              onClick={() => navigate("/viajes/nuevo")}
            />
          </nav>

          <div style={{ flex: 1 }} />

          <UserMenu user={user!} onLogout={onLogout} onOpenSettings={onOpenSettings} />
        </div>
      )}

      {showPageRow && (
        <div
          style={{
            minHeight: 64,
            padding: "12px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            {title && (
              <div
                style={{
                  font: "600 17px/24px Heming",
                  letterSpacing: "-.005em",
                  color: "var(--fg-primary)",
                }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ font: "400 12px/16px Heming", color: "var(--fg-muted)" }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{actions}</div>
          )}
        </div>
      )}
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}

function NavButton({ active, icon, label, onClick }: NavButtonProps) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 36,
    padding: "0 14px",
    background: active ? "var(--brand-tint-soft)" : "transparent",
    color: active ? "var(--fg-primary)" : "var(--fg-tertiary)",
    border: "1px solid transparent",
    borderRadius: 9999,
    cursor: "pointer",
    font: active ? "600 13px/18px Heming" : "500 13px/18px Heming",
    transition: "all 180ms cubic-bezier(.2,.8,.2,1)",
    whiteSpace: "nowrap",
  };
  return (
    <button
      onClick={onClick}
      style={style}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "var(--bg-elevated)";
          e.currentTarget.style.color = "var(--fg-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--fg-tertiary)";
        }
      }}
    >
      <Icon name={icon} size={16} stroke={active ? 2 : 1.5} />
      {label}
    </button>
  );
}

interface UserMenuProps {
  user: User;
  onLogout?: () => void;
  onOpenSettings?: () => void;
}

function UserMenu({ user, onLogout, onOpenSettings }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (user.user || "?")[0].toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          height: 36,
          padding: "0 6px 0 12px",
          background: open ? "var(--bg-elevated)" : "transparent",
          border: "1px solid var(--border-subtle)",
          borderRadius: 9999,
          cursor: "pointer",
          color: "var(--fg-primary)",
          font: "500 13px/18px Heming",
          transition: "all 180ms cubic-bezier(.2,.8,.2,1)",
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = "var(--bg-elevated)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ color: "var(--fg-secondary)" }}>
          Hola, <span style={{ color: "var(--fg-primary)", fontWeight: 600 }}>{user.user}</span>
        </span>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 9999,
            background: "var(--brand-500)",
            color: "var(--fg-on-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "600 12px Heming",
          }}
        >
          {initial}
        </div>
        <Icon name="chevdown" size={14} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 220,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            boxShadow: "var(--shadow-md)",
            padding: 6,
            zIndex: 40,
          }}
        >
          <div
            style={{
              padding: "10px 12px 12px",
              borderBottom: "1px solid var(--border-subtle)",
              marginBottom: 6,
            }}
          >
            <div style={{ font: "600 14px/18px Heming", color: "var(--fg-primary)" }}>
              {user.user}
            </div>
            <div style={{ font: "400 12px/16px Heming", color: "var(--fg-muted)" }}>Operador</div>
          </div>
          <MenuItem
            icon="edit"
            label="Settings"
            onClick={() => {
              setOpen(false);
              onOpenSettings?.();
            }}
          />
          <MenuItem
            icon="logout"
            label="Cerrar sesión"
            danger
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  const color = danger ? "var(--danger-fg)" : "var(--fg-secondary)";
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 12px",
        background: "transparent",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        color,
        font: "500 13px/18px Heming",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
        if (!danger) e.currentTarget.style.color = "var(--fg-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = color;
      }}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}
