import { getAccessToken, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import type { ContactRecord } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Salida hacia N8N. Desde la fase 5 el navegador NO llama a los webhooks: llama
// a la Edge Function `dispatch-runner`, que es la unica que conoce las URLs y
// los secretos. Asi los secretos dejaron de viajar en el bundle.
// ─────────────────────────────────────────────────────────────────────────────

const RUNNER_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/dispatch-runner` : "";

// El runner puede despachar varios lotes en una corrida: más holgado que el
// viejo timeout del webhook (30s).
const RUNNER_TIMEOUT_MS = 120_000;

// WhatsApp se puede desactivar sin tocar código (por si el workflow no está
// armado en un entorno). Por defecto está habilitado.
export const hasWhatsAppWebhookConfig = import.meta.env.VITE_WHATSAPP_ENABLED !== "false";

export type WhatsAppRecipient = {
  phone: string;
  // Variables posicionales ya resueltas: { "1": "Juan", "2": "viernes" }.
  variables: Record<string, string>;
};

export type DispatchRunSummary = {
  skipped: boolean;
  reason?: string;
  emailDispatched: number;
  whatsappDispatched: number;
  campaignsTouched: number;
  emailQuotaLeft: number;
  whatsappQuotaLeft: number;
  errors: string[];
};

async function callRunner<T>(body: unknown, timeoutMs = RUNNER_TIMEOUT_MS): Promise<T> {
  if (!RUNNER_URL) throw new Error("Supabase no está configurado (falta VITE_SUPABASE_URL).");

  const accessToken = await getAccessToken();

  let response: Response;
  try {
    response = await fetch(RUNNER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error(
        "El despachador no respondió a tiempo. El envío puede haber quedado en curso: revisá el Dashboard antes de reintentar."
      );
    }
    throw err;
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* sin cuerpo JSON */
  }

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || `El despachador respondió ${response.status}.`);
  }
  return data as T;
}

/**
 * Pide una corrida del despachador. Sin `campaignId` procesa todo lo que esté
 * vencido (es lo que hace N8N); con `campaignId` va directo a esa campaña,
 * ignorando su programación (el usuario pidió "ahora").
 */
export async function runDispatcher(input: { campaignId?: string; trigger?: string } = {}): Promise<DispatchRunSummary> {
  const summary = await callRunner<Partial<DispatchRunSummary>>({
    campaignId: input.campaignId,
    trigger: input.trigger ?? "manual"
  });
  return {
    skipped: Boolean(summary.skipped),
    reason: summary.reason,
    emailDispatched: summary.emailDispatched ?? 0,
    whatsappDispatched: summary.whatsappDispatched ?? 0,
    campaignsTouched: summary.campaignsTouched ?? 0,
    emailQuotaLeft: summary.emailQuotaLeft ?? 0,
    whatsappQuotaLeft: summary.whatsappQuotaLeft ?? 0,
    errors: summary.errors ?? []
  };
}

/**
 * Envío de prueba de correo: los correos de prueba como destinatarios, con los
 * datos del contacto de muestra para sustituir variables. No crea campaña.
 */
export async function sendTestEmail(input: {
  html: string;
  subject: string;
  testEmails: string[];
  sampleContact: ContactRecord | null;
}): Promise<void> {
  const contacts: ContactRecord[] = input.testEmails.map((email) => ({
    ...(input.sampleContact ?? {}),
    email: email.trim().toLowerCase()
  }));
  await callRunner(
    {
      test: {
        channel: "email",
        html: input.html,
        subject: `[PRUEBA] ${input.subject}`,
        contacts
      }
    },
    60_000
  );
}

/** Envío de prueba WhatsApp (contrato en docs/n8n-whatsapp-flow.md). */
export async function sendWhatsAppTest(input: {
  template: { name: string; language: string };
  testPhones: string[];
  variables: Record<string, string>;
}): Promise<void> {
  await callRunner(
    {
      test: {
        channel: "whatsapp",
        template: input.template,
        recipients: input.testPhones.map((phone) => ({ phone, variables: input.variables }))
      }
    },
    60_000
  );
}
