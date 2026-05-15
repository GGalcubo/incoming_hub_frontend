import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "../types/domain";
import { Icon } from "./ui/Icon";

interface SidebarProps {
  view: "trips" | "new" | "passengers";
  user: User | null;
  onLogout: () => void;
}

interface ItemProps {
  active: boolean;
  icon: string;
  label: string;
  collapsed: boolean;
  onClick: () => void;
}

function Item({ active, icon, label, collapsed, onClick }: ItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: active ? "var(--brand-tint-soft)" : "transparent",
        color: active ? "var(--fg-primary)" : "var(--fg-muted)",
        font: active ? "600 14px/20px Heming" : "500 14px/20px Heming",
        border: "none",
        textAlign: "left",
        padding: collapsed ? "9px 0" : "9px 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 8,
        cursor: "pointer",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "var(--bg-elevated)";
          e.currentTarget.style.color = "var(--fg-secondary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--fg-muted)";
        }
      }}
    >
      {active && (
        <span
          style={{
            position: "absolute",
            left: collapsed ? -4 : -12,
            top: 8,
            bottom: 8,
            width: 2,
            borderRadius: 2,
            background: "var(--brand-500)",
          }}
        />
      )}
      <Icon name={icon} size={18} stroke={active ? 2 : 1.5} />
      {!collapsed && label}
    </button>
  );
}

const STORAGE_KEY = "proxy:sidebarCollapsed";

export function Sidebar({ view, user, onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const initial = (user?.user || "?")[0].toUpperCase();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => !c);

  return (
    <aside
      style={{
        width: collapsed ? 64 : 240,
        flex: "none",
        background: "var(--bg-app)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        padding: collapsed ? "16px 8px" : "16px 12px",
        transition: "width 180ms cubic-bezier(.2,.8,.2,1), padding 180ms cubic-bezier(.2,.8,.2,1)",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: collapsed ? "6px 0 18px" : "6px 6px 18px",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <img
          src={collapsed ? "/brand/isotipo-blanco.png" : "/brand/isologo-blanco.png"}
          alt="Incoming Hub"
          style={{
            height: collapsed ? 32 : 28,
            width: "auto",
            display: "block",
          }}
        />
      </div>

      <button
        onClick={toggle}
        title={collapsed ? "Expandir" : "Contraer"}
        style={{
          position: "absolute",
          top: 22,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: 9999,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          color: "var(--fg-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          zIndex: 2,
          transition: "all 180ms cubic-bezier(.2,.8,.2,1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
          e.currentTarget.style.color = "var(--fg-primary)";
          e.currentTarget.style.borderColor = "var(--border-strong)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-surface)";
          e.currentTarget.style.color = "var(--fg-muted)";
          e.currentTarget.style.borderColor = "var(--border-subtle)";
        }}
      >
        <Icon name={collapsed ? "chevright" : "chevleft"} size={14} />
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Item
          active={view === "trips"}
          icon="list"
          label="Viajes"
          collapsed={collapsed}
          onClick={() => navigate("/viajes")}
        />
        <Item
          active={view === "new"}
          icon="plus"
          label="Nuevo viaje"
          collapsed={collapsed}
          onClick={() => navigate("/viajes/nuevo")}
        />
        <Item
          active={view === "passengers"}
          icon="users"
          label="Pasajeros"
          collapsed={collapsed}
          onClick={() => navigate("/pasajeros")}
        />
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: collapsed ? "12px 0 4px" : "12px 6px 4px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexDirection: collapsed ? "column" : "row",
        }}
      >
        <div
          title={collapsed ? user?.user : undefined}
          style={{
            width: 28,
            height: 28,
            borderRadius: 9999,
            background: "var(--brand-500)",
            color: "var(--fg-on-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "600 12px Heming",
            flex: "none",
          }}
        >
          {initial}
        </div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: "500 13px/18px Heming",
                color: "var(--fg-secondary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.user}
            </div>
            <div style={{ font: "400 11px/14px Heming", color: "var(--fg-muted)" }}>Operador</div>
          </div>
        )}
        <button
          onClick={onLogout}
          title="Cerrar sesión"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--fg-muted)",
            padding: 4,
            borderRadius: 6,
          }}
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </aside>
  );
}
