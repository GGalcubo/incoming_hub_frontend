import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useModals } from "../context/ModalsContext";
import { useUser } from "../context/UserContext";
import { cx } from "../lib/cx";
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

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useUser();
  const { openExcel, openSettings } = useModals();
  const showGlobal = Boolean(user);
  const showPageRow = Boolean(title || subtitle || actions);

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
            {NAV.map((item) => (
              <NavButton
                key={item.to}
                active={item.match(location.pathname)}
                icon={item.icon}
                label={item.label}
                onClick={() => navigate(item.to)}
              />
            ))}
            <NavButton active={false} icon="upload" label="Cargar Excel" onClick={openExcel} />
            <NavButton
              active={location.pathname === "/viajes/nuevo"}
              icon="plus"
              label="Nuevo viaje"
              onClick={() => navigate("/viajes/nuevo")}
            />
          </nav>

          <div className={styles.spacer} />

          <UserMenu user={user!} onLogout={logout} onOpenSettings={openSettings} />
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
}

function NavButton({ active, icon, label, onClick }: NavButtonProps) {
  return (
    <button onClick={onClick} className={cx(styles.navBtn, active && styles.navBtnActive)}>
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
            <div className={styles.menuRole}>Operador</div>
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
