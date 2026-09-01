import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, setActorId, supabase } from "../lib/supabase";
import LoginView from "../views/LoginView";

/**
 * Puerta de acceso: sin sesión no se monta nada de la app. Es la contraparte en
 * el navegador de las políticas RLS — la base rechaza al anónimo, y acá ni
 * siquiera se intenta cargar datos sin sesión.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setActorId(data.session?.user.id ?? null);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setActorId(nextSession?.user.id ?? null);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Sin configuración de Supabase la app se muestra igual (los features fallan
  // solos con su mensaje), como antes de que existiera el login.
  if (!hasSupabaseConfig) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-text-muted">Verificando sesión…</p>
      </div>
    );
  }

  if (!session) return <LoginView />;

  return <>{children}</>;
}
