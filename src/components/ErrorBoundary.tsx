import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error no capturado en la UI:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-8">
        <div className="card max-w-lg space-y-4 text-center">
          <p className="font-heading text-xl font-bold">Algo salió mal</p>
          <p className="text-sm text-text-muted">
            Ocurrió un error inesperado en la aplicación. Podés recargar la página; si el problema persiste, avisá al
            equipo.
          </p>
          <p className="rounded-lg bg-surface p-3 text-left font-mono text-xs text-error">
            {this.state.error.message}
          </p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Recargar la aplicación
          </button>
        </div>
      </div>
    );
  }
}
