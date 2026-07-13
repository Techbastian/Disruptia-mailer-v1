import { useMemo, useState } from "react";
import { FileText, RefreshCw, Send, Trash2 } from "lucide-react";
import type { CampaignHistoryItem, WhatsAppCampaignItem } from "../types";
import type { DispatchResult } from "../lib/dispatch";
import { downloadEmailCampaignReport, downloadWhatsAppCampaignReport } from "../lib/report";

type DashboardViewProps = {
  campaigns: CampaignHistoryItem[];
  whatsappCampaigns: WhatsAppCampaignItem[];
  onDeleteCampaign: (id: string) => Promise<void>;
  onDeleteWhatsAppCampaign: (id: string) => Promise<void>;
  onDispatchBatch: (id: string) => Promise<DispatchResult>;
  onRefresh: () => Promise<void>;
};

const STATUS_MAP: Record<CampaignHistoryItem["status"], { label: string; className: string }> = {
  sent:   { label: "Enviada",   className: "bg-success/10 text-success" },
  failed: { label: "Fallida",   className: "bg-error/10 text-error" },
  queued: { label: "En cola",   className: "bg-warning/15 text-yellow-700" },
  draft:  { label: "Borrador",  className: "bg-surface text-text-muted" }
};

function StatusBadge({ status }: { status: CampaignHistoryItem["status"] }) {
  const { label, className } = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function QualityCell({ metrics }: { metrics: CampaignHistoryItem["validationMetrics"] }) {
  if (!metrics) return <span className="text-xs text-text-muted">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-xs">
      <span className="font-semibold text-success">{metrics.validEmails} válidos</span>
      <span className={metrics.invalidEmails > 0 ? "text-error" : "text-text-muted"}>
        {metrics.invalidEmails} inválidos
      </span>
      <span className={metrics.duplicatesRemoved > 0 ? "text-warning" : "text-text-muted"}>
        {metrics.duplicatesRemoved} dup.
      </span>
    </div>
  );
}

function WaQualityCell({ metrics }: { metrics: WhatsAppCampaignItem["validationMetrics"] }) {
  if (!metrics) return <span className="text-xs text-text-muted">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-xs">
      <span className="font-semibold text-success">{metrics.validPhones} válidos</span>
      <span className={metrics.invalidPhones > 0 ? "text-error" : "text-text-muted"}>
        {metrics.invalidPhones} inválidos
      </span>
      <span className={metrics.duplicatesRemoved > 0 ? "text-warning" : "text-text-muted"}>
        {metrics.duplicatesRemoved} dup.
      </span>
    </div>
  );
}

