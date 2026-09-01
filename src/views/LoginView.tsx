import { useState } from "react";
import { LogIn, ShieldAlert } from "lucide-react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

/**
 * Pantalla de acceso. No hay registro público: los usuarios del equipo se crean
 * a mano en Supabase, así nadie con la URL puede darse de alta solo.
 */
export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase no está configurado (falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : signInError.message
        );
      }
      // Con sesión válida, AuthGate reemplaza esta pantalla por la app.
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <p className="font-heading text-3xl font-bold text-primary">Disruptia Mailer</p>
          <p className="mt-2 text-sm text-text-muted">Ingresá con tu cuenta del equipo.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-semibold" htmlFor="login-email">
              Correo
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              className="input mt-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@disruptia.co"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold" htmlFor="login-password">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="input mt-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/5 p-3">
              <ShieldAlert size={15} className="mt-0.5 shrink-0 text-error" />
              <p className="text-xs text-error">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !hasSupabaseConfig}
            className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-40"
          >
            <LogIn size={16} />
            {loading ? "Entrando…" : "Entrar"}
          </button>

          <p className="text-center text-xs text-text-muted">
            ¿Sin cuenta? Pedíselo a quien administra el Supabase del mailer: las cuentas se crean a mano.
          </p>
        </form>
      </div>
    </div>
  );
}
