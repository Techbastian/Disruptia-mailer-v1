import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { deleteTemplate, saveTemplate } from "../lib/db";
import { generateTemplateHtml, pickBaseTemplate } from "../lib/ai";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import StickyActions from "../components/StickyActions";
import TestEmailBox from "../components/TestEmailBox";
import type { AssetItem, EmailTemplate, Project } from "../types";

type TemplateEditorViewProps = {
  initialTemplate: EmailTemplate | null;
  templates: EmailTemplate[];
  projects: Project[];
  assets: AssetItem[];
  initialDraft?: { html: string; projectId: string | null } | null;
  onCreateProject: (name: string) => Promise<Project>;
  onSaved: (template: EmailTemplate) => void;
  onDeleted: () => void;
  onCancel: () => void;
};

const VAR_NAME_REGEX = /^[a-z0-9_]+$/;

// El asunto es texto fijo: las variables no se sustituyen ahí (ver fase 0 del plan).
const SUBJECT_VAR_REGEX = /\{\{[^}]*\}\}/;

function extractTokens(html: string): string[] {
  const matches = [...html.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1].toLowerCase()))];
}

function VariablePill({
  name,
  onRemove
}: {
  name: string;
  onRemove: () => void;
}) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-semibold">
      {`{{${name}}}`}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full text-text-muted hover:text-error"
        aria-label={`Quitar ${name}`}
      >
        <X size={11} />
      </button>
    </span>
  );
}

function VariableSection({
  label,
  color,
  hint,
  variables,
  inputValue,
  onInputChange,
  onAdd,
  onRemove
}: {
  label: string;
  color: string;
  hint: string;
  variables: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-text-muted">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {variables.length === 0 && (
          <span className="text-xs text-text-muted italic">Sin variables declaradas</span>
        )}
        {variables.map((v) => (
          <VariablePill key={v} name={v} onRemove={() => onRemove(v)} />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1 py-1.5 text-sm"
          placeholder={`ej. ${color === "csv" ? "nombre" : "link_agenda"}`}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!VAR_NAME_REGEX.test(inputValue)}
          className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          <Plus size={13} />
          Agregar
        </button>
      </div>
    </div>
  );
}

