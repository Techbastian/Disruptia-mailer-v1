import type { AssetItem, CampaignHistoryItem, CampaignMetrics, EmailTemplate, Project, WhatsAppTemplate } from "../types";
import { DEFAULT_ACTOR_ID, supabase, SUPABASE_BUCKET_ASSETS } from "./supabase";

type CreateCampaignInput = {
  title: string;
  subject: string;
  prompt: string;
  htmlRaw: string;
  htmlSanitized: string;
  recipientCountEstimate: number;
  validationMetrics: CampaignMetrics | null;
};

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase no esta configurado. Revisa tus variables de entorno.");
  }
  return supabase;
}

const CAMPAIGN_SELECT = "id,title,status,recipient_count_estimate,validation_metrics,created_at";

function rowToCampaign(row: Record<string, unknown>): CampaignHistoryItem {
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as CampaignHistoryItem["status"],
    recipients: (row.recipient_count_estimate as number) ?? 0,
    validationMetrics: (row.validation_metrics as CampaignHistoryItem["validationMetrics"]) ?? null,
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
      status: "queued",
      prompt: input.prompt || null,
      html_raw: input.htmlRaw || null,
      html_sanitized: input.htmlSanitized || null,
      recipient_count_estimate: input.recipientCountEstimate,
      validation_metrics: input.validationMetrics,
      created_by: DEFAULT_ACTOR_ID
    })
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) throw error;
  return rowToCampaign(data);
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignHistoryItem["status"]
): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client.from("campaigns").update({ status }).eq("id", id);
  if (error) throw error;
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
  "id,name,description,html,variables_csv,variables_campaign,project_id,created_at,updated_at";

function rowToTemplate(row: Record<string, unknown>): EmailTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
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
    .insert({ ...payload, created_by: DEFAULT_ACTOR_ID })
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
    .insert({ name, created_by: DEFAULT_ACTOR_ID })
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
  "id,name,language,category,header_text,body_text,footer_text,buttons,created_at,updated_at";

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
    .insert({ ...payload, created_by: DEFAULT_ACTOR_ID })
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
      uploaded_by: DEFAULT_ACTOR_ID
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