export default function DashboardView({
  campaigns,
  whatsappCampaigns,
  onDeleteCampaign,
  onDeleteWhatsAppCampaign,
  onDispatchBatch,
  onRefresh
}: DashboardViewProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [batchMsg, setBatchMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);

  async function handleDownloadReport(id: string, channel: "email" | "whatsapp") {
    setReportingId(id);
    try {
      if (channel === "email") {
        await downloadEmailCampaignReport(id);
      } else {
        const campaign = whatsappCampaigns.find((c) => c.id === id);
        if (campaign) await downloadWhatsAppCampaignReport(campaign);
      }
    } catch (err) {
      console.error("No fue posible generar el reporte:", err);
      setBatchMsg({ ok: false, text: "No fue posible generar el reporte de evidencia." });
    } finally {
      setReportingId(null);
    }
  }

  // Comunicaciones agrupadas por proyecto (null = General), ambos canales.
  const projectSummary = useMemo(() => {
    const groups = new Map<
      string,
      { emailCampaigns: number; emails: number; waCampaigns: number; waMessages: number }
    >();
    const groupOf = (name: string | null) => {
      const key = name ?? "General";
      if (!groups.has(key)) groups.set(key, { emailCampaigns: 0, emails: 0, waCampaigns: 0, waMessages: 0 });
      return groups.get(key)!;
    };
    for (const c of campaigns) {
      const g = groupOf(c.projectName);
      g.emailCampaigns += 1;
      g.emails += c.recipients;
    }
    for (const c of whatsappCampaigns) {
      const g = groupOf(c.projectName);
      g.waCampaigns += 1;
      g.waMessages += c.recipients;
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [campaigns, whatsappCampaigns]);

  async function handleDispatchBatch(id: string) {
    setDispatchingId(id);
    setBatchMsg(null);
    try {
      const result = await onDispatchBatch(id);
      setBatchMsg({
        ok: true,
        text:
          result.remainingPending > 0
            ? `Lote de ${result.dispatched} despachado. Quedan ${result.remainingPending} pendientes (cupo diario).`
            : `Lote de ${result.dispatched} despachado. La campaña quedó completa.`
      });
    } catch (err) {
      setBatchMsg({ ok: false, text: err instanceof Error ? err.message : "No fue posible despachar el lote." });
    } finally {
      setDispatchingId(null);
    }
  }

  // Los ids son UUID, no colisionan entre tablas: confirmId/deletingId se comparten.
  async function handleDelete(id: string, channel: "email" | "whatsapp") {
    setDeletingId(id);
    try {
      if (channel === "email") {
        await onDeleteCampaign(id);
      } else {
        await onDeleteWhatsAppCampaign(id);
      }
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter((c) => c.status === "sent").length;
  const failedCampaigns = campaigns.filter((c) => c.status === "failed").length;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Dashboard / Historial</h1>
          <p className="mt-2 text-sm text-text-muted">Seguimiento operativo de campañas y calidad de datos por envío.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="card">
          <p className="text-sm text-text-muted">Total campañas</p>
          <p className="mt-2 font-heading text-3xl font-bold">{totalCampaigns}</p>
        </article>
        <article className="card">
          <p className="text-sm text-text-muted">Enviadas exitosamente</p>
          <p className="mt-2 font-heading text-3xl font-bold text-success">{sentCampaigns}</p>
        </article>
        <article className="card">
          <p className="text-sm text-text-muted">Fallidas</p>
          <p className="mt-2 font-heading text-3xl font-bold text-error">{failedCampaigns}</p>
        </article>
      </div>

      {projectSummary.length > 0 && (
        <article className="card overflow-hidden p-0">
          <header className="border-b border-border px-6 py-4">
            <h2 className="font-heading text-xl font-semibold">Comunicaciones por proyecto</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th className="px-6 py-3">Proyecto</th>
                  <th className="px-6 py-3">Campañas email</th>
                  <th className="px-6 py-3">Correos</th>
                  <th className="px-6 py-3">Envíos WhatsApp</th>
                  <th className="px-6 py-3">Mensajes WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {projectSummary.map(([name, g]) => (
                  <tr key={name} className="border-t border-border">
                    <td className="px-6 py-3 font-medium">{name}</td>
                    <td className="px-6 py-3">{g.emailCampaigns}</td>
                    <td className="px-6 py-3">{g.emails}</td>
                    <td className="px-6 py-3">{g.waCampaigns}</td>
                    <td className="px-6 py-3">{g.waMessages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      <article className="card overflow-hidden p-0">
        <header className="border-b border-border px-6 py-4">
          <h2 className="font-heading text-xl font-semibold">Campañas recientes</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-text-muted">
              <tr>
                <th className="px-6 py-3">Título</th>
                <th className="px-6 py-3">Proyecto</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Destinatarios</th>
                <th className="px-6 py-3">Pendientes</th>
                <th className="px-6 py-3">Calidad de datos</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-text-muted" colSpan={8}>
                    Aún no hay campañas registradas.
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-border">
                    <td className="px-6 py-4 font-medium">{campaign.title}</td>
                    <td className="px-6 py-4 text-text-muted">{campaign.projectName ?? "General"}</td>
                    <td className="px-6 py-4 text-text-muted">
                      {new Date(campaign.createdAt).toLocaleString("es-CO")}
                    </td>
                    <td className="px-6 py-4">{campaign.recipients}</td>
                    <td className="px-6 py-4">
                      {campaign.pendingCount > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-yellow-700">
                            {campaign.pendingCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDispatchBatch(campaign.id)}
                            disabled={dispatchingId !== null}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <Send size={12} />
                            {dispatchingId === campaign.id
                              ? "Enviando…"
                              : campaign.status === "failed"
                                ? "Reintentar"
                                : "Enviar lote"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <QualityCell metrics={campaign.validationMetrics} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-6 py-4">
                      {confirmId === campaign.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDelete(campaign.id, "email")}
                            disabled={deletingId === campaign.id}
                            className="rounded-lg bg-error px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {deletingId === campaign.id ? "Borrando..." : "Confirmar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-surface"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDownloadReport(campaign.id, "email")}
                            disabled={reportingId === campaign.id}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
                            aria-label="Descargar reporte de evidencia"
                            title="Descargar reporte de evidencia (.txt)"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(campaign.id)}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-error/10 hover:text-error transition-colors"
                            aria-label="Eliminar campaña"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {batchMsg && (
          <p className={`border-t border-border px-6 py-3 text-sm ${batchMsg.ok ? "text-success" : "text-error"}`}>
            {batchMsg.text}
          </p>
        )}
      </article>

      <article className="card overflow-hidden p-0">
        <header className="border-b border-border px-6 py-4">
          <h2 className="font-heading text-xl font-semibold">Envíos WhatsApp recientes</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-text-muted">
              <tr>
                <th className="px-6 py-3">Plantilla</th>
                <th className="px-6 py-3">Proyecto</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Destinatarios</th>
                <th className="px-6 py-3">Calidad de datos</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {whatsappCampaigns.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-text-muted" colSpan={7}>
                    Aún no hay envíos de WhatsApp registrados.
                  </td>
                </tr>
              ) : (
                whatsappCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-border">
                    <td className="px-6 py-4 font-medium">
                      {campaign.templateName}{" "}
                      <span className="text-xs text-text-muted">({campaign.templateLanguage})</span>
                    </td>
                    <td className="px-6 py-4 text-text-muted">{campaign.projectName ?? "General"}</td>
                    <td className="px-6 py-4 text-text-muted">
                      {new Date(campaign.createdAt).toLocaleString("es-CO")}
                    </td>
                    <td className="px-6 py-4">{campaign.recipients}</td>
                    <td className="px-6 py-4">
                      <WaQualityCell metrics={campaign.validationMetrics} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-6 py-4">
                      {confirmId === campaign.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDelete(campaign.id, "whatsapp")}
                            disabled={deletingId === campaign.id}
                            className="rounded-lg bg-error px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {deletingId === campaign.id ? "Borrando..." : "Confirmar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-surface"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDownloadReport(campaign.id, "whatsapp")}
                            disabled={reportingId === campaign.id}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
                            aria-label="Descargar reporte de evidencia"
                            title="Descargar reporte de evidencia (.txt)"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(campaign.id)}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-error/10 hover:text-error transition-colors"
                            aria-label="Eliminar envío"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
