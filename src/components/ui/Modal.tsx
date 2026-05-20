import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Modal.module.css";

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
    <div onClick={onClose} className={styles.overlay}>
      <div onClick={(e) => e.stopPropagation()} className={styles.dialog} style={{ width }}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button onClick={onClose} className={styles.close} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
