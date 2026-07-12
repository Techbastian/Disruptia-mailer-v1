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
