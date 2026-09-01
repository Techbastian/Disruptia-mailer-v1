import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet, Send, Trash2 } from "lucide-react";
import FileDropzone from "../components/FileDropzone";
import StatCard from "../components/StatCard";
import StickyActions from "../components/StickyActions";
import ProjectFilterBar, { type ProjectFilter } from "../components/ProjectFilterBar";
import TestEmailBox from "../components/TestEmailBox";
import { parseContactsFile, type InvalidRow } from "../lib/csv";
import { runDispatcher } from "../lib/api";
import {
  addCampaignRecipients,
  createCampaign,
  createCampaignRun,
  getCampaignDispatchData
} from "../lib/db";
import { DAILY_EMAIL_LIMIT, getRemainingDailyQuota } from "../lib/dispatch";
import { downloadEmailCampaignReport } from "../lib/report";
import { downloadContactsExcelTemplate } from "../lib/excelTemplate";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { useMailerStore, isDraftActive } from "../store/useMailerStore";
import type { CampaignHistoryItem, CampaignMetrics, ContactRecord, EmailTemplate, Project } from "../types";

type CampaignCreatorViewProps = {
  templates: EmailTemplate[];
  projects: Project[];
  initialTemplateId?: string | null;
  onCampaignCreated: (campaign: CampaignHistoryItem) => void;
  onEditTemplate: (id: string) => void;
};

function substituteVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key: string) => {
    return vars[key.toLowerCase()] ?? match;
  });
}

const EMPTY_METRICS: CampaignMetrics = {
  totalLoaded: 0,
  validEmails: 0,
  invalidEmails: 0,
  duplicatesRemoved: 0
};

const STEP_LABELS = ["Estructura", "Destinatarios", "Confirmar"];

