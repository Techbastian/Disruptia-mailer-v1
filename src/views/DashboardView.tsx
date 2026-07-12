import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import type { CampaignHistoryItem } from "../types";

type DashboardViewProps = {
  campaigns: CampaignHistoryItem[];
  onDeleteCampaign: (id: string) => Promise<void>;
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

export default function DashboardView({ campaigns, onDeleteCampaign, onRefresh }: DashboardViewProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteCampaign(id);
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

      <article className="card overflow-hidden p-0">
        <header className="border-b border-border px-6 py-4">
          <h2 className="font-heading text-xl font-semibold">Campañas recientes</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-text-muted">
              <tr>
                <th className="px-6 py-3">Título</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Destinatarios</th>
                <th className="px-6 py-3">Calidad de datos</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-text-muted" colSpan={6}>
                    Aún no hay campañas registradas.
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-border">
                    <td className="px-6 py-4 font-medium">{campaign.title}</td>
                    <td className="px-6 py-4 text-text-muted">
                      {new Date(campaign.createdAt).toLocaleString("es-CO")}
                    </td>
                    <td className="px-6 py-4">{campaign.recipients}</td>
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
                            onClick={() => void handleDelete(campaign.id)}
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
                        <button
                          type="button"
                          onClick={() => setConfirmId(campaign.id)}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-error/10 hover:text-error transition-colors"
                          aria-label="Eliminar campaña"
                        >
                          <Trash2 size={15} />
                        </button>
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
