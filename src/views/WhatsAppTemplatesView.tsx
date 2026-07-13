import { AlertTriangle, FilePlus, FolderKanban, Globe, RefreshCw, Tag } from "lucide-react";
import type { Project, WhatsAppTemplate } from "../types";
import { WhatsAppPreview } from "./WhatsAppTemplateEditorView";

type Props = {
  templates: WhatsAppTemplate[];
  projects: Project[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (id: string) => void;
  onNew: () => void;
};

function TemplateCard({
  template,
  projectName,
  onEdit
}: {
  template: WhatsAppTemplate;
  projectName: string;
  onEdit: () => void;
}) {
  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading font-semibold leading-tight">{template.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Globe size={11} /> {template.language}
            </span>
            <span className="flex items-center gap-1">
              <Tag size={11} /> {template.category}
            </span>
            <span className="flex items-center gap-1">
              <FolderKanban size={11} /> {projectName}
            </span>
          </div>
        </div>
        <button type="button" onClick={onEdit} className="btn-secondary px-3 py-1.5 text-xs">
          Editar
        </button>
      </div>
      <WhatsAppPreview template={template} />
    </article>
  );
}

export default function WhatsAppTemplatesView({ templates, projects, loading, error, onRetry, onEdit, onNew }: Props) {
  function renderBody() {
    if (error) {
      return (
        <div className="card flex flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-error/10">
            <AlertTriangle size={22} className="text-error" />
          </div>
          <div>
            <p className="font-heading font-semibold text-error">No se pudieron cargar las plantillas</p>
            <p className="mt-2 max-w-md text-sm text-text-muted">{error}</p>
          </div>
          <button type="button" onClick={onRetry} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} />
            Reintentar
          </button>
          <p className="max-w-sm text-xs text-text-muted">
            Si el error menciona <strong>relation</strong> o <strong>does not exist</strong>, falta correr la
            migración <code className="rounded bg-surface px-1">db/migrations/0002_whatsapp_templates.sql</code>.
          </p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="font-heading font-semibold">Cargando plantillas…</p>
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="font-heading font-semibold">No hay plantillas de WhatsApp todavía</p>
          <p className="max-w-md text-sm text-text-muted">
            Registrá aquí las plantillas que ya tenés aprobadas en YCloud para poder usarlas en los envíos.
          </p>
          <button type="button" onClick={onNew} className="btn-primary flex items-center gap-2">
            <FilePlus size={14} />
            Registrar primera plantilla
          </button>
        </div>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            projectName={projects.find((p) => p.id === t.projectId)?.name ?? "General"}
            onEdit={() => onEdit(t.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Plantillas WhatsApp</h1>
          <p className="mt-2 text-sm text-text-muted">
            Reflejo de tus plantillas HSM aprobadas en YCloud. El envío real usa estos nombres.
          </p>
        </div>
        <button type="button" onClick={onNew} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <FilePlus size={16} />
          Nueva plantilla
        </button>
      </div>
      {renderBody()}
    </section>
  );
}
