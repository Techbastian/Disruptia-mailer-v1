import { BarChart3, FolderKanban, LayoutTemplate, MailPlus, MessageSquareText, Send } from "lucide-react";
import type { ReactNode } from "react";
import type { AppView } from "../types";

type LayoutProps = {
  view: AppView;
  onChangeView: (view: AppView) => void;
  children: ReactNode;
};

type NavItem = { id: AppView; label: string; icon: typeof BarChart3 };

const emailNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "campaign", label: "Creador de Campaña", icon: MailPlus },
  { id: "templates", label: "Plantillas", icon: LayoutTemplate },
  { id: "assets", label: "Biblioteca de Activos", icon: FolderKanban }
];

const whatsappNav: NavItem[] = [
  { id: "whatsapp-templates", label: "Plantillas WhatsApp", icon: MessageSquareText },
  { id: "whatsapp-send", label: "Envíos WhatsApp", icon: Send }
];

// Sub-vistas que resaltan un item de navegación padre.
const activeFor: Partial<Record<AppView, AppView>> = {
  "template-editor": "templates",
  "whatsapp-template-editor": "whatsapp-templates"
};

function NavButton({
  item,
  active,
  onClick
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
        active ? "bg-primary text-white" : "text-text hover:bg-surface"
      }`}
    >
      <Icon size={18} />
      {item.label}
    </button>
  );
}

export default function Layout({ view, onChangeView, children }: LayoutProps) {
  const activeId = activeFor[view] ?? view;

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed left-0 top-0 h-screen w-[280px] overflow-y-auto border-r border-border bg-card p-6">
        <p className="font-heading text-xl font-bold text-primary">Disruptia Mailer</p>
        <p className="mt-1 text-sm text-text-muted">Version 1 interna</p>

        <nav className="mt-8 space-y-1">
          {emailNav.map((item) => (
            <NavButton key={item.id} item={item} active={activeId === item.id} onClick={() => onChangeView(item.id)} />
          ))}
        </nav>

        <p className="mt-7 mb-2 px-4 text-xs font-semibold uppercase tracking-wide text-text-muted">WhatsApp</p>
        <nav className="space-y-1">
          {whatsappNav.map((item) => (
            <NavButton key={item.id} item={item} active={activeId === item.id} onClick={() => onChangeView(item.id)} />
          ))}
        </nav>
      </aside>

      <div className="ml-[280px]">
        <header className="sticky top-0 z-10 border-b border-border bg-card px-8 py-4">
          <div className="flex items-center justify-end gap-4">
            <div className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Equipo Disruptia</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-8">{children}</main>
      </div>
    </div>
  );
}
