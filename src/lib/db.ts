import type { AssetItem, CampaignHistoryItem, EmailTemplate } from "../types";
import { DEFAULT_ACTOR_ID, supabase, SUPABASE_BUCKET_ASSETS } from "./supabase";

type CreateCampaignInput = {
  title: string;
  subject: string;
  prompt: string;
  htmlRaw: string;
  htmlSanitized: string;
  recipientCountEstimate: number;
};

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase no esta configurado. Revisa tus variables de entorno.");
  }
  return supabase;
}

export async function listCampaigns(): Promise<CampaignHistoryItem[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("campaigns")
    .select("id,title,status,recipient_count_estimate,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    status: row.status as CampaignHistoryItem["status"],
    recipients: (row.recipient_count_estimate as number) ?? 0,
    createdAt: row.created_at as string
  }));
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
      created_by: DEFAULT_ACTOR_ID
    })
    .select("id,title,status,recipient_count_estimate,created_at")
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    title: data.title as string,
    status: data.status as CampaignHistoryItem["status"],
    recipients: (data.recipient_count_estimate as number) ?? 0,
    createdAt: data.created_at as string
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

function rowToTemplate(row: Record<string, unknown>): EmailTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    html: row.html as string,
    variablesCsv: (row.variables_csv as string[]) ?? [],
    variablesCampaign: (row.variables_campaign as string[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

export async function listTemplates(): Promise<EmailTemplate[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("email_templates")
    .select("id,name,description,html,variables_csv,variables_campaign,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToTemplate);
}

export async function getTemplate(id: string): Promise<EmailTemplate> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("email_templates")
    .select("id,name,description,html,variables_csv,variables_campaign,created_at,updated_at")
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
};

export async function saveTemplate(input: SaveTemplateInput): Promise<EmailTemplate> {
  const client = ensureSupabase();
  const payload = {
    name: input.name,
    description: input.description,
    html: input.html,
    variables_csv: input.variablesCsv,
    variables_campaign: input.variablesCampaign,
    updated_at: new Date().toISOString()
  };
  const select = "id,name,description,html,variables_csv,variables_campaign,created_at,updated_at";

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

export async function deleteCampaign(id: string): Promise<void> {
  const client = ensureSupabase();
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
