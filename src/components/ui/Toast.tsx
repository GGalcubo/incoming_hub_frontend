import { cx } from "../../lib/cx";
import styles from "./Toast.module.css";

interface ToastProps {
  msg: string;
  kind?: "default" | "success";
}

export function Toast({ msg, kind = "default" }: ToastProps) {
  if (!msg) return null;
  const success = kind === "success";
  return (
    <div className={cx(styles.toast, success && styles.success)}>
      {success && (
        <span aria-hidden className={styles.check}>
          ✓
        </span>
      )}
      {msg}
    </div>
  );
}
