import { Bell, BarChart3, FolderKanban, LayoutTemplate, MailPlus, Search } from "lucide-react";
import type { ReactNode } from "react";
import type { AppView } from "../types";

type LayoutProps = {
  view: AppView;
  onChangeView: (view: AppView) => void;
  children: ReactNode;
};

const navItems: { id: AppView; label: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "campaign", label: "Creador de Campana", icon: MailPlus },
  { id: "templates", label: "Plantillas", icon: LayoutTemplate },
  { id: "assets", label: "Biblioteca de Activos", icon: FolderKanban }
];

export default function Layout({ view, onChangeView, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed left-0 top-0 h-screen w-[280px] border-r border-border bg-card p-6">
        <p className="font-heading text-xl font-bold text-primary">Disruptia Mailer</p>
        <p className="mt-1 text-sm text-text-muted">Version 1 interna</p>
        <nav className="mt-8 space-y-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChangeView(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                view === id ? "bg-primary text-white" : "text-text hover:bg-surface"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="ml-[280px]">
        <header className="sticky top-0 z-10 border-b border-border bg-card px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <label className="flex w-full max-w-md items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Search size={16} className="text-text-muted" />
              <input className="w-full bg-transparent text-sm outline-none" placeholder="Buscar campanas o activos" />
            </label>
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-border p-2" type="button" aria-label="Notificaciones">
                <Bell size={16} />
              </button>
              <div className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Equipo Disruptia</div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-8">{children}</main>
      </div>
    </div>
  );
}
