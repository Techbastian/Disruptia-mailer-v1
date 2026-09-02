import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Info, Send, Users, X } from "lucide-react";
import FileDropzone from "../components/FileDropzone";
import StatCard from "../components/StatCard";
import type { WhatsAppCampaignItem, WhatsAppTemplate } from "../types";
import {
  normalizePhone,
  parseWhatsAppContactsFile,
  type WhatsAppContact,
  type WhatsAppInvalidRow,
  type WhatsAppMetrics
} from "../lib/whatsappCsv";
import { hasWhatsAppWebhookConfig, runDispatcher, sendWhatsAppTest, type WhatsAppRecipient } from "../lib/api";
import { addWhatsAppCampaignRecipients, createWhatsAppCampaign, listWhatsAppCampaign } from "../lib/db";
import { downloadWhatsAppCampaignReport } from "../lib/report";
import StickyActions from "../components/StickyActions";
import { isPastSchedule, minScheduleInput, scheduleInputToIso } from "../lib/schedule";
import { DAILY_WHATSAPP_LIMIT } from "../lib/dispatch";
import { extractWaVars, WhatsAppPreview } from "./WhatsAppTemplateEditorView";

type Props = {
  templates: WhatsAppTemplate[];
  onManageTemplates: () => void;
  onCampaignCreated: (campaign: WhatsAppCampaignItem) => void;
};

type VarMapping = { source: "column" | "fixed"; value: string };

// Todo mensaje de prueba va siempre a este número; los demás se agregan por envío.
const DEFAULT_TEST_PHONE = "+573157281832";

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

function applyWaVars(text: string, valueByIndex: Record<number, string>): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => valueByIndex[Number(n)] || `{{${n}}}`);
}

