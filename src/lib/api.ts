import type { ContactRecord } from "../types";

const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL ?? "";
const webhookSecret = import.meta.env.VITE_N8N_WEBHOOK_SECRET ?? "";
const webhookSecretHeader = import.meta.env.VITE_N8N_WEBHOOK_SECRET_HEADER ?? "x-disruptia-webhook-secret";

// Timeout del webhook: N8N solo encola, no debería tardar más que esto.
const WEBHOOK_TIMEOUT_MS = 30_000;

type SendCampaignPayload = {
  campaignId: string;
  html: string;
  subject: string;
  contacts: ContactRecord[];
};

async function postToWebhook(payload: SendCampaignPayload): Promise<void> {
  if (!webhookUrl) throw new Error("Falta configurar VITE_N8N_WEBHOOK_URL");
  if (!webhookSecret) throw new Error("Falta configurar VITE_N8N_WEBHOOK_SECRET");

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [webhookSecretHeader]: webhookSecret
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("El webhook de N8N no respondió a tiempo (30s). Verificá que el workflow esté activo.");
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Error al llamar webhook n8n: ${response.status}`);
  }
}

export async function sendCampaign(payload: SendCampaignPayload): Promise<void> {
  await postToWebhook(payload);
}

/**
 * Envío de prueba: mismo webhook, con los correos de prueba como destinatarios,
 * usando los datos del contacto de muestra para sustituir variables.
 * No crea campaña en Supabase; el campaignId sintético no matchea ninguna fila.
 */
// ── WhatsApp (contrato en docs/n8n-whatsapp-flow.md) ─────────────────────────

const waWebhookUrl = import.meta.env.VITE_N8N_WHATSAPP_WEBHOOK_URL ?? "";
const waWebhookSecret = import.meta.env.VITE_N8N_WHATSAPP_WEBHOOK_SECRET ?? "";

// La vista deshabilita el envío real mientras el webhook no esté configurado.
export const hasWhatsAppWebhookConfig = Boolean(waWebhookUrl && waWebhookSecret);

export type WhatsAppRecipient = {
  phone: string;
  // Variables posicionales ya resueltas: { "1": "Juan", "2": "viernes" }.
  variables: Record<string, string>;
};

export type SendWhatsAppPayload = {
  sendId: string;
  template: { name: string; language: string };
  recipients: WhatsAppRecipient[];
};

export async function sendWhatsAppCampaign(payload: SendWhatsAppPayload): Promise<void> {
  if (!waWebhookUrl) throw new Error("Falta configurar VITE_N8N_WHATSAPP_WEBHOOK_URL");
  if (!waWebhookSecret) throw new Error("Falta configurar VITE_N8N_WHATSAPP_WEBHOOK_SECRET");

  let response: Response;
  try {
    response = await fetch(waWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [webhookSecretHeader]: waWebhookSecret
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("El webhook de WhatsApp no respondió a tiempo (30s). Verificá que el workflow esté activo.");
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Error al llamar webhook WhatsApp de n8n: ${response.status}`);
  }
}

/**
 * Envío de prueba WhatsApp: mismo webhook, sendId con prefijo test- para que
 * N8N no reporte estado a Supabase (ver docs/n8n-whatsapp-flow.md).
 */
export async function sendWhatsAppTest(input: {
  template: { name: string; language: string };
  testPhones: string[];
  variables: Record<string, string>;
}): Promise<void> {
  await sendWhatsAppCampaign({
    sendId: `test-${Date.now()}`,
    template: input.template,
    recipients: input.testPhones.map((phone) => ({ phone, variables: input.variables }))
  });
}

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
  await postToWebhook({
    campaignId: `test-${Date.now()}`,
    html: input.html,
    subject: `[PRUEBA] ${input.subject}`,
    contacts
  });
}
