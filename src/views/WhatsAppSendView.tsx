import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Upload, Users } from "lucide-react";
import type { WhatsAppTemplate } from "../types";
import {
  parseWhatsAppContactsFile,
  type WhatsAppContact,
  type WhatsAppInvalidRow,
  type WhatsAppMetrics
} from "../lib/whatsappCsv";
import { extractWaVars, WhatsAppPreview } from "./WhatsAppTemplateEditorView";

type Props = {
  templates: WhatsAppTemplate[];
  onManageTemplates: () => void;
};

type VarMapping = { source: "column" | "fixed"; value: string };

function applyWaVars(text: string, valueByIndex: Record<number, string>): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => valueByIndex[Number(n)] || `{{${n}}}`);
}

export default function WhatsAppSendView({ templates, onManageTemplates }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [metrics, setMetrics] = useState<WhatsAppMetrics | null>(null);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [invalidRows, setInvalidRows] = useState<WhatsAppInvalidRow[]>([]);

  const [templateId, setTemplateId] = useState<string>("");
  const [mapping, setMapping] = useState<Record<number, VarMapping>>({});

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
  }

  async function handleFile(file: File) {
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setParseError("Formato no soportado. Subí un archivo .csv o .xlsx.");
      return;
    }
    setParsing(true);
    setParseError("");
    try {
      const result = await parseWhatsAppContactsFile(file);
      setContacts(result.contacts);
      setMetrics(result.metrics);
      setColumnNames(result.columnNames);
      setInvalidRows(result.invalidRows);
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
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Error al procesar el archivo.");
    } finally {
      setParsing(false);
    }
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
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface/50 py-10 transition-colors hover:border-primary/40"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Upload size={22} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold">{parsing ? "Procesando…" : "Arrastrá o hacé clic para subir"}</p>
            <p className="text-sm text-text-muted">
              CSV o XLSX. Columna de teléfono en formato <strong>E.164</strong> (ej. +573001234567).
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>

        {parseError && (
          <p className="flex items-center gap-2 text-sm text-error">
            <AlertTriangle size={15} /> {parseError}
          </p>
        )}

        {metrics && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Cargados" value={metrics.totalLoaded} />
            <Metric label="Válidos" value={metrics.validPhones} tone="success" />
            <Metric label="Inválidos" value={metrics.invalidPhones} tone={metrics.invalidPhones ? "error" : undefined} />
            <Metric label="Duplicados" value={metrics.duplicatesRemoved} />
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

      {/* Paso 3: preview + envío (stub) */}
      {previewTemplate && (
        <article className="card space-y-4">
          <p className="font-heading font-semibold">3. Vista previa y envío</p>
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
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-yellow-800">
                <Info size={15} className="mt-0.5 shrink-0 text-yellow-600" />
                <span>
                  El despacho a YCloud se conecta en el próximo paso (vía N8N). Por ahora podés preparar y revisar el
                  envío.
                </span>
              </div>
              <button
                type="button"
                disabled
                className="btn-primary flex w-full items-center justify-center gap-2 opacity-50"
              >
                <CheckCircle2 size={16} />
                Enviar por WhatsApp (próximamente)
              </button>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "success" | "error" }) {
  const color = tone === "success" ? "text-success" : tone === "error" ? "text-error" : "text-text";
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3 text-center">
      <p className={`font-heading text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}