export default function WhatsAppSendView({ templates, onManageTemplates, onCampaignCreated }: Props) {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [metrics, setMetrics] = useState<WhatsAppMetrics | null>(null);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [invalidRows, setInvalidRows] = useState<WhatsAppInvalidRow[]>([]);

  const [templateId, setTemplateId] = useState<string>("");
  const [mapping, setMapping] = useState<Record<number, VarMapping>>({});

  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [when, setWhen] = useState("");
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [extraTestPhones, setExtraTestPhones] = useState<string[]>([]);
  const [newTestPhone, setNewTestPhone] = useState("");

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const vars = useMemo(
    () => (template ? extractWaVars(`${template.headerText} ${template.bodyText}`) : []),
    [template]
  );

  function selectTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    const v = tpl ? extractWaVars(`${tpl.headerText} ${tpl.bodyText}`) : [];
    const next: Record<number, VarMapping> = {};
    for (const n of v) next[n] = { source: "column", value: columnNames[0] ?? "" };
    setMapping(next);
    setSendResult(null);
    setTestResult(null);
  }

  async function handleFile(file: File) {
    const result = await parseWhatsAppContactsFile(file);
    setContacts(result.contacts);
    setMetrics(result.metrics);
    setColumnNames(result.columnNames);
    setInvalidRows(result.invalidRows);
    setSendResult(null);
    // Re-inicializa mapping de columnas si ya había template elegido.
    if (template) {
      setMapping((prev) => {
        const next = { ...prev };
        for (const n of vars) {
          if (next[n]?.source === "column" && !result.columnNames.includes(next[n].value)) {
            next[n] = { source: "column", value: result.columnNames[0] ?? "" };
          }
        }
        return next;
      });
    }
  }

  // Resuelve las variables {{n}} para un contacto según el mapeo (columna o valor fijo).
  function resolveVariables(contact: WhatsAppContact | null): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const n of vars) {
      const m = mapping[n];
      if (!m) continue;
      resolved[String(n)] =
        m.source === "fixed" ? m.value : String(contact?.[m.value] ?? "");
    }
    return resolved;
  }

  // Preview con el primer contacto válido (columnas) + valores fijos.
  const previewTemplate: WhatsAppTemplate | null = useMemo(() => {
    if (!template) return null;
    const sample = contacts[0];
    const valueByIndex: Record<number, string> = {};
    for (const n of vars) {
      const m = mapping[n];
      if (!m) continue;
      valueByIndex[n] = m.source === "fixed" ? m.value : String(sample?.[m.value] ?? `{{${n}}}`);
    }
    return {
      ...template,
      headerText: applyWaVars(template.headerText, valueByIndex),
      bodyText: applyWaVars(template.bodyText, valueByIndex)
    };
  }, [template, contacts, vars, mapping]);

  const hasContacts = contacts.length > 0;
  const mappingComplete = vars.every((n) => {
    const m = mapping[n];
    if (!m) return false;
    return m.source === "fixed" ? m.value.trim().length > 0 : m.value.length > 0 && hasContacts;
  });
  const canSendReal = hasWhatsAppWebhookConfig && !!template && hasContacts && mappingComplete;
  const testPhones = [DEFAULT_TEST_PHONE, ...extraTestPhones];

  function handleAddTestPhone() {
    const phone = normalizePhone(newTestPhone);
    if (!E164_REGEX.test(phone)) {
      setTestResult({ ok: false, message: "Ingresá un número E.164 válido (ej. +573001234567)." });
      return;
    }
    if (testPhones.includes(phone)) {
      setTestResult({ ok: false, message: "Ese número ya está en la lista de prueba." });
      return;
    }
    setExtraTestPhones((prev) => [...prev, phone]);
    setNewTestPhone("");
    setTestResult(null);
  }

  async function handleSendTest() {
    if (!template) return;
    setTestSending(true);
    setTestResult(null);
    try {
      // Variables de la prueba: primer contacto del archivo, o valores de ejemplo si no hay archivo.
      const sampleVars: Record<string, string> = {};
      const resolved = resolveVariables(contacts[0] ?? null);
      for (const n of vars) sampleVars[String(n)] = resolved[String(n)] || `Ejemplo ${n}`;
      await sendWhatsAppTest({
        template: { name: template.name, language: template.language },
        testPhones,
        variables: sampleVars
      });
      setTestResult({
        ok: true,
        message: `Prueba enviada a ${testPhones.length} número(s): ${testPhones.join(", ")}. Revisá WhatsApp.`
      });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "No fue posible enviar la prueba." });
    } finally {
      setTestSending(false);
    }
  }

  async function handleSendReal() {
    if (!template || !canSendReal) return;
    if (mode === "schedule") {
      if (!when) {
        setSendResult({ ok: false, message: "Elegí la fecha y hora del envío." });
        return;
      }
      if (isPastSchedule(when)) {
        setSendResult({ ok: false, message: "La fecha de envío tiene que ser futura (hora de Bogotá)." });
        return;
      }
    }
    const scheduledAt = mode === "schedule" ? scheduleInputToIso(when) : null;
    setSending(true);
    setSendResult(null);
    try {
      const recipients: WhatsAppRecipient[] = contacts.map((c) => ({
        phone: c.phone,
        variables: resolveVariables(c)
      }));

      const campaign = await createWhatsAppCampaign({
        templateName: template.name,
        templateLanguage: template.language,
        recipientCount: recipients.length,
        // La lista entera arranca pendiente: la despacha el runner por lotes.
        pendingCount: recipients.length,
        scheduledAt,
        validationMetrics: metrics,
        // El envío hereda el proyecto de la plantilla usada.
        projectId: template.projectId
      });

      // Los destinatarios se guardan ANTES de despachar: si el envío falla igual
      // queda la evidencia de a quiénes iba, y el runner sabe qué mandar.
      await addWhatsAppCampaignRecipients(
        campaign.id,
        recipients.map((r) => ({ phone: r.phone, variables: r.variables }))
      );

      let dispatched: WhatsAppCampaignItem = campaign;
      if (!scheduledAt) {
        try {
          const summary = await runDispatcher({ campaignId: campaign.id, trigger: "campaign" });
          if (summary.errors.length > 0) throw new Error(summary.errors.join(" | "));
          dispatched = (await listWhatsAppCampaign(campaign.id)) ?? campaign;
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          throw new Error(
            `El envío quedó guardado con ${recipients.length} destinatarios pendientes, pero el despacho no arrancó. Reintentá desde el Dashboard. Detalle: ${detail}`
          );
        }
      }

      // Evidencias: reporte del envío (los destinatarios ya están guardados).
      await downloadWhatsAppCampaignReport(dispatched).catch((err) =>
        console.error("No fue posible generar el reporte de evidencia:", err)
      );

      onCampaignCreated(dispatched);
    } catch (err) {
      setSendResult({ ok: false, message: err instanceof Error ? err.message : "No fue posible iniciar el envío." });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Envíos WhatsApp</h1>
        <p className="mt-2 text-sm text-text-muted">
          Subí los contactos, elegí una plantilla aprobada y asigná sus variables.
        </p>
      </div>

      {/* Paso 1: contactos */}
      <article className="card space-y-4">
        <p className="font-heading font-semibold">1. Contactos (teléfonos E.164)</p>
        <FileDropzone
          subtitle={
            <>
              CSV o XLSX. Columna de teléfono en formato <strong>E.164</strong> (ej. +573001234567).
            </>
          }
          onFile={handleFile}
        />

        {metrics && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Cargados" value={metrics.totalLoaded} />
            <StatCard label="Válidos" value={metrics.validPhones} tone="success" />
            <StatCard label="Inválidos" value={metrics.invalidPhones} tone={metrics.invalidPhones ? "error" : undefined} />
            <StatCard label="Duplicados" value={metrics.duplicatesRemoved} tone={metrics.duplicatesRemoved ? "warning" : undefined} />
          </div>
        )}

        {invalidRows.length > 0 && (
          <details className="rounded-lg border border-border bg-surface/40 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-text-muted">
              Ver {invalidRows.length} fila(s) inválida(s)
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-text-muted">
              {invalidRows.slice(0, 50).map((r, i) => (
                <li key={i}>
                  Fila {r.rowNumber}: <span className="font-mono">{r.phone}</span> — {r.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </article>

      {/* Paso 2: plantilla + variables */}
      <article className="card space-y-4">
        <p className="font-heading font-semibold">2. Plantilla y variables</p>
        {templates.length === 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/40 p-4">
            <p className="text-sm text-text-muted">No tenés plantillas de WhatsApp registradas.</p>
            <button type="button" onClick={onManageTemplates} className="btn-secondary text-sm">
              Registrar plantilla
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-semibold">Plantilla aprobada</label>
              <select className="input mt-1.5" value={templateId} onChange={(e) => selectTemplate(e.target.value)}>
                <option value="">Elegí una plantilla…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
            </div>

            {template && vars.length === 0 && (
              <p className="text-sm text-text-muted">Esta plantilla no tiene variables.</p>
            )}

            {template && vars.length > 0 && (
              <div className="space-y-2">
                {vars.map((n) => {
                  const m = mapping[n] ?? { source: "column", value: "" };
                  return (
                    <div key={n} className="flex flex-wrap items-center gap-2">
                      <span className="w-12 shrink-0 rounded-md bg-surface px-2 py-1.5 text-center font-mono text-sm font-semibold">
                        {`{{${n}}}`}
                      </span>
                      <select
                        className="input w-44 py-1.5 text-sm"
                        value={m.source}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [n]: { source: e.target.value as VarMapping["source"], value: e.target.value === "column" ? columnNames[0] ?? "" : "" }
                          }))
                        }
                      >
                        <option value="column">Columna del archivo</option>
                        <option value="fixed">Valor fijo</option>
                      </select>
                      {m.source === "column" ? (
                        <select
                          className="input flex-1 py-1.5 text-sm"
                          value={m.value}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [n]: { source: "column", value: e.target.value } }))}
                          disabled={columnNames.length === 0}
                        >
                          {columnNames.length === 0 && <option value="">Subí un archivo primero</option>}
                          {columnNames.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="input flex-1 py-1.5 text-sm"
                          value={m.value}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [n]: { source: "fixed", value: e.target.value } }))}
                          placeholder="Texto igual para todos"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </article>

      {/* Paso 3: preview + envío */}
      {previewTemplate && template && (
        <>
          <article className="card space-y-4">
            <p className="font-heading font-semibold">3. Vista previa</p>
            <div className="grid gap-4 md:grid-cols-[360px_1fr]">
              <div>
                <WhatsAppPreview template={previewTemplate} />
                <p className="mt-2 text-xs text-text-muted">
                  Previsualizado con {hasContacts ? "el primer contacto del archivo" : "valores de ejemplo"}.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users size={15} className="text-text-muted" />
                  <span>
                    {contacts.length > 0
                      ? `${contacts.length} destinatario(s) válido(s)`
                      : "Sin contactos cargados"}
                  </span>
                </div>
                {!hasWhatsAppWebhookConfig && (
                  <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-yellow-800">
                    <Info size={15} className="mt-0.5 shrink-0 text-yellow-600" />
                    <span>
                      Falta configurar <code className="font-mono text-xs">VITE_N8N_WHATSAPP_WEBHOOK_URL</code> y{" "}
                      <code className="font-mono text-xs">VITE_N8N_WHATSAPP_WEBHOOK_SECRET</code> en el .env. Guía del
                      workflow: <code className="font-mono text-xs">docs/n8n-whatsapp-flow.md</code>.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </article>

          {/* Mensaje de prueba */}
          <article className="card space-y-4">
            <div>
              <p className="font-heading font-semibold">Mensaje de prueba</p>
              <p className="mt-1 text-sm text-text-muted">
                Envía la plantilla con las variables resueltas del primer contacto (o valores de ejemplo). No crea un
                envío en el historial.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {DEFAULT_TEST_PHONE}
                <span className="font-normal text-primary/60">· siempre</span>
              </span>
              {extraTestPhones.map((phone) => (
                <span
                  key={phone}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold"
                >
                  {phone}
                  <button
                    type="button"
                    onClick={() => setExtraTestPhones((prev) => prev.filter((p) => p !== phone))}
                    className="text-text-muted hover:text-error"
                    aria-label={`Quitar ${phone}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input w-56 py-1.5 text-sm"
                value={newTestPhone}
                onChange={(e) => setNewTestPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTestPhone();
                  }
                }}
                placeholder="+573001234567"
              />
              <button type="button" onClick={handleAddTestPhone} className="btn-secondary py-1.5 text-sm">
                Agregar número
              </button>
              <button
                type="button"
                onClick={() => void handleSendTest()}
                disabled={!hasWhatsAppWebhookConfig || testSending || sending}
                className="btn-primary disabled:opacity-40"
              >
                {testSending ? "Enviando prueba..." : `Enviar prueba (${testPhones.length})`}
              </button>
            </div>
            {testResult && (
              <p className={`text-sm ${testResult.ok ? "text-success" : "text-error"}`}>{testResult.message}</p>
            )}
          </article>

          {/* Cuándo sale */}
          <article className="card space-y-4">
            <div>
              <p className="font-heading font-semibold">¿Cuándo sale?</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Horarios de Bogotá. El despachador revisa cada 10 minutos y manda hasta {DAILY_WHATSAPP_LIMIT}{" "}
                mensajes por día.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("now")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === "now" ? "bg-primary text-white" : "border border-border text-text-muted hover:bg-surface"
                }`}
              >
                <Send size={14} />
                Enviar ahora
              </button>
              <button
                type="button"
                onClick={() => setMode("schedule")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === "schedule"
                    ? "bg-primary text-white"
                    : "border border-border text-text-muted hover:bg-surface"
                }`}
              >
                <CalendarClock size={14} />
                Programar
              </button>
            </div>
            {mode === "schedule" && (
              <div>
                <label className="block text-sm font-semibold" htmlFor="wa-schedule-at">
                  Fecha y hora (Bogotá)
                </label>
                <input
                  id="wa-schedule-at"
                  type="datetime-local"
                  className="input mt-2 max-w-[280px]"
                  value={when}
                  min={minScheduleInput()}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
            )}
          </article>

          {/* Envío real */}
          {sendResult && !sendResult.ok && <p className="text-sm text-error">{sendResult.message}</p>}
          <StickyActions>
            <p className="text-sm text-text-muted">
              {!mappingComplete && vars.length > 0
                ? "Completá el mapeo de todas las variables (y subí un archivo si usás columnas) para habilitar el envío."
                : `Listo para enviar a ${contacts.length} destinatario(s) — proyecto: ${
                    template.projectId ? "el de la plantilla" : "General"
                  }.`}
            </p>
            <button
              type="button"
              onClick={() => void handleSendReal()}
              disabled={!canSendReal || sending || testSending}
              className="btn-primary flex shrink-0 items-center gap-2 disabled:opacity-40"
            >
              {sending ? (
                <>
                  <Send size={16} className="animate-pulse" />
                  {mode === "schedule" ? "Programando…" : "Enviando…"}
                </>
              ) : mode === "schedule" ? (
                <>
                  <CalendarClock size={16} />
                  Programar envío ({contacts.length})
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Enviar por WhatsApp ({contacts.length})
                </>
              )}
            </button>
          </StickyActions>
        </>
      )}
    </section>
  );
}
