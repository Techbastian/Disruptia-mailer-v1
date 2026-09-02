import type {
  AssetItem,
  CampaignHistoryItem,
  CampaignMetrics,
  ContactRecord,
  EmailTemplate,
  Project,
  WhatsAppCampaignItem,
  WhatsAppTemplate
} from "../types";
import { getActorId, supabase, SUPABASE_BUCKET_ASSETS } from "./supabase";

type CreateCampaignInput = {
  title: string;
  subject: string;
  prompt: string;
  htmlRaw: string;
  htmlSanitized: string;
  recipientCountEstimate: number;
  pendingCount: number;
  validationMetrics: CampaignMetrics | null;
  projectId: string | null;
  // null = sale en la próxima corrida del despachador.
  scheduledAt?: string | null;
};

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase no esta configurado. Revisa tus variables de entorno.");
  }
  return supabase;
}

const CAMPAIGN_SELECT =
  "id,title,status,recipient_count_estimate,pending_count,scheduled_at,validation_metrics,project_id,projects(name),created_at";

// PostgREST embebe la FK como objeto: projects: { name } | null.
function embeddedProjectName(row: Record<string, unknown>): string | null {
  const project = row.projects as { name?: string } | null;
  return project?.name ?? null;
}

function rowToCampaign(row: Record<string, unknown>): CampaignHistoryItem {
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as CampaignHistoryItem["status"],
    recipients: (row.recipient_count_estimate as number) ?? 0,
    pendingCount: (row.pending_count as number) ?? 0,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    validationMetrics: (row.validation_metrics as CampaignHistoryItem["validationMetrics"]) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    projectName: embeddedProjectName(row),
    createdAt: row.created_at as string
  };
}

export async function listCampaigns(): Promise<CampaignHistoryItem[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []).map(rowToCampaign);
}

export async function createCampaign(input: CreateCampaignInput): Promise<CampaignHistoryItem> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("campaigns")
    .insert({
      title: input.title,
      subject: input.subject,
      status: input.scheduledAt ? "scheduled" : "queued",
      prompt: input.prompt || null,
      html_raw: input.htmlRaw || null,
      html_sanitized: input.htmlSanitized || null,
      recipient_count_estimate: input.recipientCountEstimate,
      pending_count: input.pendingCount,
      scheduled_at: input.scheduledAt ?? null,
      validation_metrics: input.validationMetrics,
      project_id: input.projectId,
      created_by: getActorId()
    })
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) throw error;
  return rowToCampaign(data);
}

// ── Campaign recipients (persistencia; el despacho por lotes vive en el runner) ─

const RECIPIENT_INSERT_CHUNK = 500;

export async function addCampaignRecipients(campaignId: string, contacts: ContactRecord[]): Promise<void> {
  const client = ensureSupabase();
  for (let i = 0; i < contacts.length; i += RECIPIENT_INSERT_CHUNK) {
    const chunk = contacts.slice(i, i + RECIPIENT_INSERT_CHUNK).map((contact) => ({
      campaign_id: campaignId,
      email: contact.email,
      data: contact,
      status: "pending"
    }));
    const { error } = await client.from("campaign_recipients").insert(chunk);
    if (error) throw error;
  }
}

// America/Bogota no tiene horario de verano: offset fijo. Tiene que dar el MISMO
// corte que la Edge Function dispatch-runner, o el cupo se contaría distinto.
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

export function startOfDayBogotaIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() + BOGOTA_OFFSET_MS);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(startLocal - BOGOTA_OFFSET_MS).toISOString();
}

async function countSentToday(table: string): Promise<number> {
  const client = ensureSupabase();
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", startOfDayBogotaIso());
  if (error) throw error;
  return count ?? 0;
}

// ── Programación (fase 6) ─────────────────────────────────────────────────────
// Reprogramar, cancelar y "enviar ahora" son solo cambios de scheduled_at/status:
// el despachador decide sobre esas dos columnas en su próxima corrida.

async function patchCampaignRow(
  table: "campaigns" | "whatsapp_campaigns",
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.from(table).update(patch).eq("id", id);
  if (error) throw error;
}

/** Cambia la fecha de salida. null = que salga cuanto antes. */
export async function rescheduleCampaign(
  id: string,
  scheduledAt: string | null,
  channel: "email" | "whatsapp" = "email"
): Promise<void> {
  await patchCampaignRow(channel === "email" ? "campaigns" : "whatsapp_campaigns", id, {
    scheduled_at: scheduledAt,
    status: scheduledAt ? "scheduled" : "queued"
  });
}

/** Cancela: el runner ignora las canceladas y los pendientes quedan sin tocar. */
export async function cancelCampaign(id: string, channel: "email" | "whatsapp" = "email"): Promise<void> {
  await patchCampaignRow(channel === "email" ? "campaigns" : "whatsapp_campaigns", id, { status: "canceled" });
}

