import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary capturó un error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
          background: "var(--bg-app)",
          textAlign: "center",
        }}
      >
        <div style={{ font: "600 18px/24px Heming", color: "var(--fg-primary)" }}>
          Algo salió mal
        </div>
        <div style={{ font: "400 13px/18px Heming", color: "var(--fg-muted)", maxWidth: 420 }}>
          Ocurrió un error inesperado. Podés reintentar; si el problema persiste, recargá la
          página o contactá al administrador.
        </div>
        <button
          onClick={this.reset}
          style={{
            marginTop: 8,
            height: 36,
            padding: "0 16px",
            borderRadius: 9999,
            border: "1px solid var(--border-strong)",
            background: "var(--bg-elevated)",
            color: "var(--fg-primary)",
            font: "600 13px/18px Heming",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }
}
