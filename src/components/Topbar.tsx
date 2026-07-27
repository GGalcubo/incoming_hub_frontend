import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useModals } from "../context/ModalsContext";
import { useUser } from "../context/UserContext";
import { useMe } from "../hooks/useMe";
import { cx } from "../lib/cx";
import type { RoleEnum } from "../api/backend";
import type { User } from "../types/domain";
import { Icon } from "./ui/Icon";
import styles from "./Topbar.module.css";

interface TopbarProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

interface NavItem {
  label: string;
  icon: string;
  to: string;
  match: (path: string) => boolean;
  // Roles que ven el ítem; undefined = todos.
  roles?: RoleEnum[];
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
    roles: ["admin", "agency_staff", "agency_operator"],
  },
  {
    label: "Tarifas Proveedor",
    icon: "tag",
    to: "/tarifas/proveedor",
    // /tarifas sin sufijo redirige acá: lo tomamos como activo para que el ítem
    // no quede apagado durante la redirección.
    match: (p) => p === "/tarifas" || p.startsWith("/tarifas/proveedor"),
    roles: ["admin", "proveedor", "agency_staff", "agency_operator"],
  },
  {
    // El proveedor no ve lo que se le factura al cliente.
    label: "Tarifas Cliente",
    icon: "tag",
    to: "/tarifas/cliente",
    match: (p) => p.startsWith("/tarifas/cliente"),
    roles: ["admin", "agency_staff", "agency_operator"],
  },
];

const ROLE_LABEL: Record<RoleEnum, string> = {
  admin: "Administrador",
  agency_staff: "Agencia",
  agency_operator: "Operador",
  proveedor: "Proveedor",
};

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useUser();
  const { openExcel, openSettings } = useModals();
  const { role, isProvider } = useMe();
  const showGlobal = Boolean(user);
  const showPageRow = Boolean(title || subtitle || actions);
  // El proveedor no crea viajes ni carga por Excel: solo consulta los asignados y
  // gestiona sus tarifas/costos.
  const canCreateTrips = !isProvider;
  const navItems = NAV.filter((item) => !item.roles || (role != null && item.roles.includes(role)));

  return (
    <div className={styles.topbar}>
      {showGlobal && (
        <div className={cx(styles.globalBar, showPageRow && styles.globalBarDivider)}>
          <button onClick={() => navigate("/viajes")} className={styles.logoBtn} title="Inicio">
            <img
              src="/brand/isologo-blanco.png"
              alt="Incoming Hub"
              className={styles.logoImg}
            />
          </button>

          <nav className={styles.nav}>
            {navItems.map((item) => (
              <NavButton
                key={item.to}
                active={item.match(location.pathname)}
                icon={item.icon}
                label={item.label}
                onClick={() => navigate(item.to)}
              />
            ))}
            {canCreateTrips && (
              <>
                <NavButton active={false} icon="upload" label="Cargar Excel" onClick={openExcel} />
                <NavButton
                  active={location.pathname === "/viajes/nuevo"}
                  icon="plus"
                  label="Nuevo viaje"
                  primary
                  onClick={() => navigate("/viajes/nuevo")}
                />
              </>
            )}
          </nav>

          <div className={styles.spacer} />

          <UserMenu
            user={user!}
            roleLabel={role ? ROLE_LABEL[role] : "Operador"}
            onLogout={logout}
            onOpenSettings={openSettings}
          />
        </div>
      )}

      {showPageRow && (
        <div className={styles.pageRow}>
          <div>
            {title && <div className={styles.pageTitle}>{title}</div>}
            {subtitle && <div className={styles.pageSubtitle}>{subtitle}</div>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
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
  primary?: boolean;
}

function NavButton({ active, icon, label, onClick, primary }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cx(styles.navBtn, primary && styles.navBtnPrimary, active && styles.navBtnActive)}
    >
      <Icon name={icon} size={16} stroke={primary || active ? 2 : 1.5} />
      {label}
    </button>
  );
}

interface UserMenuProps {
  user: User;
  roleLabel: string;
  onLogout?: () => void;
  onOpenSettings?: () => void;
}

function UserMenu({ user, roleLabel, onLogout, onOpenSettings }: UserMenuProps) {
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
    <div ref={ref} className={styles.userMenu}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cx(styles.userBtn, open && styles.userBtnOpen)}
      >
        <span className={styles.greeting}>
          Hola, <span className={styles.greetingName}>{user.user}</span>
        </span>
        <div className={styles.avatar}>{initial}</div>
        <Icon name="chevdown" size={14} />
      </button>

      {open && (
        <div className={styles.menu}>
          <div className={styles.menuHeader}>
            <div className={styles.menuName}>{user.user}</div>
            <div className={styles.menuRole}>{roleLabel}</div>
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
  return (
    <button onClick={onClick} className={cx(styles.menuItem, danger && styles.danger)}>
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}
