import { sendCampaign } from "./api";
import {
  countDispatchedToday,
  fetchPendingRecipients,
  getCampaignDispatchData,
  markRecipientsDispatched,
  setCampaignPendingCount,
  updateCampaignStatus
} from "./db";

// Cupo GLOBAL por día (hora local) sumando todas las campañas, para no
// exceder el límite de la cuenta de Gmail.
export const DAILY_EMAIL_LIMIT = 1200;

export async function getRemainingDailyQuota(): Promise<number> {
  const dispatchedToday = await countDispatchedToday();
  return Math.max(0, DAILY_EMAIL_LIMIT - dispatchedToday);
}

export type DispatchResult = {
  dispatched: number;
  remainingPending: number;
};

/**
 * Despacha el siguiente lote de destinatarios pendientes de una campaña,
 * acotado por el cupo diario global. Reutiliza el html/asunto guardados en la
 * campaña, así los lotes de días posteriores salen idénticos al primero.
 */
export async function dispatchNextBatch(campaignId: string): Promise<DispatchResult> {
  const campaign = await getCampaignDispatchData(campaignId);
  if (campaign.pendingCount <= 0) {
    return { dispatched: 0, remainingPending: 0 };
  }
  if (!campaign.htmlSanitized) {
    throw new Error("La campaña no tiene HTML guardado; no se puede despachar el lote.");
  }

  const quota = await getRemainingDailyQuota();
  if (quota <= 0) {
    throw new Error(
      `Sin cupo disponible hoy (límite global: ${DAILY_EMAIL_LIMIT}/día). Enviá el lote mañana.`
    );
  }

  const batch = await fetchPendingRecipients(campaignId, quota);
  if (batch.length === 0) {
    // pending_count desincronizado con la tabla: corregirlo.
    await setCampaignPendingCount(campaignId, 0);
    return { dispatched: 0, remainingPending: 0 };
  }

  try {
    await sendCampaign({
      campaignId,
      html: campaign.htmlSanitized,
      subject: campaign.subject,
      contacts: batch.map((r) => r.contact)
    });
  } catch (err) {
    // El lote no salió: los destinatarios siguen pending y la campaña queda
    // failed para que el Dashboard ofrezca reintentar (paridad con la creación).
    await updateCampaignStatus(campaignId, "failed").catch(() => undefined);
    throw err;
  }

  await markRecipientsDispatched(batch.map((r) => r.id));
  const remainingPending = Math.max(0, campaign.pendingCount - batch.length);
  await setCampaignPendingCount(campaignId, remainingPending);
  // N8N la marcará sent al terminar el despacho de este lote.
  await updateCampaignStatus(campaignId, "queued").catch(() => undefined);

  return { dispatched: batch.length, remainingPending };
}
