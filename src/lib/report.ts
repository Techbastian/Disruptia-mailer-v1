import {
  getCampaignReportHeader,
  listAllCampaignRecipients,
  listAllWhatsAppCampaignRecipients
} from "./db";
import type { WhatsAppCampaignItem } from "../types";

// Reportes de evidencia en .txt con estructura markdown: título, fecha,
// proyecto, estructura del correo/mensaje y listado de destinatarios.

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "reporte"
  );
}

/** Convierte el HTML del correo a texto plano legible (evidencia del contenido). */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n")
    .trim();
}

function recipientName(data: Record<string, string | undefined>): string {
  const first = data.firstname ?? data.firstName ?? data.nombre ?? "";
  const last = data.lastname ?? data.lastName ?? data.apellido ?? "";
  return `${first ?? ""} ${last ?? ""}`.trim() || "(sin nombre)";
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Genera y descarga el reporte de evidencia de una campaña de email. */
export async function downloadEmailCampaignReport(campaignId: string): Promise<void> {
  const [header, recipients] = await Promise.all([
    getCampaignReportHeader(campaignId),
    listAllCampaignRecipients(campaignId)
  ]);

  const sent = recipients.filter((r) => r.status === "sent");
  const pending = recipients.filter((r) => r.status !== "sent");
  const m = header.validationMetrics;

  const lines: string[] = [
    `# Reporte de envío de correos — ${header.title}`,
    "",
    `- **Fecha de creación:** ${fmtDate(header.createdAt)}`,
    `- **Proyecto:** ${header.projectName ?? "General"}`,
    `- **Canal:** Email`,
    `- **Asunto:** ${header.subject || "—"}`,
    `- **Destinatarios totales:** ${recipients.length} (despachados: ${sent.length}, pendientes: ${pending.length})`
  ];
  if (m) {
    lines.push(
      `- **Calidad del archivo cargado:** ${m.totalLoaded} filas → ${m.validEmails} válidos, ${m.invalidEmails} inválidos, ${m.duplicatesRemoved} duplicados eliminados`
    );
  }
  lines.push(`- **Reporte generado:** ${fmtDate(new Date().toISOString())}`, "");

  lines.push("## Estructura del correo", "");
  const bodyText = htmlToPlainText(header.htmlSanitized);
  lines.push(bodyText || "(sin contenido guardado)", "");

  lines.push(`## Destinatarios (${recipients.length})`, "");
  recipients.forEach((r, i) => {
    const estado = r.status === "sent" ? `despachado ${fmtDate(r.sentAt)}` : "pendiente";
    lines.push(`${i + 1}. ${recipientName(r.data)} — ${r.email} — ${estado}`);
  });
  lines.push("");

  const date = new Date(header.createdAt).toISOString().slice(0, 10);
  downloadTextFile(`reporte-correos-${slugify(header.title)}-${date}.txt`, lines.join("\n"));
}

/** Genera y descarga el reporte de evidencia de un envío de WhatsApp. */
export async function downloadWhatsAppCampaignReport(campaign: WhatsAppCampaignItem): Promise<void> {
  const recipients = await listAllWhatsAppCampaignRecipients(campaign.id);
  const m = campaign.validationMetrics;

  const lines: string[] = [
    `# Reporte de envío de WhatsApp — ${campaign.templateName}`,
    "",
    `- **Fecha de envío:** ${fmtDate(campaign.createdAt)}`,
    `- **Proyecto:** ${campaign.projectName ?? "General"}`,
    `- **Canal:** WhatsApp`,
    `- **Plantilla:** ${campaign.templateName} (${campaign.templateLanguage})`,
    `- **Destinatarios:** ${campaign.recipients}`
  ];
  if (m) {
    lines.push(
      `- **Calidad del archivo cargado:** ${m.totalLoaded} filas → ${m.validPhones} válidos, ${m.invalidPhones} inválidos, ${m.duplicatesRemoved} duplicados eliminados`
    );
  }
  lines.push(`- **Reporte generado:** ${fmtDate(new Date().toISOString())}`, "");

  lines.push(`## Destinatarios (${recipients.length})`, "");
  if (recipients.length === 0) {
    lines.push(
      "(Este envío no tiene destinatarios guardados: es anterior a la función de evidencias de WhatsApp.)"
    );
  }
  recipients.forEach((r, i) => {
    const vars = Object.entries(r.variables)
      .map(([k, v]) => `{{${k}}}=${v}`)
      .join(", ");
    lines.push(`${i + 1}. ${r.phone}${vars ? ` — ${vars}` : ""} — enviado ${fmtDate(r.sentAt)}`);
  });
  lines.push("");

  const date = new Date(campaign.createdAt).toISOString().slice(0, 10);
  downloadTextFile(`reporte-whatsapp-${slugify(campaign.templateName)}-${date}.txt`, lines.join("\n"));
}