/** Correos despachados hoy (Bogotá) entre TODAS las campañas — cupo global diario. */
export async function countDispatchedToday(): Promise<number> {
  return countSentToday("campaign_recipients");
}

/** Mensajes de WhatsApp despachados hoy (Bogotá) entre TODOS los envíos. */
export async function countWhatsAppSentToday(): Promise<number> {
  return countSentToday("whatsapp_campaign_recipients");
}

export type CampaignDispatchData = {
  id: string;
  title: string;
  subject: string;
  htmlSanitized: string;
  pendingCount: number;
};

export async function getCampaignDispatchData(id: string): Promise<CampaignDispatchData> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("campaigns")
    .select("id,title,subject,html_sanitized,pending_count")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    title: data.title as string,
    subject: (data.subject as string) ?? "",
    htmlSanitized: (data.html_sanitized as string) ?? "",
    pendingCount: (data.pending_count as number) ?? 0
  };
}

export async function createCampaignRun(campaignId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.from("campaign_runs").insert({
    campaign_id: campaignId,
    status: "queued",
    daily_limit: 1000
  });
  if (error) throw error;
}

export async function listAssets(): Promise<AssetItem[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("assets")
    .select("id,name,kind,public_url,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as AssetItem["kind"],
    publicUrl: row.public_url as string,
    createdAt: row.created_at as string
  }));
}

// ── Templates ────────────────────────────────────────────────────────────────

const TEMPLATE_SELECT =
  "id,name,description,subject,html,variables_csv,variables_campaign,project_id,created_at,updated_at";

function rowToTemplate(row: Record<string, unknown>): EmailTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    subject: (row.subject as string) ?? "",
    html: row.html as string,
    variablesCsv: (row.variables_csv as string[]) ?? [],
    variablesCampaign: (row.variables_campaign as string[]) ?? [],
    projectId: (row.project_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

export async function listTemplates(): Promise<EmailTemplate[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("email_templates")
    .select(TEMPLATE_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToTemplate);
}

export async function getTemplate(id: string): Promise<EmailTemplate> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("email_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return rowToTemplate(data);
}

export type SaveTemplateInput = {
  id?: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  variablesCsv: string[];
  variablesCampaign: string[];
  projectId?: string | null;
};

export async function saveTemplate(input: SaveTemplateInput): Promise<EmailTemplate> {
  const client = ensureSupabase();
  const payload = {
    name: input.name,
    description: input.description,
    subject: input.subject,
    html: input.html,
    variables_csv: input.variablesCsv,
    variables_campaign: input.variablesCampaign,
    project_id: input.projectId ?? null,
    updated_at: new Date().toISOString()
  };
  const select = TEMPLATE_SELECT;

  if (input.id) {
    const { data, error } = await client
      .from("email_templates")
      .update(payload)
      .eq("id", input.id)
      .select(select)
      .single();
    if (error) throw error;
    return rowToTemplate(data);
  }

  const { data, error } = await client
    .from("email_templates")
    .insert({ ...payload, created_by: getActorId() })
    .select(select)
    .single();
  if (error) throw error;
  return rowToTemplate(data);
}

export async function deleteTemplate(id: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.from("email_templates").delete().eq("id", id);
  if (error) throw error;
}

// Reasignacion rapida de proyecto (projectId = null → General).
export async function setTemplateProject(id: string, projectId: string | null): Promise<EmailTemplate> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("email_templates")
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(TEMPLATE_SELECT)
    .single();
  if (error) throw error;
  return rowToTemplate(data);
}

// ── Projects ──────────────────────────────────────────────────────────────────

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as string
  };
}

export async function listProjects(): Promise<Project[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("projects")
    .select("id,name,created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToProject);
}

export async function createProject(name: string): Promise<Project> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("projects")
    .insert({ name, created_by: getActorId() })
    .select("id,name,created_at")
    .single();
  if (error) throw error;
  return rowToProject(data);
}

