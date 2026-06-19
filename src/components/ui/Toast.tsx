import { cx } from "../../lib/cx";
import styles from "./Toast.module.css";

interface ToastProps {
  msg: string;
  kind?: "default" | "success" | "error";
}

export function Toast({ msg, kind = "default" }: ToastProps) {
  if (!msg) return null;
  const success = kind === "success";
  const error = kind === "error";
  return (
    <div className={cx(styles.toast, success && styles.success, error && styles.error)}>
      {success && (
        <span aria-hidden className={styles.check}>
          ✓
        </span>
      )}
      {error && (
        <span aria-hidden className={styles.check}>
          !
        </span>
      )}
      {msg}
    </div>
  );
}
