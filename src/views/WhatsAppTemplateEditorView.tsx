import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2, X } from "lucide-react";
import { deleteWhatsAppTemplate, saveWhatsAppTemplate } from "../lib/db";
import StickyActions from "../components/StickyActions";
import type { Project, WhatsAppButton, WhatsAppButtonType, WhatsAppCategory, WhatsAppTemplate } from "../types";

type Props = {
  initialTemplate: WhatsAppTemplate | null;
  projects: Project[];
  onSaved: (template: WhatsAppTemplate) => void;
  onDeleted: () => void;
  onCancel: () => void;
};

const CATEGORIES: WhatsAppCategory[] = ["MARKETING", "UTILITY", "AUTHENTICATION"];
const BUTTON_TYPES: WhatsAppButtonType[] = ["QUICK_REPLY", "URL", "PHONE_NUMBER"];
const NAME_REGEX = /^[a-z0-9_]+$/;

/** Devuelve los índices de variables posicionales {{1}} {{2}} presentes en el texto. */
export function extractWaVars(text: string): number[] {
  const matches = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
  return [...new Set(matches.map((m) => Number(m[1])))].sort((a, b) => a - b);
}

export function WhatsAppPreview({ template }: { template: WhatsAppTemplate }) {
  return (
    <div className="rounded-xl bg-[#e5ddd5] p-4">
      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] p-3 shadow-sm">
        {template.headerText && (
          <p className="mb-1 text-sm font-bold text-[#075e54]">{template.headerText}</p>
        )}
        <p className="whitespace-pre-wrap text-sm text-[#111b21]">
          {template.bodyText || <span className="italic text-text-muted">Cuerpo del mensaje…</span>}
        </p>
        {template.footerText && (
          <p className="mt-1.5 text-xs text-[#667781]">{template.footerText}</p>
        )}
      </div>
      {template.buttons.length > 0 && (
        <div className="mt-1 space-y-1">
          {template.buttons.map((b, i) => (
            <div
              key={i}
              className="rounded-lg bg-white py-2 text-center text-sm font-semibold text-[#00a5f4] shadow-sm"
            >
              {b.text || "Botón"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppTemplateEditorView({ initialTemplate, projects, onSaved, onDeleted, onCancel }: Props) {
  const isEditing = initialTemplate !== null;

  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [language, setLanguage] = useState(initialTemplate?.language ?? "es");
  const [category, setCategory] = useState<WhatsAppCategory>(initialTemplate?.category ?? "MARKETING");
  const [headerText, setHeaderText] = useState(initialTemplate?.headerText ?? "");
  const [bodyText, setBodyText] = useState(initialTemplate?.bodyText ?? "");
  const [footerText, setFooterText] = useState(initialTemplate?.footerText ?? "");
  const [buttons, setButtons] = useState<WhatsAppButton[]>(initialTemplate?.buttons ?? []);
  const [projectId, setProjectId] = useState<string | null>(initialTemplate?.projectId ?? null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const vars = useMemo(() => extractWaVars(`${headerText} ${bodyText}`), [headerText, bodyText]);

  const draft: WhatsAppTemplate = {
    id: initialTemplate?.id ?? "preview",
    name,
    language,
    category,
    headerText,
    bodyText,
    footerText,
    buttons,
    projectId,
    createdAt: initialTemplate?.createdAt ?? "",
    updatedAt: initialTemplate?.updatedAt ?? ""
  };

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons((prev) => [...prev, { type: "QUICK_REPLY", text: "" }]);
  }

  function updateButton(idx: number, patch: Partial<WhatsAppButton>) {
    setButtons((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  async function handleSave() {
    if (!NAME_REGEX.test(name)) {
      setError("El nombre debe coincidir con el de YCloud: solo minúsculas, números y guion bajo.");
      return;
    }
    if (!bodyText.trim()) {
      setError("El cuerpo del mensaje es obligatorio.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const result = await saveWhatsAppTemplate({
        id: initialTemplate?.id,
        name: name.trim(),
        language: language.trim(),
        category,
        headerText: headerText.trim(),
        bodyText,
        footerText: footerText.trim(),
        buttons: buttons.filter((b) => b.text.trim()),
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
      await deleteWhatsAppTemplate(initialTemplate.id);
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
            {isEditing ? "Editar plantilla WhatsApp" : "Nueva plantilla WhatsApp"}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Reflejá aquí una plantilla ya <strong>aprobada en YCloud/Meta</strong>. El nombre y el idioma deben
            coincidir exactamente.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Formulario */}
        <div className="space-y-4">
          <article className="card grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold">Nombre (exacto de YCloud)</label>
              <input
                className="input mt-1.5"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="invitacion_entrevista"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold">Idioma</label>
              <input
                className="input mt-1.5"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="es"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold">Categoría</label>
              <select className="input mt-1.5" value={category} onChange={(e) => setCategory(e.target.value as WhatsAppCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold">Proyecto</label>
              <select
                className="input mt-1.5"
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
              <p className="mt-1 text-xs text-text-muted">
                Los envíos hechos con esta plantilla quedan atribuidos a este proyecto en el historial.
              </p>
            </div>
          </article>

          <article className="card space-y-4">
            <div>
              <label className="block text-sm font-semibold">Encabezado (opcional)</label>
              <input
                className="input mt-1.5"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Texto del header, si la plantilla lo tiene"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold">Cuerpo</label>
              <textarea
                className="input mt-1.5 min-h-[140px] resize-y text-sm"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Hola {{1}}, te invitamos a la entrevista del {{2}}. Confirmá tu asistencia."
              />
              <p className="mt-1 text-xs text-text-muted">
                Usá variables posicionales <code className="rounded bg-surface px-1">{"{{1}}"}</code>,{" "}
                <code className="rounded bg-surface px-1">{"{{2}}"}</code>… igual que en Meta.
                {vars.length > 0 && (
                  <>
                    {" "}
                    Detectadas: <strong>{vars.map((n) => `{{${n}}}`).join(", ")}</strong>.
                  </>
                )}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold">Pie de página (opcional)</label>
              <input
                className="input mt-1.5"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Equipo Disruptia"
              />
            </div>
          </article>

          <article className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-heading font-semibold">Botones (opcional)</p>
              <button
                type="button"
                onClick={addButton}
                disabled={buttons.length >= 3}
                className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                <Plus size={13} />
                Agregar
              </button>
            </div>
            {buttons.length === 0 && <p className="text-xs text-text-muted italic">Sin botones.</p>}
            {buttons.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="input w-40 py-1.5 text-sm"
                  value={b.type}
                  onChange={(e) => updateButton(i, { type: e.target.value as WhatsAppButtonType })}
                >
                  {BUTTON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  className="input flex-1 py-1.5 text-sm"
                  value={b.text}
                  onChange={(e) => updateButton(i, { text: e.target.value })}
                  placeholder="Texto del botón"
                />
                <button
                  type="button"
                  onClick={() => setButtons((prev) => prev.filter((_, x) => x !== i))}
                  className="rounded-lg border border-border p-2 text-text-muted hover:text-error"
                  aria-label="Quitar botón"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </article>

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
              <div className="space-y-2 rounded-lg border border-error/40 bg-error/5 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-error">
                  <AlertTriangle size={15} /> ¿Seguro que querés eliminarla?
                </p>
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

        {/* Preview */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Vista previa</p>
          <WhatsAppPreview template={draft} />
          <p className="text-xs text-text-muted">
            Las variables se muestran como <code className="rounded bg-surface px-1">{"{{n}}"}</code> hasta que se
            asignan al crear un envío.
          </p>
        </div>
      </div>

      <StickyActions>
        <button type="button" onClick={onCancel} className="btn-secondary flex items-center gap-2">
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