export async function deleteProject(id: string): Promise<void> {
  const client = ensureSupabase();
  // Las plantillas asociadas pasan a General por ON DELETE SET NULL.
  const { error } = await client.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ── WhatsApp templates ─────────────────────────────────────────────────────────

const WA_TEMPLATE_SELECT =
  "id,name,language,category,header_text,body_text,footer_text,buttons,project_id,created_at,updated_at";

function rowToWhatsAppTemplate(row: Record<string, unknown>): WhatsAppTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    language: (row.language as string) ?? "es",
    category: (row.category as WhatsAppTemplate["category"]) ?? "MARKETING",
    headerText: (row.header_text as string) ?? "",
    bodyText: (row.body_text as string) ?? "",
    footerText: (row.footer_text as string) ?? "",
    buttons: (row.buttons as WhatsAppTemplate["buttons"]) ?? [],
    projectId: (row.project_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

export async function listWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("whatsapp_templates")
    .select(WA_TEMPLATE_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToWhatsAppTemplate);
}

export type SaveWhatsAppTemplateInput = Omit<WhatsAppTemplate, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export async function saveWhatsAppTemplate(input: SaveWhatsAppTemplateInput): Promise<WhatsAppTemplate> {
  const client = ensureSupabase();
  const payload = {
    name: input.name,
    language: input.language,
    category: input.category,
    header_text: input.headerText,
    body_text: input.bodyText,
    footer_text: input.footerText,
    buttons: input.buttons,
    project_id: input.projectId ?? null,
    updated_at: new Date().toISOString()
  };

  if (input.id) {
    const { data, error } = await client
      .from("whatsapp_templates")
      .update(payload)
      .eq("id", input.id)
      .select(WA_TEMPLATE_SELECT)
      .single();
    if (error) throw error;
    return rowToWhatsAppTemplate(data);
  }

  const { data, error } = await client
    .from("whatsapp_templates")
    .insert({ ...payload, created_by: getActorId() })
    .select(WA_TEMPLATE_SELECT)
    .single();
  if (error) throw error;
  return rowToWhatsAppTemplate(data);
}

export async function deleteWhatsAppTemplate(id: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.from("whatsapp_templates").delete().eq("id", id);
  if (error) throw error;
}

// ── WhatsApp campaigns (historial de envíos) ──────────────────────────────────

const WA_CAMPAIGN_SELECT =
  "id,template_name,template_language,recipient_count,pending_count,scheduled_at,status,validation_metrics,project_id,projects(name),created_at";

function rowToWhatsAppCampaign(row: Record<string, unknown>): WhatsAppCampaignItem {
  return {
    id: row.id as string,
    templateName: row.template_name as string,
    templateLanguage: (row.template_language as string) ?? "es",
    recipients: (row.recipient_count as number) ?? 0,
    pendingCount: (row.pending_count as number) ?? 0,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    status: row.status as WhatsAppCampaignItem["status"],
    validationMetrics: (row.validation_metrics as WhatsAppCampaignItem["validationMetrics"]) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    projectName: embeddedProjectName(row),
    createdAt: row.created_at as string
  };
}

export async function listWhatsAppCampaigns(): Promise<WhatsAppCampaignItem[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("whatsapp_campaigns")
    .select(WA_CAMPAIGN_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(rowToWhatsAppCampaign);
}

/** Un envío WhatsApp por id: para releer su estado después de despachar. */
export async function listWhatsAppCampaign(id: string): Promise<WhatsAppCampaignItem | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("whatsapp_campaigns")
    .select(WA_CAMPAIGN_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToWhatsAppCampaign(data) : null;
}

export type CreateWhatsAppCampaignInput = {
  templateName: string;
  templateLanguage: string;
  recipientCount: number;
  // Arranca con la lista entera pendiente: la despacha el runner por lotes.
  pendingCount: number;
  // null = sale en la próxima corrida del despachador.
  scheduledAt?: string | null;
  validationMetrics: WhatsAppCampaignItem["validationMetrics"];
  projectId: string | null;
};

export async function createWhatsAppCampaign(input: CreateWhatsAppCampaignInput): Promise<WhatsAppCampaignItem> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("whatsapp_campaigns")
    .insert({
      template_name: input.templateName,
      template_language: input.templateLanguage,
      recipient_count: input.recipientCount,
      pending_count: input.pendingCount,
      scheduled_at: input.scheduledAt ?? null,
      status: input.scheduledAt ? "scheduled" : "queued",
      validation_metrics: input.validationMetrics,
      project_id: input.projectId,
      created_by: getActorId()
    })
    .select(WA_CAMPAIGN_SELECT)
    .single();
  if (error) throw error;
  return rowToWhatsAppCampaign(data);
}

export async function deleteWhatsAppCampaign(id: string): Promise<void> {
  const client = ensureSupabase();
  // Los destinatarios caen por ON DELETE CASCADE.
  const { error } = await client.from("whatsapp_campaigns").delete().eq("id", id);
  if (error) throw error;
}

// ── WhatsApp campaign recipients (evidencias) ─────────────────────────────────

export type WhatsAppRecipientRecord = {
  phone: string;
  variables: Record<string, string>;
};

export async function addWhatsAppCampaignRecipients(
  campaignId: string,
  recipients: WhatsAppRecipientRecord[]
): Promise<void> {
  const client = ensureSupabase();
  for (let i = 0; i < recipients.length; i += RECIPIENT_INSERT_CHUNK) {
    const chunk = recipients.slice(i, i + RECIPIENT_INSERT_CHUNK).map((r) => ({
      campaign_id: campaignId,
      phone: r.phone,
      variables: r.variables,
      status: "pending"
    }));
    const { error } = await client.from("whatsapp_campaign_recipients").insert(chunk);
    if (error) throw error;
  }
}

// ── Datos para reportes de evidencia ──────────────────────────────────────────

const REPORT_PAGE_SIZE = 1000;

export type EmailRecipientReportRow = {
  email: string;
  data: ContactRecord;
  status: string;
  sentAt: string | null;
};

/** Todos los destinatarios de una campaña (paginado: PostgREST corta en 1000). */
export async function listAllCampaignRecipients(campaignId: string): Promise<EmailRecipientReportRow[]> {
  const client = ensureSupabase();
  const rows: EmailRecipientReportRow[] = [];
  for (let from = 0; ; from += REPORT_PAGE_SIZE) {
    const { data, error } = await client
      .from("campaign_recipients")
      .select("email,data,status,sent_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
      .range(from, from + REPORT_PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      rows.push({
        email: row.email as string,
        data: (row.data as ContactRecord) ?? { email: row.email as string },
        status: row.status as string,
        sentAt: (row.sent_at as string | null) ?? null
      });
    }
    if (!data || data.length < REPORT_PAGE_SIZE) break;
  }
  return rows;
}

export type CampaignReportHeader = {
  title: string;
  subject: string;
  createdAt: string;
  projectName: string | null;
  htmlSanitized: string;
  validationMetrics: CampaignMetrics | null;
};

export async function getCampaignReportHeader(id: string): Promise<CampaignReportHeader> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("campaigns")
    .select("title,subject,created_at,html_sanitized,validation_metrics,projects(name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    title: data.title as string,
    subject: (data.subject as string) ?? "",
    createdAt: data.created_at as string,
    projectName: embeddedProjectName(data),
    htmlSanitized: (data.html_sanitized as string) ?? "",
    validationMetrics: (data.validation_metrics as CampaignMetrics | null) ?? null
  };
}

export type WhatsAppRecipientReportRow = {
  phone: string;
  variables: Record<string, string>;
  sentAt: string | null;
};

export async function listAllWhatsAppCampaignRecipients(
  campaignId: string
): Promise<WhatsAppRecipientReportRow[]> {
  const client = ensureSupabase();
  const rows: WhatsAppRecipientReportRow[] = [];
  for (let from = 0; ; from += REPORT_PAGE_SIZE) {
    const { data, error } = await client
      .from("whatsapp_campaign_recipients")
      .select("phone,variables,sent_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
      .range(from, from + REPORT_PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      rows.push({
        phone: row.phone as string,
        variables: (row.variables as Record<string, string>) ?? {},
        sentAt: (row.sent_at as string | null) ?? null
      });
    }
    if (!data || data.length < REPORT_PAGE_SIZE) break;
  }
  return rows;
}

export async function deleteCampaign(id: string): Promise<void> {
  const client = ensureSupabase();
  // Primero los runs asociados para no dejar huerfanos (no hay ON DELETE CASCADE).
  const { error: runsError } = await client.from("campaign_runs").delete().eq("campaign_id", id);
  if (runsError) throw runsError;
  const { error } = await client.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAsset(id: string): Promise<void> {
  const client = ensureSupabase();
  const { data, error: fetchError } = await client
    .from("assets")
    .select("storage_path, bucket")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  const { error: storageError } = await client.storage
    .from((data.bucket as string) || SUPABASE_BUCKET_ASSETS)
    .remove([data.storage_path as string]);
  if (storageError) throw storageError;
  const { error } = await client.from("assets").delete().eq("id", id);
  if (error) throw error;
}

// ── Assets ───────────────────────────────────────────────────────────────────

export async function uploadAssetAndSave(file: File): Promise<AssetItem> {
  const client = ensureSupabase();
  const storagePath = `${Date.now()}-${file.name}`;
  const { error: uploadError } = await client.storage.from(SUPABASE_BUCKET_ASSETS).upload(storagePath, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = client.storage.from(SUPABASE_BUCKET_ASSETS).getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl;

  const { data, error } = await client
    .from("assets")
    .insert({
      name: file.name,
      kind: "image",
      bucket: SUPABASE_BUCKET_ASSETS,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: getActorId()
    })
    .select("id,name,kind,public_url,created_at")
    .single();
  if (error) throw error;

  return {
    id: data.id as string,
    name: data.name as string,
    kind: data.kind as AssetItem["kind"],
    publicUrl: data.public_url as string,
    createdAt: data.created_at as string
  };
}