export default function TemplateEditorView({
  initialTemplate,
  templates,
  projects,
  assets,
  initialDraft,
  onCreateProject,
  onSaved,
  onDeleted,
  onCancel
}: TemplateEditorViewProps) {
  const isEditing = initialTemplate !== null;

  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [subject, setSubject] = useState(initialTemplate?.subject ?? "");
  const [html, setHtml] = useState(initialTemplate?.html ?? initialDraft?.html ?? "");
  const [variablesCsv, setVariablesCsv] = useState<string[]>(initialTemplate?.variablesCsv ?? []);
  const [variablesCampaign, setVariablesCampaign] = useState<string[]>(initialTemplate?.variablesCampaign ?? []);
  const [projectId, setProjectId] = useState<string | null>(
    initialTemplate?.projectId ?? initialDraft?.projectId ?? null
  );
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [newCsvVar, setNewCsvVar] = useState("");
  const [newCampaignVar, setNewCampaignVar] = useState("");
  const [aiContent, setAiContent] = useState("");
  const [aiBaseProjectId, setAiBaseProjectId] = useState<string | null>(
    initialTemplate?.projectId ?? initialDraft?.projectId ?? null
  );
  const [aiBannerAssetId, setAiBannerAssetId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const imageAssets = useMemo(() => assets.filter((a) => a.kind === "image"), [assets]);

  // Molde de estilo: plantilla mas reciente del proyecto base (excluye la que se edita).
  const baseTemplate = useMemo(
    () => pickBaseTemplate(templates, aiBaseProjectId, initialTemplate?.id),
    [templates, aiBaseProjectId, initialTemplate?.id]
  );

  async function handleGenerate() {
    if (!aiContent.trim()) {
      setAiError("Escribí el contenido del correo para generar la plantilla.");
      return;
    }
    setAiError("");
    setGenerating(true);
    try {
      const bannerImageUrl = imageAssets.find((a) => a.id === aiBannerAssetId)?.publicUrl ?? null;
      const generated = await generateTemplateHtml({
        content: aiContent,
        variables: [...variablesCsv, ...variablesCampaign],
        baseProjectId: aiBaseProjectId,
        referenceTemplate: baseTemplate,
        bannerImageUrl
      });
      setHtml(generated);
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : "No fue posible generar la plantilla.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateProject() {
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    setSavingProject(true);
    setError("");
    try {
      const project = await onCreateProject(trimmed);
      setProjectId(project.id);
      setNewProjectName("");
      setCreatingProject(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible crear el proyecto.");
    } finally {
      setSavingProject(false);
    }
  }

  const allDeclared = useMemo(
    () => new Set([...variablesCsv, ...variablesCampaign]),
    [variablesCsv, variablesCampaign]
  );

  const undeclaredVars = useMemo(
    () => extractTokens(html).filter((t) => !allDeclared.has(t)),
    [html, allDeclared]
  );

  function addCsvVar() {
    if (!VAR_NAME_REGEX.test(newCsvVar)) return;
    if (allDeclared.has(newCsvVar)) return;
    setVariablesCsv((prev) => [...prev, newCsvVar]);
    setNewCsvVar("");
  }

  function addCampaignVar() {
    if (!VAR_NAME_REGEX.test(newCampaignVar)) return;
    if (allDeclared.has(newCampaignVar)) return;
    setVariablesCampaign((prev) => [...prev, newCampaignVar]);
    setNewCampaignVar("");
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("El nombre de la plantilla es obligatorio.");
      return;
    }
    if (!subject.trim()) {
      setError("El asunto es obligatorio: se usa en todos los envíos de esta plantilla.");
      return;
    }
    if (SUBJECT_VAR_REGEX.test(subject)) {
      setError("El asunto no admite variables {{...}}: es texto fijo para todos los destinatarios.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const result = await saveTemplate({
        id: initialTemplate?.id,
        name: name.trim(),
        description: description.trim(),
        subject: subject.trim(),
        html,
        variablesCsv,
        variablesCampaign,
        projectId
      });
      onSaved(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar la plantilla.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialTemplate) return;
    setDeleting(true);
    try {
      await deleteTemplate(initialTemplate.id);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible eliminar la plantilla.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-surface"
        >
          <ArrowLeft size={15} />
          Volver
        </button>
        <div>
          <h1 className="font-heading text-3xl font-bold">
            {isEditing ? "Editar plantilla" : "Nueva plantilla"}
          </h1>
          {isEditing && (
            <p className="mt-1 text-sm text-text-muted">
              Última edición: {new Date(initialTemplate.updatedAt).toLocaleString("es-CO")}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* ── Panel izquierdo: metadatos + variables ── */}
        <div className="space-y-4">
          <article className="card space-y-4">
            <div>
              <label className="block text-sm font-semibold">Nombre</label>
              <input
                className="input mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. Citación a entrevistas"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold">Asunto del correo</label>
              <input
                className="input mt-2"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="ej. Agendá tu espacio de conocimiento con Disruptia"
              />
              <p className="mt-1.5 text-xs text-text-muted">
                Se usa en todos los envíos de esta plantilla. Es texto fijo: no admite variables.
              </p>
              {SUBJECT_VAR_REGEX.test(subject) && (
                <p className="mt-1 text-xs font-semibold text-error">
                  El asunto no admite variables {"{{...}}"}. Si necesitás otro asunto, creá otra plantilla.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold">Descripción</label>
              <textarea
                className="input mt-2 min-h-[72px] resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Para qué sirve esta plantilla..."
              />
            </div>
          </article>

          <article className="card space-y-3">
            <div>
              <p className="font-heading font-semibold">Proyecto</p>
              <p className="text-xs text-text-muted">
                "General" la hace visible en todos los proyectos.
              </p>
            </div>

            {!creatingProject ? (
              <>
                <select
                  className="input"
                  value={projectId ?? ""}
                  onChange={(e) => setProjectId(e.target.value || null)}
                >
                  <option value="">General (todos los proyectos)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCreatingProject(true)}
                  className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  <Plus size={14} />
                  Crear proyecto nuevo
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input flex-1 py-1.5 text-sm"
                  placeholder="Nombre del proyecto"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleCreateProject()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleCreateProject()}
                  disabled={!newProjectName.trim() || savingProject}
                  className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-40"
                  aria-label="Confirmar proyecto"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingProject(false);
                    setNewProjectName("");
                  }}
                  className="flex items-center rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface"
                  aria-label="Cancelar"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </article>

          <article className="card space-y-5">
            <p className="font-heading font-semibold">Variables</p>

            <VariableSection
              label="Del CSV"
              color="csv"
              hint="Valores distintos por destinatario. Deben existir como columnas en el archivo."
              variables={variablesCsv}
              inputValue={newCsvVar}
              onInputChange={setNewCsvVar}
              onAdd={addCsvVar}
              onRemove={(v) => setVariablesCsv((prev) => prev.filter((x) => x !== v))}
            />

            <div className="border-t border-border" />

            <VariableSection
              label="De campaña"
              color="campaign"
              hint="Valores iguales para todos los destinatarios. El usuario los completa al crear la campaña."
              variables={variablesCampaign}
              inputValue={newCampaignVar}
              onInputChange={setNewCampaignVar}
              onAdd={addCampaignVar}
              onRemove={(v) => setVariablesCampaign((prev) => prev.filter((x) => x !== v))}
            />

            {undeclaredVars.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-yellow-600" />
                <div className="text-xs text-yellow-800">
                  <p className="font-semibold">Variables sin declarar en el HTML:</p>
                  <p className="mt-1">{undeclaredVars.map((v) => `{{${v}}}`).join(", ")}</p>
                  <p className="mt-1 text-yellow-700">Agrégalas arriba o quedarán vacías al enviar.</p>
                </div>
              </div>
            )}
          </article>

          {/* ── Acciones ── */}
          <div className="space-y-2">
            {error && <p className="text-sm text-error">{error}</p>}

            {isEditing && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-error/40 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/5"
              >
                <Trash2 size={14} />
                Eliminar plantilla
              </button>
            )}

            {confirmDelete && (
              <div className="rounded-lg border border-error/40 bg-error/5 p-3 space-y-2">
                <p className="text-sm font-semibold text-error">¿Seguro que querés eliminarla?</p>
                <p className="text-xs text-text-muted">Esta acción no se puede deshacer.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-error px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {deleting ? "Eliminando..." : "Sí, eliminar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-surface"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho: generador IA + editor HTML + preview ── */}
        <div className="space-y-4">
          <article className="card space-y-3 border border-primary/20 bg-primary/[0.03]">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <h2 className="font-heading text-sm font-semibold">Generar con IA</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold">Basar estilo en</label>
                <select
                  className="input mt-1 py-1.5 text-sm"
                  value={aiBaseProjectId ?? ""}
                  onChange={(e) => setAiBaseProjectId(e.target.value || null)}
                  disabled={generating}
                >
                  <option value="">General (marca)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold">Banner superior</label>
                <select
                  className="input mt-1 py-1.5 text-sm"
                  value={aiBannerAssetId}
                  onChange={(e) => setAiBannerAssetId(e.target.value)}
                  disabled={generating}
                >
                  <option value="">
                    {aiBaseProjectId ? "Conservar el del molde" : "Franja morada + texto"}
                  </option>
                  {imageAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-text-muted">
              {baseTemplate
                ? `Clonará la estructura e identidad de "${baseTemplate.name}". Escribí solo el contenido.`
                : "Base General: usará los lineamientos de marca Disruptia."}
            </p>

            <textarea
              className="input min-h-[110px] w-full resize-y text-sm"
              value={aiContent}
              onChange={(e) => setAiContent(e.target.value)}
              placeholder={"Contenido del correo, con las variables donde van. Ej:\n\nBuenas tardes {{nombre}}, este correo es una invitación a la entrevista del {{fecha}} a las {{hora}}. Confirmá tu asistencia con el botón."}
              disabled={generating}
            />
            {aiError && <p className="text-xs text-error">{aiError}</p>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-muted">
                Solo se comparte el contenido del correo. Nunca contactos.
              </span>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating || !aiContent.trim()}
                className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Sparkles size={14} />
                {generating ? "Generando..." : html ? "Regenerar" : "Generar HTML"}
              </button>
            </div>
          </article>

          <article className="card space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">HTML de la plantilla</label>
              <span className="text-xs text-text-muted">
                Usá <code className="rounded bg-surface px-1">{"{{nombre_variable}}"}</code> para insertar variables
              </span>
            </div>
            <textarea
              className="input min-h-[340px] w-full resize-y font-mono text-xs leading-relaxed"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="Pegá o escribí el HTML del correo aquí..."
              spellCheck={false}
            />
          </article>

          <article className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold">Preview</h2>
              <span className="text-xs text-text-muted">
                Las variables aparecen como <code className="rounded bg-surface px-1">{"{{texto}}"}</code> hasta que se envía
              </span>
            </div>
            <iframe
              title="Preview plantilla"
              srcDoc={html ? sanitizeHtml(html) : "<p style='padding:24px;color:#aaa;font-family:Arial'>El preview aparecerá aquí cuando agregues HTML.</p>"}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-[600px] w-full rounded-xl border border-border bg-white"
            />
          </article>

          <TestEmailBox
            getHtml={() => sanitizeHtml(html)}
            subject={subject.trim() || name.trim() || "Plantilla sin asunto"}
            hint="Probá cómo se ve la plantilla en una bandeja real antes de guardarla. Las variables llegan como tokens {{...}}."
            disabled={!html.trim()}
          />
        </div>
      </div>

      <StickyActions>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={15} />
          Volver
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-40"
        >
          <Save size={15} />
          {saving ? "Guardando..." : "Guardar plantilla"}
        </button>
      </StickyActions>
    </section>
  );
}
