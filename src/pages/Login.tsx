import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import type { User } from "../types/domain";

interface LoginProps {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState("operador@incoming_hub.com");
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
      onLogin(u);
      navigate("/viajes");
    } catch (ex) {
      setErr({ form: ex instanceof Error ? ex.message : "Error de autenticación" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 380,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: 32,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <img
            src="/brand/isologo-blanco.png"
            alt="Incoming Hub"
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </div>

        <div
          style={{
            font: "600 22px/28px Heming",
            letterSpacing: "-.005em",
            marginBottom: 6,
            color: "var(--fg-primary)",
          }}
        >
          Ingresá a tu cuenta
        </div>
        <div
          style={{
            font: "400 13px/18px Heming",
            color: "var(--fg-muted)",
            marginBottom: 24,
          }}
        >
          Plataforma interna para operadores de agencia.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Usuario" required error={err.user}>
            <Input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="usuario@agencia"
            />
          </Field>
          <Field label="Contraseña" required error={err.pass}>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {err.form && (
            <div style={{ font: "400 12px/16px Heming", color: "var(--danger-fg)" }}>
              {err.form}
            </div>
          )}
          <Button
            type="submit"
            kind="primary"
            size="lg"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
        </div>

        <div
          style={{
            font: "400 12px/16px Heming",
            color: "var(--fg-disabled)",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          ¿Problemas para ingresar? Contactá a tu administrador.
        </div>
      </form>
    </div>
  );
}
