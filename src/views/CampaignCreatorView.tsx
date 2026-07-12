import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Send } from "lucide-react";
import FileDropzone from "../components/FileDropzone";
import StatCard from "../components/StatCard";
import { parseContactsFile, type InvalidRow } from "../lib/csv";
import { sendCampaign, sendTestEmail } from "../lib/api";
import { createCampaign, createCampaignRun, updateCampaignStatus } from "../lib/db";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import type { CampaignHistoryItem, CampaignMetrics, ContactRecord, EmailTemplate } from "../types";

type CampaignCreatorViewProps = {
  templates: EmailTemplate[];
  initialTemplateId?: string | null;
  onCampaignCreated: (campaign: CampaignHistoryItem) => void;
};

function substituteVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key: string) => {
    return vars[key.toLowerCase()] ?? match;
  });
}

// Toda prueba se envía siempre a este correo; los demás se agregan por envío.
const DEFAULT_TEST_EMAIL = "sebastian.mojica@disruptia.co";

const STEP_LABELS = ["Destinatarios", "Estructura", "Contenido", "Confirmar"];

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

// ── Step 1: Upload CSV/XLSX ──────────────────────────────────────────────────

function Step1({
  contacts,
  metrics,
  columnNames,
  invalidRows,
  onFileLoaded,
  onNext
}: {
  contacts: ContactRecord[];
  metrics: CampaignMetrics;
  columnNames: string[];
  invalidRows: InvalidRow[];
  onFileLoaded: (
    contacts: ContactRecord[],
    metrics: CampaignMetrics,
    columnNames: string[],
    invalidRows: InvalidRow[]
  ) => void;
  onNext: () => void;
}) {
  const hasContacts = contacts.length > 0;
  const overLimit = contacts.length > 1000;

  return (
    <div className="space-y-6">
      <FileDropzone
        subtitle="Archivos CSV o XLSX — columnas esperadas: email, nombre, etc."
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

          {overLimit && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-600" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">Límite diario: solo se enviarán los primeros 1.000 contactos</p>
                <p className="mt-1 text-xs text-yellow-700">
                  Tenés {contacts.length} contactos válidos. El resto deberá enviarse en otra campaña.
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

          <div className="flex justify-end">
            <button type="button" onClick={onNext} className="btn-primary">
              Continuar con estructura →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Step 2: Template selection ───────────────────────────────────────────────

function Step2({
  templates,
  selectedId,
  columnNames,
  onSelect,
  onNext,
  onBack
}: {
  templates: EmailTemplate[];
  selectedId: string | null;
  columnNames: string[];
  onSelect: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const missingColumns = useMemo(() => {
    if (!selected) return [];
    return selected.variablesCsv.filter((v) => !columnNames.includes(v));
  }, [selected, columnNames]);

  const canContinue = selectedId !== null && missingColumns.length === 0;

  return (
    <div className="space-y-6">
      {templates.length === 0 ? (
        <div className="card py-14 text-center text-sm text-text-muted">
          No hay plantillas disponibles. Creá una desde la sección Plantillas.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
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

      {missingColumns.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-error/40 bg-error/5 p-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
          <div className="text-sm text-error">
            <p className="font-semibold">Columnas faltantes en el CSV</p>
            <p className="mt-1 text-xs">
              Esta plantilla requiere: {missingColumns.map((c) => `{{${c}}}`).join(", ")}. Estas columnas no están en el
              archivo subido.
            </p>
            <p className="mt-1 text-xs text-error/70">Subí un archivo con estas columnas o elegí otra plantilla.</p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn-secondary">
          ← Volver
        </button>
        <button type="button" onClick={onNext} disabled={!canContinue} className="btn-primary disabled:opacity-40">
          Continuar con contenido →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Campaign variables + subject ─────────────────────────────────────

function Step3({
  template,
  campaignVars,
  subject,
  onVarsChange,
  onSubjectChange,
  onNext,
  onBack
}: {
  template: EmailTemplate;
  campaignVars: Record<string, string>;
  subject: string;
  onVarsChange: (vars: Record<string, string>) => void;
  onSubjectChange: (subject: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const canContinue =
    subject.trim().length > 0 &&
    template.variablesCampaign.every((v) => (campaignVars[v] ?? "").trim().length > 0);

  return (
    <div className="space-y-6">
      <article className="card space-y-4">
        <div>
          <label className="block text-sm font-semibold">Asunto del correo</label>
          <input
            className="input mt-2"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="ej. Te citamos a una entrevista — Disruptia"
          />
        </div>
      </article>

      {template.variablesCampaign.length > 0 ? (
        <article className="card space-y-4">
          <div>
            <p className="font-heading font-semibold">Variables de campaña</p>
            <p className="mt-1 text-xs text-text-muted">Estos valores son iguales para todos los destinatarios.</p>
          </div>
          {template.variablesCampaign.map((varName) => (
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
        </article>
      ) : (
        <div className="rounded-xl border border-border bg-surface/50 p-6 text-center text-sm text-text-muted">
          Esta plantilla no tiene variables de campaña. Solo usa variables del CSV que N8N reemplazará por destinatario.
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn-secondary">
          ← Volver
        </button>
        <button type="button" onClick={onNext} disabled={!canContinue} className="btn-primary disabled:opacity-40">
          Continuar a confirmar →
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Summary + confirm send ───────────────────────────────────────────

function Step4({
  template,
  contacts,
  subject,
  campaignVars,
  sending,
  onBack,
  onConfirm
}: {
  template: EmailTemplate;
  contacts: ContactRecord[];
  subject: string;
  campaignVars: Record<string, string>;
  sending: boolean;
  onBack: () => void;
  onConfirm: (title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(subject);
  const [error, setError] = useState("");
  const [extraTestEmails, setExtraTestEmails] = useState<string[]>([]);
  const [newTestEmail, setNewTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const previewHtml = useMemo(
    () => sanitizeHtml(substituteVars(template.html, campaignVars)),
    [template.html, campaignVars]
  );

  const recipientCount = Math.min(contacts.length, 1000);
  const testEmails = [DEFAULT_TEST_EMAIL, ...extraTestEmails];

  function handleAddTestEmail() {
    const email = newTestEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
      setTestResult({ ok: false, message: "Ingresá un correo válido para agregarlo a la prueba." });
      return;
    }
    if (testEmails.includes(email)) {
      setTestResult({ ok: false, message: "Ese correo ya está en la lista de prueba." });
      return;
    }
    setExtraTestEmails((prev) => [...prev, email]);
    setNewTestEmail("");
    setTestResult(null);
  }

  async function handleSendTest() {
    setTestSending(true);
    setTestResult(null);
    try {
      await sendTestEmail({
        html: previewHtml,
        subject,
        testEmails,
        sampleContact: contacts[0] ?? null
      });
      setTestResult({
        ok: true,
        message: `Prueba enviada a ${testEmails.length} correo(s): ${testEmails.join(", ")}. Revisá la bandeja (y spam).`
      });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "No fue posible enviar la prueba." });
    } finally {
      setTestSending(false);
    }
  }

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
          {contacts.length > 1000 && (
            <p className="mt-1 text-xs text-text-muted">de {contacts.length} válidos</p>
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
            onChange={(e) => setTitle(e.target.value)}
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

      <article className="card space-y-3">
        <div>
          <p className="font-heading text-sm font-semibold">Correo de prueba</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Recibí este correo antes de aprobar el envío masivo. Usa los datos del primer contacto del archivo para las
            variables. No crea una campaña.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {DEFAULT_TEST_EMAIL}
            <span className="font-normal text-primary/60">· siempre</span>
          </span>
          {extraTestEmails.map((email) => (
            <span
              key={email}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold"
            >
              {email}
              <button
                type="button"
                onClick={() => setExtraTestEmails((prev) => prev.filter((e) => e !== email))}
                disabled={testSending}
                className="text-text-muted hover:text-error"
                aria-label={`Quitar ${email} de la prueba`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            className="input flex-1 min-w-[240px]"
            value={newTestEmail}
            onChange={(e) => setNewTestEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTestEmail();
              }
            }}
            placeholder="Agregar otro correo de la empresa…"
            disabled={testSending}
          />
          <button
            type="button"
            onClick={handleAddTestEmail}
            disabled={testSending || !newTestEmail.trim()}
            className="btn-secondary disabled:opacity-40"
          >
            Agregar
          </button>
          <button
            type="button"
            onClick={() => void handleSendTest()}
            disabled={testSending || sending}
            className="btn-primary disabled:opacity-40"
          >
            {testSending ? "Enviando prueba..." : `Enviar prueba (${testEmails.length})`}
          </button>
        </div>
        {testResult && (
          <p className={`text-sm ${testResult.ok ? "text-success" : "text-error"}`}>{testResult.message}</p>
        )}
      </article>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex justify-between">
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
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CampaignCreatorView({ templates, initialTemplateId, onCampaignCreated }: CampaignCreatorViewProps) {
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [metrics, setMetrics] = useState<CampaignMetrics>({
    totalLoaded: 0,
    validEmails: 0,
    invalidEmails: 0,
    duplicatesRemoved: 0
  });
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplateId ?? null);
  const [campaignVars, setCampaignVars] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  async function handleConfirm(title: string) {
    if (!selectedTemplate) return;
    setSending(true);
    try {
      const finalHtml = sanitizeHtml(substituteVars(selectedTemplate.html, campaignVars));
      const recipientBatch = contacts.slice(0, 1000);
      const campaign = await createCampaign({
        title,
        subject,
        prompt: "",
        htmlRaw: selectedTemplate.html,
        htmlSanitized: finalHtml,
        recipientCountEstimate: recipientBatch.length,
        validationMetrics: metrics
      });
      await createCampaignRun(campaign.id);
      try {
        await sendCampaign({ campaignId: campaign.id, html: finalHtml, subject, contacts: recipientBatch });
      } catch (err) {
        // La campaña ya existe en Supabase: marcarla fallida evita zombies
        // "en cola" y duplicados si el usuario reintenta.
        await updateCampaignStatus(campaign.id, "failed").catch(() => undefined);
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`El envío falló y la campaña quedó marcada como fallida. Detalle: ${detail}`);
      }
      onCampaignCreated(campaign);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Creador de campaña</h1>
        <p className="mt-2 text-sm text-text-muted">Seguí los pasos para configurar y enviar tu campaña.</p>
      </div>

      <StepBar current={step} />

      {step === 1 && (
        <Step1
          contacts={contacts}
          metrics={metrics}
          columnNames={columnNames}
          invalidRows={invalidRows}
          onFileLoaded={(c, m, cols, inv) => {
            setContacts(c);
            setMetrics(m);
            setColumnNames(cols);
            setInvalidRows(inv);
          }}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2
          templates={templates}
          selectedId={selectedTemplateId}
          columnNames={columnNames}
          onSelect={setSelectedTemplateId}
          onNext={() => {
            setCampaignVars({});
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && selectedTemplate && (
        <Step3
          template={selectedTemplate}
          campaignVars={campaignVars}
          subject={subject}
          onVarsChange={setCampaignVars}
          onSubjectChange={setSubject}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && selectedTemplate && (
        <Step4
          template={selectedTemplate}
          contacts={contacts}
          subject={subject}
          campaignVars={campaignVars}
          sending={sending}
          onBack={() => setStep(3)}
          onConfirm={handleConfirm}
        />
      )}
    </section>
  );
}
