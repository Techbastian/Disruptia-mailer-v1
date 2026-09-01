import { useMemo, useState } from "react";
import { FileText, Mail, MessageSquareText, RefreshCw, Send, Trash2 } from "lucide-react";
import type { CampaignHistoryItem, WhatsAppCampaignItem } from "../types";
import type { DispatchResult } from "../lib/dispatch";
import { downloadEmailCampaignReport, downloadWhatsAppCampaignReport } from "../lib/report";

type Channel = "email" | "whatsapp";

type DashboardViewProps = {
  campaigns: CampaignHistoryItem[];
  whatsappCampaigns: WhatsAppCampaignItem[];
  onDeleteCampaign: (id: string) => Promise<void>;
  onDeleteWhatsAppCampaign: (id: string) => Promise<void>;
  onDispatchBatch: (id: string) => Promise<DispatchResult>;
  onRefresh: () => Promise<void>;
};

const STATUS_MAP: Record<CampaignHistoryItem["status"], { label: string; className: string }> = {
  sent:      { label: "Enviada",     className: "bg-success/10 text-success" },
  failed:    { label: "Fallida",     className: "bg-error/10 text-error" },
  queued:    { label: "En cola",     className: "bg-warning/15 text-yellow-700" },
  sending:   { label: "En curso",    className: "bg-primary/10 text-primary" },
  scheduled: { label: "Programada",  className: "bg-primary/10 text-primary" },
  canceled:  { label: "Cancelada",   className: "bg-surface text-text-muted" },
  draft:     { label: "Borrador",    className: "bg-surface text-text-muted" }
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

// Barra que aparece cuando hay filas seleccionadas: borrado en lote con confirmación inline.
function SelectionBar({
  count,
  deleting,
  confirming,
  onConfirmToggle,
  onDelete,
  onClear
}: {
  count: number;
  deleting: boolean;
  confirming: boolean;
  onConfirmToggle: (open: boolean) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-6 py-3 text-sm">
      <span className="font-semibold">
        {count} {count === 1 ? "seleccionada" : "seleccionadas"}
      </span>
      {confirming ? (
        <>
          <span className="text-text-muted">¿Eliminar definitivamente?</span>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-lg bg-error px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {deleting ? "Borrando…" : `Sí, eliminar ${count}`}
          </button>
          <button
            type="button"
            onClick={() => onConfirmToggle(false)}
            disabled={deleting}
            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-surface disabled:opacity-60"
          >
            Cancelar
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onConfirmToggle(true)}
            className="flex items-center gap-1.5 rounded-lg bg-error px-3 py-1 text-xs font-semibold text-white"
          >
            <Trash2 size={12} />
            Eliminar seleccionadas
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-surface"
          >
            Quitar selección
          </button>
        </>
      )}
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
  const [channel, setChannel] = useState<Channel>("email");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [batchMsg, setBatchMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function switchChannel(next: Channel) {
    setChannel(next);
    setSelectedIds(new Set());
    setConfirmingBulk(false);
    setConfirmId(null);
    setBatchMsg(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmingBulk(false);
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
    setConfirmingBulk(false);
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = [...selectedIds];
    let failed = 0;
    try {
      for (const id of ids) {
        try {
          if (channel === "email") await onDeleteCampaign(id);
          else await onDeleteWhatsAppCampaign(id);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        } catch (err) {
          console.error(`Error eliminando ${id}:`, err);
          failed += 1;
        }
      }
      if (failed > 0) {
        setBatchMsg({ ok: false, text: `No se pudieron eliminar ${failed} de ${ids.length}. Reintentá con las que quedaron seleccionadas.` });
      } else {
        setBatchMsg({ ok: true, text: `${ids.length} ${ids.length === 1 ? "eliminada" : "eliminadas"} del historial.` });
      }
    } finally {
      setBulkDeleting(false);
      setConfirmingBulk(false);
    }
  }

  async function handleDownloadReport(id: string, ch: Channel) {
    setReportingId(id);
    try {
      if (ch === "email") {
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
  async function handleDelete(id: string, ch: Channel) {
    setDeletingId(id);
    try {
      if (ch === "email") {
        await onDeleteCampaign(id);
      } else {
        await onDeleteWhatsAppCampaign(id);
      }
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  const emailIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);
  const waIds = useMemo(() => whatsappCampaigns.map((c) => c.id), [whatsappCampaigns]);
  const channelIds = channel === "email" ? emailIds : waIds;
  const allSelected = channelIds.length > 0 && selectedIds.size === channelIds.length;

  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter((c) => c.status === "sent").length;
  const failedCampaigns = campaigns.filter((c) => c.status === "failed").length;
  const totalWa = whatsappCampaigns.length;
  const sentWa = whatsappCampaigns.filter((c) => c.status === "sent").length;
  const failedWa = whatsappCampaigns.filter((c) => c.status === "failed").length;

  const selectionBar = (
    <SelectionBar
      count={selectedIds.size}
      deleting={bulkDeleting}
      confirming={confirmingBulk}
      onConfirmToggle={setConfirmingBulk}
      onDelete={() => void handleBulkDelete()}
      onClear={() => {
        setSelectedIds(new Set());
        setConfirmingBulk(false);
      }}
    />
  );

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

      {/* Switch de canal: separa la sección de correos de la de WhatsApp */}
      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => switchChannel("email")}
          className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition ${
            channel === "email" ? "bg-primary text-white" : "text-text-muted hover:bg-surface"
          }`}
        >
          <Mail size={15} />
          Correos
        </button>
        <button
          type="button"
          onClick={() => switchChannel("whatsapp")}
          className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition ${
            channel === "whatsapp" ? "bg-primary text-white" : "text-text-muted hover:bg-surface"
          }`}
        >
          <MessageSquareText size={15} />
          WhatsApp
        </button>
      </div>

      {channel === "email" ? (
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
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <article className="card">
            <p className="text-sm text-text-muted">Total envíos</p>
            <p className="mt-2 font-heading text-3xl font-bold">{totalWa}</p>
          </article>
          <article className="card">
            <p className="text-sm text-text-muted">Enviados exitosamente</p>
            <p className="mt-2 font-heading text-3xl font-bold text-success">{sentWa}</p>
          </article>
          <article className="card">
            <p className="text-sm text-text-muted">Fallidos</p>
            <p className="mt-2 font-heading text-3xl font-bold text-error">{failedWa}</p>
          </article>
        </div>
      )}

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
                  {channel === "email" ? (
                    <>
                      <th className="px-6 py-3">Campañas email</th>
                      <th className="px-6 py-3">Correos</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3">Envíos WhatsApp</th>
                      <th className="px-6 py-3">Mensajes WhatsApp</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {projectSummary.map(([name, g]) => (
                  <tr key={name} className="border-t border-border">
                    <td className="px-6 py-3 font-medium">{name}</td>
                    {channel === "email" ? (
                      <>
                        <td className="px-6 py-3">{g.emailCampaigns}</td>
                        <td className="px-6 py-3">{g.emails}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3">{g.waCampaigns}</td>
                        <td className="px-6 py-3">{g.waMessages}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {channel === "email" ? (
        <article className="card overflow-hidden p-0">
          <header className="border-b border-border px-6 py-4">
            <h2 className="font-heading text-xl font-semibold">Campañas recientes</h2>
          </header>
          {selectionBar}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th className="w-12 px-6 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleSelectAll(emailIds)}
                      disabled={emailIds.length === 0}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      aria-label="Seleccionar todas"
                    />
                  </th>
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
                    <td className="px-6 py-8 text-text-muted" colSpan={9}>
                      Aún no hay campañas registradas.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className={`border-t border-border ${selectedIds.has(campaign.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(campaign.id)}
                          onChange={() => toggleSelected(campaign.id)}
                          className="h-4 w-4 cursor-pointer accent-primary"
                          aria-label={`Seleccionar ${campaign.title}`}
                        />
                      </td>
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
      ) : (
        <article className="card overflow-hidden p-0">
          <header className="border-b border-border px-6 py-4">
            <h2 className="font-heading text-xl font-semibold">Envíos WhatsApp recientes</h2>
          </header>
          {selectionBar}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th className="w-12 px-6 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleSelectAll(waIds)}
                      disabled={waIds.length === 0}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      aria-label="Seleccionar todos"
                    />
                  </th>
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
                    <td className="px-6 py-8 text-text-muted" colSpan={8}>
                      Aún no hay envíos de WhatsApp registrados.
                    </td>
                  </tr>
                ) : (
                  whatsappCampaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className={`border-t border-border ${selectedIds.has(campaign.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(campaign.id)}
                          onChange={() => toggleSelected(campaign.id)}
                          className="h-4 w-4 cursor-pointer accent-primary"
                          aria-label={`Seleccionar ${campaign.templateName}`}
                        />
                      </td>
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
          {batchMsg && (
            <p className={`border-t border-border px-6 py-3 text-sm ${batchMsg.ok ? "text-success" : "text-error"}`}>
              {batchMsg.text}
            </p>
          )}
        </article>
      )}
    </section>
  );
}
