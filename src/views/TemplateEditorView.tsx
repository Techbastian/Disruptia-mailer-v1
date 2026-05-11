import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2, X } from "lucide-react";
import { deleteTemplate, saveTemplate } from "../lib/db";
import type { EmailTemplate } from "../types";

type TemplateEditorViewProps = {
  initialTemplate: EmailTemplate | null;
  onSaved: (template: EmailTemplate) => void;
  onDeleted: () => void;
  onCancel: () => void;
};

const VAR_NAME_REGEX = /^[a-z0-9_]+$/;

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
  onSaved,
  onDeleted,
  onCancel
}: TemplateEditorViewProps) {
  const isEditing = initialTemplate !== null;

  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [html, setHtml] = useState(initialTemplate?.html ?? "");
  const [variablesCsv, setVariablesCsv] = useState<string[]>(initialTemplate?.variablesCsv ?? []);
  const [variablesCampaign, setVariablesCampaign] = useState<string[]>(initialTemplate?.variablesCampaign ?? []);
  const [newCsvVar, setNewCsvVar] = useState("");
  const [newCampaignVar, setNewCampaignVar] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

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
    setError("");
    setSaving(true);
    try {
      const result = await saveTemplate({
        id: initialTemplate?.id,
        name: name.trim(),
        description: description.trim(),
        html,
        variablesCsv,
        variablesCampaign
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
              <label className="block text-sm font-semibold">Descripción</label>
              <textarea
                className="input mt-2 min-h-[72px] resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Para qué sirve esta plantilla..."
              />
            </div>
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

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              <Save size={15} />
              {saving ? "Guardando..." : "Guardar plantilla"}
            </button>

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

        {/* ── Panel derecho: editor HTML + preview ── */}
        <div className="space-y-4">
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
              srcDoc={html || "<p style='padding:24px;color:#aaa;font-family:Arial'>El preview aparecerá aquí cuando agregues HTML.</p>"}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-[600px] w-full rounded-xl border border-border bg-white"
            />
          </article>
        </div>
      </div>
    </section>
  );
}