function StepBar({ current }: { current: number }) {
  return (
    <nav className="flex flex-wrap items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                active ? "bg-primary text-white" : done ? "text-primary" : "text-text-muted"
              }`}
            >
              {done ? (
                <CheckCircle2 size={16} />
              ) : (
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${
                    active ? "border-white text-white" : "border-current"
                  }`}
                >
                  {step}
                </span>
              )}
              {label}
            </div>
            {i < STEP_LABELS.length - 1 && (
              <ChevronRight size={16} className="mx-1 shrink-0 text-text-muted/40" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── Step 1: Template selection + campaign vars ──────────────────────────────
// El asunto NO se edita acá: es un dato de la plantilla (se cambia en su editor).

function Step1({
  templates,
  projects,
  selectedId,
  campaignVars,
  onSelect,
  onEditTemplate,
  onVarsChange,
  onNext
}: {
  templates: EmailTemplate[];
  projects: Project[];
  selectedId: string | null;
  campaignVars: Record<string, string>;
  onSelect: (id: string) => void;
  onEditTemplate: (id: string) => void;
  onVarsChange: (vars: Record<string, string>) => void;
  onNext: () => void;
}) {
  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");

  // Las plantillas "General" son agnósticas: también se ven al filtrar por un proyecto.
  const visibleTemplates = useMemo(() => {
    if (projectFilter === "all") return templates;
    if (projectFilter === "general") return templates.filter((t) => t.projectId === null);
    return templates.filter((t) => t.projectId === projectFilter || t.projectId === null);
  }, [templates, projectFilter]);

  // Plantilla anterior a la migración 0007: sin asunto no se puede enviar.
  const missingSubject = selected !== null && selected.subject.trim().length === 0;

  const canContinue =
    selected !== null &&
    !missingSubject &&
    selected.variablesCampaign.every((v) => (campaignVars[v] ?? "").trim().length > 0);

  return (
    <div className="space-y-6">
      {/* La configuración del envío va arriba: al elegir plantilla queda a la vista. */}
      {selected && (
        <article className="card space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold">Asunto del correo</label>
              <button
                type="button"
                onClick={() => onEditTemplate(selected.id)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Editar en la plantilla
              </button>
            </div>
            {missingSubject ? (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-yellow-600" />
                <p className="text-xs text-yellow-800">
                  Esta plantilla no tiene asunto definido. Editala en Plantillas y agregale uno antes de enviar.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold">
                  {selected.subject}
                </p>
                <p className="mt-1.5 text-xs text-text-muted">
                  Viene de la plantilla y es igual en todos sus envíos. Para otro asunto, usá otra plantilla.
                </p>
              </>
            )}
          </div>

          {selected.variablesCampaign.length > 0 && (
            <div className="space-y-4 border-t border-border pt-4">
              <div>
                <p className="font-heading font-semibold">Variables de campaña</p>
                <p className="mt-1 text-xs text-text-muted">Estos valores son iguales para todos los destinatarios.</p>
              </div>
              {selected.variablesCampaign.map((varName) => (
                <div key={varName}>
                  <label className="block text-sm font-semibold">
                    <code className="rounded bg-surface px-1.5 py-0.5 text-xs">{`{{${varName}}}`}</code>
                  </label>
                  <input
                    className="input mt-2"
                    value={campaignVars[varName] ?? ""}
                    onChange={(e) => onVarsChange({ ...campaignVars, [varName]: e.target.value })}
                    placeholder={`Valor para ${varName}...`}
                  />
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      <div className="space-y-4">
        <ProjectFilterBar
          projects={projects}
          filter={projectFilter}
          onChange={setProjectFilter}
          counts={{
            all: templates.length,
            general: templates.filter((t) => t.projectId === null).length
          }}
        />

        {templates.length === 0 ? (
          <div className="card py-14 text-center text-sm text-text-muted">
            No hay plantillas disponibles. Creá una desde la sección Plantillas.
          </div>
        ) : visibleTemplates.length === 0 ? (
          <div className="card py-14 text-center text-sm text-text-muted">
            Este proyecto no tiene plantillas. Probá con otro filtro o creá una en la sección Plantillas.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleTemplates.map((t) => (
              <article
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`card cursor-pointer overflow-hidden p-0 transition-all ${
                  selectedId === t.id ? "ring-2 ring-primary ring-offset-2" : "hover:shadow-md"
                }`}
              >
                <div className="relative h-40 w-full overflow-hidden bg-white">
                  <div
                    style={{
                      width: "600px",
                      height: "900px",
                      transform: "scale(0.43)",
                      transformOrigin: "top left",
                      pointerEvents: "none",
                      position: "absolute",
                      top: 0,
                      left: "50%",
                      marginLeft: "-129px"
                    }}
                  >
                    <iframe
                      title={t.name}
                      srcDoc={sanitizeHtml(t.html)}
                      sandbox="allow-popups"
                      style={{ width: "600px", height: "900px", border: "none" }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 p-3">
                  <p className="text-sm font-semibold leading-tight">{t.name}</p>
                  {t.variablesCsv.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.variablesCsv.map((v) => (
                        <span key={v} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <StickyActions>
        <span />
        <button type="button" onClick={onNext} disabled={!canContinue} className="btn-primary disabled:opacity-40">
          Continuar con destinatarios →
        </button>
      </StickyActions>
    </div>
  );
}

// ── Step 2: Upload CSV/XLSX (with Excel guide for the chosen template) ───────

function Step2({
  template,
  contacts,
  metrics,
  columnNames,
  invalidRows,
  contactsDropped,
  onFileLoaded,
  onNext,
  onBack
}: {
  template: EmailTemplate;
  contacts: ContactRecord[];
  metrics: CampaignMetrics;
  columnNames: string[];
  invalidRows: InvalidRow[];
  contactsDropped: boolean;
  onFileLoaded: (
    contacts: ContactRecord[],
    metrics: CampaignMetrics,
    columnNames: string[],
    invalidRows: InvalidRow[]
  ) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const hasContacts = contacts.length > 0;
  const overLimit = contacts.length > DAILY_EMAIL_LIMIT;

  const missingColumns = useMemo(() => {
    if (!hasContacts) return [];
    return template.variablesCsv.filter((v) => !columnNames.includes(v));
  }, [template, columnNames, hasContacts]);

  const canContinue = hasContacts && missingColumns.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 p-4">
        <p className="text-sm text-text-muted">
          ¿La lista todavía no existe? Descargá el Excel guía con las columnas que "{template.name}" necesita.
        </p>
        <button
          type="button"
          onClick={() => downloadContactsExcelTemplate(template)}
          className="btn-secondary flex shrink-0 items-center gap-2 text-sm"
        >
          <FileSpreadsheet size={14} />
          Descargar Excel guía
        </button>
      </div>

      {contactsDropped && !hasContacts && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            El borrador se recuperó, pero la lista de contactos era demasiado grande para guardarse en el navegador.
            Volvé a subir el archivo; el resto de la campaña sigue como la dejaste.
          </p>
        </div>
      )}

      <FileDropzone
        subtitle={`Archivos CSV o XLSX — columnas esperadas: ${[...new Set(["email", "nombre", ...template.variablesCsv])].join(", ")}`}
        onFile={async (file) => {
          const result = await parseContactsFile(file);
          onFileLoaded(result.contacts, result.metrics, result.columnNames, result.invalidRows);
        }}
      />

      {hasContacts && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total" value={metrics.totalLoaded} />
            <StatCard label="Válidos" value={metrics.validEmails} tone="primary" />
            <StatCard label="Inválidos" value={metrics.invalidEmails} tone={metrics.invalidEmails > 0 ? "warning" : undefined} />
            <StatCard label="Duplicados" value={metrics.duplicatesRemoved} tone={metrics.duplicatesRemoved > 0 ? "warning" : undefined} />
          </div>

          {columnNames.length > 0 && (
            <div className="rounded-xl bg-surface p-4">
              <p className="mb-2 text-xs font-semibold text-text-muted">Columnas detectadas</p>
              <div className="flex flex-wrap gap-1.5">
                {columnNames.map((col) => (
                  <span key={col} className="rounded-full border border-border bg-background px-2.5 py-1 font-mono text-xs">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {missingColumns.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-error/40 bg-error/5 p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
              <div className="text-sm text-error">
                <p className="font-semibold">Columnas faltantes en el archivo</p>
                <p className="mt-1 text-xs">
                  La plantilla "{template.name}" requiere: {missingColumns.map((c) => `{{${c}}}`).join(", ")}. Estas
                  columnas no están en el archivo subido.
                </p>
                <p className="mt-1 text-xs text-error/70">
                  Subí un archivo con estas columnas (usá el Excel guía) o volvé y elegí otra plantilla.
                </p>
              </div>
            </div>
          )}

          {overLimit && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-600" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">
                  Más de {DAILY_EMAIL_LIMIT} contactos: el envío saldrá en lotes diarios
                </p>
                <p className="mt-1 text-xs text-yellow-700">
                  Tenés {contacts.length} contactos válidos. Hoy sale el primer lote (según el cupo global de{" "}
                  {DAILY_EMAIL_LIMIT}/día entre todas las campañas) y el resto queda pendiente para despachar desde el
                  Dashboard con "Enviar lote".
                </p>
              </div>
            </div>
          )}

          {invalidRows.length > 0 && (
            <details className="rounded-xl border border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-muted hover:text-text-primary">
                Ver {invalidRows.length} filas descartadas
              </summary>
              <div className="border-t border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface">
                      <th className="px-4 py-2 text-left font-medium text-text-muted">Fila</th>
                      <th className="px-4 py-2 text-left font-medium text-text-muted">Email</th>
                      <th className="px-4 py-2 text-left font-medium text-text-muted">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invalidRows.slice(0, 50).map((row) => (
                      <tr key={row.rowNumber} className="border-t border-border/50">
                        <td className="px-4 py-2 text-text-muted">{row.rowNumber}</td>
                        <td className="px-4 py-2 font-mono">{row.email}</td>
                        <td className="px-4 py-2 text-error">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}

      <StickyActions>
        <button type="button" onClick={onBack} className="btn-secondary">
          ← Volver
        </button>
        <button type="button" onClick={onNext} disabled={!canContinue} className="btn-primary disabled:opacity-40">
          Continuar a confirmar →
        </button>
      </StickyActions>
    </div>
  );
}

// ── Step 3: Summary + confirm send ───────────────────────────────────────────

function Step3({
  template,
  contacts,
  subject,
  campaignVars,
  title,
  sending,
  onTitleChange,
  onBack,
  onConfirm
}: {
  template: EmailTemplate;
  contacts: ContactRecord[];
  subject: string;
  campaignVars: Record<string, string>;
  title: string;
  sending: boolean;
  onTitleChange: (title: string) => void;
  onBack: () => void;
  onConfirm: (title: string) => Promise<void>;
}) {
  const [error, setError] = useState("");

  const previewHtml = useMemo(
    () => sanitizeHtml(substituteVars(template.html, campaignVars)),
    [template.html, campaignVars]
  );

  const recipientCount = contacts.length;

  async function handleSend() {
    if (!title.trim()) {
      setError("El título de la campaña es obligatorio.");
      return;
    }
    setError("");
    try {
      await onConfirm(title.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar la campaña.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card py-4 text-center">
          <p className="text-sm text-text-muted">Destinatarios</p>
          <p className="mt-1 text-2xl font-bold text-primary">{recipientCount}</p>
          {contacts.length > DAILY_EMAIL_LIMIT && (
            <p className="mt-1 text-xs text-text-muted">en lotes de hasta {DAILY_EMAIL_LIMIT}/día</p>
          )}
        </div>
        <div className="card py-4 text-center">
          <p className="text-sm text-text-muted">Plantilla</p>
          <p className="mt-1 text-sm font-bold leading-tight">{template.name}</p>
        </div>
        <div className="card py-4 text-center">
          <p className="text-sm text-text-muted">Asunto</p>
          <p className="mt-1 text-sm font-bold leading-tight">{subject}</p>
        </div>
      </div>

      <article className="card space-y-3">
        <div>
          <label className="block text-sm font-semibold">Título de la campaña</label>
          <p className="text-xs text-text-muted mt-0.5">Nombre interno para identificar esta campaña en el historial.</p>
          <input
            className="input mt-2"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="ej. Citación entrevistas — Mayo 2026"
          />
        </div>
      </article>

      <article className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold">Preview final</h2>
          <span className="text-xs text-text-muted">
            Variables de campaña reemplazadas · Variables CSV permanecen como tokens para N8N
          </span>
        </div>
        <iframe
          title="Preview final"
          srcDoc={previewHtml}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className="h-[560px] w-full rounded-xl border border-border bg-white"
        />
      </article>

      <TestEmailBox
        getHtml={() => previewHtml}
        subject={subject}
        sampleContact={contacts[0] ?? null}
        hint="Recibí este correo antes de aprobar el envío masivo. Usa los datos del primer contacto del archivo para las variables. No crea una campaña."
        disabled={sending}
      />

      {error && <p className="text-sm text-error">{error}</p>}

      <StickyActions>
        <button type="button" onClick={onBack} disabled={sending} className="btn-secondary disabled:opacity-40">
          ← Volver
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending}
          className="btn-primary flex items-center gap-2 disabled:opacity-40"
        >
          <Send size={15} />
          {sending ? "Enviando..." : `Aprobar y enviar a ${recipientCount} destinatarios`}
        </button>
      </StickyActions>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CampaignCreatorView({
  templates,
  projects,
  initialTemplateId,
  onCampaignCreated,
  onEditTemplate
}: CampaignCreatorViewProps) {
  const draft = useMailerStore((s) => s.campaignDraft);
  const updateDraft = useMailerStore((s) => s.updateCampaignDraft);
  const resetDraft = useMailerStore((s) => s.resetCampaignDraft);

  const [sending, setSending] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // "Usar plantilla" desde otra vista: fija la plantilla si el borrador no tiene una.
  useEffect(() => {
    if (initialTemplateId && !draft.selectedTemplateId) {
      updateDraft({ selectedTemplateId: initialTemplateId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId]);

  // Borradores guardados con el flujo viejo de 4 pasos: el paso 4 ya no existe.
  useEffect(() => {
    if (draft.step > 3) updateDraft({ step: 3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTemplate = templates.find((t) => t.id === draft.selectedTemplateId) ?? null;
  const draftActive = isDraftActive(draft);

  // El asunto vive en la plantilla: un borrador guardado se realinea si la
  // plantilla cambió de asunto mientras tanto.
  useEffect(() => {
    if (selectedTemplate && draft.subject !== selectedTemplate.subject) {
      updateDraft({ subject: selectedTemplate.subject });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?.id, selectedTemplate?.subject]);

  async function handleConfirm(title: string) {
    if (!selectedTemplate) return;
    setSending(true);
    try {
      const finalHtml = sanitizeHtml(substituteVars(selectedTemplate.html, draft.campaignVars));
      const contacts = draft.contacts;

      const campaign = await createCampaign({
        title,
        subject: draft.subject,
        prompt: "",
        htmlRaw: selectedTemplate.html,
        htmlSanitized: finalHtml,
        recipientCountEstimate: contacts.length,
        pendingCount: contacts.length,
        validationMetrics: draft.metrics,
        projectId: selectedTemplate.projectId
      });
      await createCampaignRun(campaign.id);
      await addCampaignRecipients(campaign.id, contacts);

      // El despacho es server-side: sale lo que permita el cupo del día y el
      // resto queda pendiente para la próxima corrida del runner.
      let remainingPending = contacts.length;
      try {
        const summary = await runDispatcher({ campaignId: campaign.id, trigger: "campaign" });
        if (summary.errors.length > 0) throw new Error(summary.errors.join(" | "));
        remainingPending = (await getCampaignDispatchData(campaign.id)).pendingCount;
      } catch (err) {
        // La campaña ya está guardada con su lista: no se pierde nada, se
        // reintenta desde el Dashboard sin riesgo de duplicar envíos.
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `La campaña quedó guardada con ${contacts.length} destinatarios pendientes, pero el despacho no arrancó. Reintentá desde el Dashboard. Detalle: ${detail}`
        );
      }

      // Reporte de evidencia: se descarga automáticamente tras cada envío.
      await downloadEmailCampaignReport(campaign.id).catch((err) =>
        console.error("No fue posible generar el reporte de evidencia:", err)
      );

      resetDraft();
      onCampaignCreated({ ...campaign, pendingCount: remainingPending });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Creador de campaña</h1>
          <p className="mt-2 text-sm text-text-muted">
            Seguí los pasos para configurar y enviar tu campaña. El avance se guarda solo: podés salir y volver.
          </p>
        </div>

        {draftActive && !confirmCancel && (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            disabled={sending}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-error/40 px-3 py-2 text-sm font-semibold text-error hover:bg-error/5 disabled:opacity-40"
          >
            <Trash2 size={14} />
            Cancelar campaña
          </button>
        )}
        {confirmCancel && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-error/40 bg-error/5 p-2">
            <span className="text-sm font-semibold text-error">¿Descartar el borrador?</span>
            <button
              type="button"
              onClick={() => {
                resetDraft();
                setConfirmCancel(false);
              }}
              className="rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-white"
            >
              Sí, descartar
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface"
            >
              Seguir editando
            </button>
          </div>
        )}
      </div>

      <StepBar current={draft.step} />

      {draft.step === 1 && (
        <Step1
          templates={templates}
          projects={projects}
          selectedId={draft.selectedTemplateId}
          campaignVars={draft.campaignVars}
          onSelect={(id) => {
            // Cambiar de plantilla limpia las variables de campaña (son de otra
            // estructura) y trae el asunto de la plantilla nueva.
            if (id !== draft.selectedTemplateId) {
              const next = templates.find((t) => t.id === id) ?? null;
              updateDraft({ selectedTemplateId: id, campaignVars: {}, subject: next?.subject ?? "" });
            }
          }}
          onEditTemplate={onEditTemplate}
          onVarsChange={(campaignVars) => updateDraft({ campaignVars })}
          onNext={() => updateDraft({ step: 2 })}
        />
      )}

      {draft.step === 2 && selectedTemplate && (
        <Step2
          template={selectedTemplate}
          contacts={draft.contacts}
          metrics={draft.metrics ?? EMPTY_METRICS}
          columnNames={draft.columnNames}
          invalidRows={draft.invalidRows}
          contactsDropped={draft.contactsDropped}
          onFileLoaded={(c, m, cols, inv) => {
            updateDraft({ contacts: c, metrics: m, columnNames: cols, invalidRows: inv, contactsDropped: false });
          }}
          onNext={() => updateDraft({ step: 3, title: draft.title || draft.subject })}
          onBack={() => updateDraft({ step: 1 })}
        />
      )}

      {draft.step === 3 && selectedTemplate && (
        <Step3
          template={selectedTemplate}
          contacts={draft.contacts}
          subject={draft.subject}
          campaignVars={draft.campaignVars}
          title={draft.title}
          sending={sending}
          onTitleChange={(title) => updateDraft({ title })}
          onBack={() => updateDraft({ step: 2 })}
          onConfirm={handleConfirm}
        />
      )}

      {draft.step >= 2 && !selectedTemplate && (
        <div className="card py-10 text-center text-sm text-text-muted">
          La plantilla del borrador ya no existe.{" "}
          <button type="button" onClick={() => updateDraft({ step: 1, selectedTemplateId: null })} className="font-semibold text-primary underline">
            Volver a elegir plantilla
          </button>
        </div>
      )}
    </section>
  );
}
