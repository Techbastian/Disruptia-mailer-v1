import { useMemo, useState } from "react";
import { AlertTriangle, Clock, FilePlus, FolderKanban, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import type { AssetItem, EmailTemplate, Project } from "../types";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { generateTemplateHtml, pickBaseTemplate } from "../lib/ai";

type TemplatesLibraryViewProps = {
  templates: EmailTemplate[];
  projects: Project[];
  assets: AssetItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (id: string) => void;
  onNew: () => void;
  onAssignProject: (templateId: string, projectId: string | null) => Promise<EmailTemplate>;
  onAiDraftReady: (draft: { html: string; projectId: string | null }) => void;
};

// "all" = todas | "general" = solo agnosticas | <id> = proyecto (incluye General)
type ProjectFilter = "all" | "general" | string;

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
  projects,
  onAssignProject,
  onEdit,
  onClose
}: {
  template: EmailTemplate;
  projects: Project[];
  onAssignProject: (projectId: string | null) => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [assigning, setAssigning] = useState(false);

  async function handleAssign(value: string) {
    setAssigning(true);
    try {
      await onAssignProject(value || null);
    } finally {
      setAssigning(false);
    }
  }

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
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
              Proyecto:
              <select
                className="input py-1.5 text-sm"
                value={template.projectId ?? ""}
                disabled={assigning}
                onChange={(e) => void handleAssign(e.target.value)}
              >
                <option value="">General</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
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
              srcDoc={sanitizeHtml(template.html)}
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
            srcDoc={sanitizeHtml(template.html)}
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

// ── Filtro por proyecto ───────────────────────────────────────────────────────

function ProjectFilterBar({
  projects,
  filter,
  onChange,
  counts
}: {
  projects: Project[];
  filter: ProjectFilter;
  onChange: (filter: ProjectFilter) => void;
  counts: { all: number; general: number };
}) {
  const chip = (value: ProjectFilter, label: string, count?: number) => (
    <button
      key={value}
      type="button"
      onClick={() => onChange(value)}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        filter === value
          ? "bg-primary text-white"
          : "border border-border text-text-muted hover:bg-surface"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`text-xs ${filter === value ? "text-white/70" : "text-text-muted"}`}>{count}</span>
      )}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chip("all", "Todas", counts.all)}
      {chip("general", "General", counts.general)}
      {projects.length > 0 && <span className="mx-1 h-5 w-px bg-border" />}
      {projects.map((p) => chip(p.id, p.name))}
    </div>
  );
}

// ── Crear con IA ──────────────────────────────────────────────────────────────

