import type { ReactNode } from "react";

/**
 * Barra de acciones fija al fondo de la ventana: los botones de navegación
 * (Volver / Continuar / Aprobar / Guardar) se ven siempre, incluso con scroll.
 */
export default function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-8 -mb-8 mt-6 border-t border-border bg-card/95 px-8 py-4 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">{children}</div>
    </div>
  );
}
