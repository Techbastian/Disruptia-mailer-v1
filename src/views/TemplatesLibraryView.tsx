import { useState } from "react";
import { AlertTriangle, Clock, FilePlus, Pencil, RefreshCw, X } from "lucide-react";
import type { EmailTemplate } from "../types";

type TemplatesLibraryViewProps = {
  templates: EmailTemplate[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (id: string) => void;
  onNew: () => void;
};

function VariableBadge({ label, kind }: { label: string; kind: "csv" | "campaign" }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
        kind === "csv" ? "bg-primary/10 text-primary" : "bg-warning/15 text-yellow-700"
      }`}
    >
      {`{{${label}}}`}
    </span>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

function TemplateModal({
  template,
  onEdit,
  onClose
}: {
  template: EmailTemplate;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-bold">{template.name}</h2>
            {template.description && (
              <p className="mt-0.5 text-xs text-text-muted">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Pencil size={14} />
              Editar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text-primary"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 grid-cols-2">
          {/* Left: preview */}
          <div className="border-r border-border">
            <p className="border-b border-border px-4 py-2 text-xs font-semibold text-text-muted">
              Preview
            </p>
            <iframe
              title="Preview plantilla"
              srcDoc={template.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-full w-full bg-white"
              style={{ height: "calc(100% - 33px)" }}
            />
          </div>

          {/* Right: HTML code */}
          <div className="flex flex-col min-h-0">
            <p className="shrink-0 border-b border-border px-4 py-2 text-xs font-semibold text-text-muted">
              Código HTML
            </p>
            <div className="flex-1 overflow-auto bg-surface p-4">
              <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-text-muted">
                {template.html}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onClick
}: {
  template: EmailTemplate;
  onClick: () => void;
}) {
  const updatedAt = new Date(template.updatedAt).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  return (
    <article
      className="card group cursor-pointer overflow-hidden p-0 flex flex-col transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      {/* Preview con overlay hover */}
      <div className="relative h-48 w-full overflow-hidden rounded-t-xl bg-white">
        <div
          style={{
            width: "600px",
            height: "900px",
            transform: "scale(0.48)",
            transformOrigin: "top left",
            pointerEvents: "none",
            position: "absolute",
            top: 0,
            left: "50%",
            marginLeft: "-144px"
          }}
        >
          <iframe
            title="preview"
            srcDoc={template.html}
            sandbox="allow-popups"
            style={{ width: "600px", height: "900px", border: "none" }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-text-primary shadow">
            Ver plantilla
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-heading font-semibold leading-tight">{template.name}</h3>
          {template.description && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{template.description}</p>
          )}
        </div>

        {(template.variablesCsv.length > 0 || template.variablesCampaign.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {template.variablesCsv.map((v) => (
              <VariableBadge key={v} label={v} kind="csv" />
            ))}
            {template.variablesCampaign.map((v) => (
              <VariableBadge key={v} label={v} kind="campaign" />
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-1 text-xs text-text-muted">
          <Clock size={11} />
          <span>Editada {updatedAt}</span>
        </div>
      </div>
    </article>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function TemplatesLibraryView({
  templates,
  loading,
  error,
  onRetry,
  onEdit,
  onNew
}: TemplatesLibraryViewProps) {
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplate | null>(null);

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
          <p className="text-xs text-text-muted max-w-sm">
            Si el error menciona <strong>RLS</strong> o <strong>row-level security</strong>, ejecutá este SQL en el dashboard de Supabase:
            <code className="mt-1 block rounded bg-surface px-3 py-2 text-left font-mono leading-relaxed">
              ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;
            </code>
          </p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <LayoutTemplateIcon />
          <p className="font-heading font-semibold">Cargando plantillas...</p>
          <p className="text-sm text-text-muted">Conectando con Supabase y sembrando plantillas base.</p>
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <LayoutTemplateIcon />
          <p className="font-heading font-semibold">No hay plantillas todavía</p>
          <button type="button" onClick={onNew} className="btn-primary flex items-center gap-2">
            <FilePlus size={14} />
            Crear primera plantilla
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="flex gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-primary/40" />
            Variable CSV (del archivo)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-warning/60" />
            Variable de campaña (la llena el usuario)
          </span>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => setActiveTemplate(template)}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Plantillas</h1>
          <p className="mt-2 text-sm text-text-muted">
            Hacé clic en una plantilla para verla o editarla.
          </p>
        </div>
        <button type="button" onClick={onNew} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <FilePlus size={16} />
          Nueva plantilla
        </button>
      </div>

      {renderBody()}

      {activeTemplate && (
        <TemplateModal
          template={activeTemplate}
          onEdit={() => {
            onEdit(activeTemplate.id);
            setActiveTemplate(null);
          }}
          onClose={() => setActiveTemplate(null)}
        />
      )}
    </section>
  );
}

function LayoutTemplateIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    </div>
  );
}
