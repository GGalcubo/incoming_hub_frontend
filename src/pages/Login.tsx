import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { useUser } from "../context/UserContext";
import { cx } from "../lib/cx";
import styles from "./Login.module.css";

export function Login() {
  const navigate = useNavigate();
  const { login } = useUser();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<{ user?: string; pass?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof err = {};
    if (!user) next.user = "Ingresá tu usuario";
    if (!pass) next.pass = "Ingresá tu contraseña";
    setErr(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      const u = await api.login(user, pass);
      login(u);
      navigate("/viajes");
    } catch (ex) {
      setErr({ form: ex instanceof Error ? ex.message : "Error de autenticación" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cx("login-bg", styles.page)}>
      <form onSubmit={submit} className={styles.card}>
        <div className={styles.logoRow}>
          <img src="/brand/isologo-blanco.png" alt="Incoming Hub" className={styles.logo} />
        </div>

        <div className={styles.title}>Ingresá a tu cuenta</div>
        <div className={styles.subtitle}>Plataforma interna para operadores de agencia.</div>

        <div className={styles.fields}>
          <Field label="Usuario" required error={err.user}>
            <Input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder=""
            />
          </Field>
          <Field label="Contraseña" required error={err.pass}>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder=""
            />
          </Field>
          {err.form && <div className={styles.formError}>{err.form}</div>}
          <Button
            type="submit"
            kind="primary"
            size="lg"
            disabled={loading}
            className={styles.submit}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
        </div>

        <div className={styles.footer}>
          ¿Problemas para ingresar? Contactá a tu administrador.
        </div>
      </form>
    </div>
  );
}
