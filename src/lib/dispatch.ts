import { runDispatcher } from "./api";
import { countDispatchedToday, getCampaignDispatchData } from "./db";

// Cupos GLOBALES por día (corte en America/Bogota) sumando todas las campañas:
// protegen una cuenta de Gmail y un número de Meta, no una campaña.
// OJO: estos valores están DUPLICADOS en la Edge Function `dispatch-runner`,
// que es la que realmente los aplica. Si cambian, cambiarlos en los dos lados.
export const DAILY_EMAIL_LIMIT = 1200;
export const DAILY_WHATSAPP_LIMIT = 1000;

export async function getRemainingDailyQuota(): Promise<number> {
  const dispatchedToday = await countDispatchedToday();
  return Math.max(0, DAILY_EMAIL_LIMIT - dispatchedToday);
}

export type DispatchResult = {
  dispatched: number;
  remainingPending: number;
};

/**
 * Pide al despachador server-side que atienda esta campaña ya mismo y devuelve
 * cuánto salió. El navegador ya no habla con N8N: solo dispara la corrida y
 * relee el estado que dejó (pending_count es la fuente de verdad del progreso).
 */
export async function dispatchNextBatch(campaignId: string): Promise<DispatchResult> {
  const before = await getCampaignDispatchData(campaignId);
  if (before.pendingCount <= 0) {
    return { dispatched: 0, remainingPending: 0 };
  }

  const summary = await runDispatcher({ campaignId, trigger: "manual" });
  if (summary.skipped) {
    throw new Error("Ya hay un despacho en curso. Esperá un momento y volvé a intentar.");
  }
  if (summary.errors.length > 0) {
    throw new Error(summary.errors.join(" | "));
  }

  const after = await getCampaignDispatchData(campaignId);
  return {
    dispatched: Math.max(0, before.pendingCount - after.pendingCount),
    remainingPending: after.pendingCount
  };
}
