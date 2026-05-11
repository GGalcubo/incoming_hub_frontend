import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "../types/domain";
import { Icon } from "./ui/Icon";

interface SidebarProps {
  view: "trips" | "new";
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
        background: active ? "rgba(31,184,116,.10)" : "transparent",
        color: active ? "#F5F7FB" : "#8B95A7",
        font: active ? "600 14px/20px Inter" : "500 14px/20px Inter",
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
          e.currentTarget.style.background = "#1A2029";
          e.currentTarget.style.color = "#E7EBF2";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#8B95A7";
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
            background: "#1FB874",
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
        background: "#0A0E14",
        borderRight: "1px solid #1F2733",
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
        <img src="/logo-mark.svg" alt="" style={{ height: 24 }} />
        {!collapsed && (
          <span
            style={{
              font: "600 16px/22px Inter",
              letterSpacing: "-.005em",
              color: "#F5F7FB",
            }}
          >
            Incoming Hub<span style={{ color: "#1FB874" }}>·</span>
          </span>
        )}
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
          background: "#11161E",
          border: "1px solid #1F2733",
          color: "#8B95A7",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          zIndex: 2,
          transition: "all 180ms cubic-bezier(.2,.8,.2,1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#1A2029";
          e.currentTarget.style.color = "#F5F7FB";
          e.currentTarget.style.borderColor = "#2A323F";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#11161E";
          e.currentTarget.style.color = "#8B95A7";
          e.currentTarget.style.borderColor = "#1F2733";
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
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          borderTop: "1px solid #1F2733",
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
            background: "#1FB874",
            color: "#0A0E14",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "600 12px Inter",
            flex: "none",
          }}
        >
          {initial}
        </div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: "500 13px/18px Inter",
                color: "#E7EBF2",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.user}
            </div>
            <div style={{ font: "400 11px/14px Inter", color: "#8B95A7" }}>Operador</div>
          </div>
        )}
        <button
          onClick={onLogout}
          title="Cerrar sesión"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#8B95A7",
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
