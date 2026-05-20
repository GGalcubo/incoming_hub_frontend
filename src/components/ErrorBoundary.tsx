import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

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
      <div role="alert" className={styles.wrap}>
        <div className={styles.title}>Algo salió mal</div>
        <div className={styles.msg}>
          Ocurrió un error inesperado. Podés reintentar; si el problema persiste, recargá la
          página o contactá al administrador.
        </div>
        <button onClick={this.reset} className={styles.retry}>
          Reintentar
        </button>
      </div>
    );
  }
}
