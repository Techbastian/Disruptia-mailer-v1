import type { ContactRecord } from "../types";

const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL ?? "";
const webhookSecret = import.meta.env.VITE_N8N_WEBHOOK_SECRET ?? "";
const webhookSecretHeader = import.meta.env.VITE_N8N_WEBHOOK_SECRET_HEADER ?? "x-disruptia-webhook-secret";

type SendCampaignPayload = {
  campaignId: string;
  html: string;
  subject: string;
  contacts: ContactRecord[];
};

export async function sendCampaign(payload: SendCampaignPayload): Promise<void> {
  if (!webhookUrl) throw new Error("Falta configurar VITE_N8N_WEBHOOK_URL");
  if (!webhookSecret) throw new Error("Falta configurar VITE_N8N_WEBHOOK_SECRET");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [webhookSecretHeader]: webhookSecret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Error al llamar webhook n8n: ${response.status}`);
  }
}