function CreateWithAiModal({
  templates,
  projects,
  assets,
  onReady,
  onClose
}: {
  templates: EmailTemplate[];
  projects: Project[];
  assets: AssetItem[];
  onReady: (draft: { html: string; projectId: string | null }) => void;
  onClose: () => void;
}) {
  const [baseProjectId, setBaseProjectId] = useState<string | null>(null);
  const [saveProjectId, setSaveProjectId] = useState<string | null>(null);
  const [bannerAssetId, setBannerAssetId] = useState<string>("");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const imageAssets = useMemo(() => assets.filter((a) => a.kind === "image"), [assets]);
  const baseTemplate = useMemo(
    () => pickBaseTemplate(templates, baseProjectId),
    [templates, baseProjectId]
  );

  async function handleGenerate() {
    if (!content.trim()) {
      setError("Escribí el contenido del correo para generar la plantilla.");
      return;
    }
    setError("");
    setGenerating(true);
    try {
      const bannerImageUrl = imageAssets.find((a) => a.id === bannerAssetId)?.publicUrl ?? null;
      const html = await generateTemplateHtml({
        content,
        variables: [],
        baseProjectId,
        referenceTemplate: baseTemplate,
        bannerImageUrl
      });
      onReady({ html, projectId: saveProjectId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible generar la plantilla.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h2 className="font-heading text-lg font-bold">Crear plantilla con IA</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold">Basar estilo en</label>
            <select
              className="input mt-1.5"
              value={baseProjectId ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setBaseProjectId(v);
                setSaveProjectId(v);
              }}
              disabled={generating}
            >
              <option value="">General (marca Disruptia)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold">Guardar en proyecto</label>
            <select
              className="input mt-1.5"
              value={saveProjectId ?? ""}
              onChange={(e) => setSaveProjectId(e.target.value || null)}
              disabled={generating}
            >
              <option value="">General</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {baseTemplate
            ? `Clonará la estructura e identidad de "${baseTemplate.name}" (la más reciente del proyecto).`
            : "Base General: usará los lineamientos de marca Disruptia."}
        </p>

        <label className="mt-4 block text-sm font-semibold">Banner superior</label>
        <select
          className="input mt-1.5"
          value={bannerAssetId}
          onChange={(e) => setBannerAssetId(e.target.value)}
          disabled={generating}
        >
          <option value="">
            {baseProjectId ? "Sin banner (conservar el del molde)" : "Sin banner (franja morada + texto)"}
          </option>
          {imageAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-muted">
          {baseProjectId
            ? "Imagen de la Biblioteca de Activos para el banner superior."
            : "Para General: elegí el logo de la Biblioteca; irá sobre una franja morada."}
        </p>

        <label className="mt-4 block text-sm font-semibold">Contenido del correo</label>
        <textarea
          className="input mt-1.5 min-h-[130px] w-full resize-y text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"Escribí el texto real del correo, con las variables donde van. Ej:\n\nBuenas tardes {{nombre}},\n\nEste correo es una invitación a la jornada del {{fecha}} en {{lugar}}. Confirmá tu asistencia con el botón."}
          disabled={generating}
          autoFocus
        />

        {error && <p className="mt-2 text-sm text-error">{error}</p>}
        <p className="mt-2 text-[11px] text-text-muted">
          Solo se comparte el contenido del correo. Nunca contactos ni listas. Las variables se declaran luego en el editor.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating || !content.trim()}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Sparkles size={14} />
            {generating ? "Generando..." : "Generar y abrir editor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function TemplatesLibraryView({
  templates,
  projects,
  assets,
  loading,
  error,
  onRetry,
  onEdit,
  onNew,
  onAssignProject,
  onAiDraftReady
}: TemplatesLibraryViewProps) {
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplate | null>(null);
  const [creatingWithAi, setCreatingWithAi] = useState(false);
  const [filter, setFilter] = useState<ProjectFilter>("all");

  const GENERAL_KEY = "__general__";

  // Particion en secciones: General + una por proyecto. Cada plantilla aparece una sola vez.
  // "all" → todas las secciones; "general" → solo General; <projectId> → solo ese proyecto.
  const sections = useMemo(() => {
    const nameOf = new Map(projects.map((p) => [p.id, p.name]));
    const groups = new Map<string, { key: string; title: string; templates: EmailTemplate[] }>();

    for (const t of templates) {
      const key = t.projectId ?? GENERAL_KEY;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: t.projectId ? nameOf.get(t.projectId) ?? "Proyecto" : "General",
          templates: []
        });
      }
      groups.get(key)!.templates.push(t);
    }

    let arr = [...groups.values()].sort((a, b) => {
      if (a.key === GENERAL_KEY) return -1;
      if (b.key === GENERAL_KEY) return 1;
      return a.title.localeCompare(b.title);
    });

    if (filter === "general") arr = arr.filter((g) => g.key === GENERAL_KEY);
    else if (filter !== "all") arr = arr.filter((g) => g.key === filter);

    return arr;
  }, [templates, projects, filter]);

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
        <ProjectFilterBar
          projects={projects}
          filter={filter}
          onChange={setFilter}
          counts={{
            all: templates.length,
            general: templates.filter((t) => t.projectId === null).length
          }}
        />

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

        {sections.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FolderKanban size={20} className="text-text-muted" />
            <p className="font-heading font-semibold">No hay plantillas en este filtro</p>
            <p className="text-sm text-text-muted">
              Este proyecto todavía no tiene plantillas asignadas.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.key} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <FolderKanban size={16} className="text-text-muted" />
                  <h2 className="font-heading text-lg font-semibold">{section.title}</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-text-muted">
                    {section.templates.length}
                  </span>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {section.templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => setActiveTemplate(template)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreatingWithAi(true)}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap"
          >
            <Sparkles size={16} />
            Crear con IA
          </button>
          <button type="button" onClick={onNew} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <FilePlus size={16} />
            Nueva plantilla
          </button>
        </div>
      </div>

      {renderBody()}

      {creatingWithAi && (
        <CreateWithAiModal
          templates={templates}
          projects={projects}
          assets={assets}
          onReady={(draft) => {
            setCreatingWithAi(false);
            onAiDraftReady(draft);
          }}
          onClose={() => setCreatingWithAi(false)}
        />
      )}

      {activeTemplate && (
        <TemplateModal
          template={activeTemplate}
          projects={projects}
          onAssignProject={async (projectId) => {
            const updated = await onAssignProject(activeTemplate.id, projectId);
            setActiveTemplate(updated);
          }}
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
