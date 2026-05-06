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
  const [user, setUser] = useState("operador@proxy");
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
      style={{
        minHeight: "100vh",
        background: "#0A0E14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundImage: `radial-gradient(ellipse 600px 400px at 50% 30%, rgba(31,184,116,.10), transparent 70%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M32 0H0v32' fill='none' stroke='%231F2733' stroke-width='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: "auto, 32px 32px",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 380,
          background: "#11161E",
          border: "1px solid #1F2733",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 24px 48px rgba(0,0,0,.55), 0 8px 16px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <img src="/logo-mark.svg" alt="" style={{ height: 28 }} />
          <span
            style={{
              font: "600 18px/24px Inter",
              letterSpacing: "-.005em",
              color: "#F5F7FB",
            }}
          >
            Plataforma de Viajes<span style={{ color: "#1FB874" }}>·</span>
          </span>
        </div>

        <div
          style={{
            font: "600 22px/28px Inter",
            letterSpacing: "-.005em",
            marginBottom: 6,
            color: "#F5F7FB",
          }}
        >
          Ingresá a tu cuenta
        </div>
        <div
          style={{
            font: "400 13px/18px Inter",
            color: "#8B95A7",
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
            <div style={{ font: "400 12px/16px Inter", color: "#FF7A7A" }}>{err.form}</div>
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
            font: "400 12px/16px Inter",
            color: "#5E6878",
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
