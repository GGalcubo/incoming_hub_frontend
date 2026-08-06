import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { useUser } from "../context/UserContext";
import { cx } from "../lib/cx";
import { DEV_USERS, devUsersEnabled } from "../lib/devUsers";
import styles from "./Login.module.css";

export function Login() {
  const navigate = useNavigate();
  const { login } = useUser();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<{ user?: string; pass?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  // Atajos de usuario: solo con el flag admin=1 en el navegador.
  const [showDevUsers] = useState(devUsersEnabled);

  const doLogin = async (username: string, password: string) => {
    setLoading(true);
    try {
      const u = await api.login(username, password);
      login(u, remember);
      navigate("/viajes");
    } catch (ex) {
      setErr({ form: ex instanceof Error ? ex.message : "Error de autenticación" });
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof err = {};
    if (!user) next.user = "Ingresá tu usuario";
    if (!pass) next.pass = "Ingresá tu contraseña";
    setErr(next);
    if (Object.keys(next).length) return;
    await doLogin(user, pass);
  };

  const loginAs = (username: string, password: string) => {
    setUser(username);
    setPass(password);
    setErr({});
    void doLogin(username, password);
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
          <label className={styles.remember}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Recordarme en este equipo
          </label>
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

          {showDevUsers && (
            <div className={styles.devUsers}>
              <div className={styles.devUsersTitle}>Ingresar como</div>
              <div className={styles.devUsersRow}>
                {DEV_USERS.map((d) => (
                  <Button
                    key={d.user}
                    kind="secondary"
                    size="sm"
                    disabled={loading}
                    onClick={() => loginAs(d.user, d.pass)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          ¿Problemas para ingresar? Contactá a tu administrador.
        </div>
      </form>
    </div>
  );
}
