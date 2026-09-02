// Edge Function: dispatch-runner
// ─────────────────────────────────────────────────────────────────────────────
// UNICO camino de despacho de la app (email y WhatsApp). Antes el navegador
// POSTeaba directo a los webhooks de N8N, lo que obligaba a tener los secretos
// en el bundle; ahora el navegador solo pide "corré", y los secretos viven aca.
//
// La llama:
//   - N8N (Schedule Trigger cada 5-10 min) → corrida completa.
//   - La app, al crear/programar una campania o al tocar "Enviar lote" → corrida
//     acotada a esa campania, para feedback inmediato.
//
// Reglas (ver plan-envios-programados):
//   - Cupo GLOBAL por dia: 1200 correos / 1000 WhatsApp, contados entre TODAS las
//     campanias con el corte del dia en America/Bogota (protegen una cuenta de
//     Gmail y un numero de Meta, no una campania).
//   - Sin cupo no se falla: lo pendiente queda para la proxima corrida.
//   - scheduled_at manda para el PRIMER lote a cualquier hora; los lotes de
//     continuacion (dias siguientes) solo salen entre las 08:00 y las 20:00.
//   - pending_count es la fuente de verdad del progreso, no status.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REST = `${SUPABASE_URL}/rest/v1`;

const EMAIL_WEBHOOK_URL = Deno.env.get("N8N_EMAIL_WEBHOOK_URL") ?? "";
const EMAIL_WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET") ?? "";
const WA_WEBHOOK_URL = Deno.env.get("N8N_WHATSAPP_WEBHOOK_URL") ?? "";
const WA_WEBHOOK_SECRET = Deno.env.get("N8N_WHATSAPP_WEBHOOK_SECRET") ?? "";
const WEBHOOK_SECRET_HEADER = Deno.env.get("N8N_WEBHOOK_SECRET_HEADER") ?? "x-disruptia-webhook-secret";

// Cupos diarios globales. WhatsApp depende del tier de Meta del numero: subir
// cuando mejore (hoy 1000, por decision del usuario del 2026-09-01).
const DAILY_EMAIL_LIMIT = 1200;
const DAILY_WHATSAPP_LIMIT = 1000;

// America/Bogota no tiene horario de verano: offset fijo.
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 20;

const LOCK_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000; // PostgREST corta ahi: por eso se pagina.
const ID_CHUNK = 80; // ids por PATCH, para no pasarse de largo con la URL.
const WEBHOOK_TIMEOUT_MS = 60_000;
const MAX_CAMPAIGNS_PER_RUN = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// ── Helpers de PostgREST ─────────────────────────────────────────────────────

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${REST}/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res;
}

async function selectRows<T>(path: string): Promise<T[]> {
  const res = await rest(path);
  return (await res.json()) as T[];
}

/** Cuenta filas sin traerlas (Prefer: count=exact + Range acotado). */
async function countRows(path: string): Promise<number> {
  const res = await rest(path, { headers: { Prefer: "count=exact", Range: "0-0" } });
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

// ── Tiempo en America/Bogota ─────────────────────────────────────────────────

function startOfDayIso(now: Date): string {
  const local = new Date(now.getTime() + BOGOTA_OFFSET_MS);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(startLocal - BOGOTA_OFFSET_MS).toISOString();
}

function bogotaHour(now: Date): number {
  return new Date(now.getTime() + BOGOTA_OFFSET_MS).getUTCHours();
}

// ── Webhooks de N8N ──────────────────────────────────────────────────────────

async function postWebhook(url: string, secret: string, payload: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", [WEBHOOK_SECRET_HEADER]: secret },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`webhook ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ── Destinatarios ────────────────────────────────────────────────────────────

type EmailRecipientRow = { id: string; email: string; data: Record<string, unknown> | null };
type WaRecipientRow = { id: string; phone: string; variables: Record<string, string> | null };

/** Trae hasta `want` pendientes paginando (PostgREST no devuelve mas de 1000). */
async function fetchPending<T>(table: string, columns: string, campaignId: string, want: number): Promise<T[]> {
  const rows: T[] = [];
  while (rows.length < want) {
    const limit = Math.min(PAGE_SIZE, want - rows.length);
    const page = await selectRows<T>(
      `${table}?select=${columns}&campaign_id=eq.${campaignId}&status=eq.pending` +
        `&order=created_at.asc&limit=${limit}&offset=${rows.length}`
    );
    rows.push(...page);
    if (page.length < limit) break;
  }
  return rows;
}

/** Marca un lote entero con el mismo estado, en tandas por largo de URL. */
async function markRecipients(table: string, ids: string[], patch: Record<string, unknown>): Promise<void> {
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    await rest(`${table}?id=in.(${chunk.join(",")})`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch)
    });
  }
}

// ── Despacho ─────────────────────────────────────────────────────────────────

type EmailCampaign = {
  id: string;
  subject: string | null;
  html_sanitized: string | null;
  pending_count: number;
  recipient_count_estimate: number | null;
};

type WaCampaign = {
  id: string;
  template_name: string;
  template_language: string | null;
  pending_count: number;
  recipient_count: number | null;
};

type BatchOutcome = { dispatched: number; error?: string };

/**
 * Un lote de una campania: reserva los destinatarios en 'sending' ANTES de
 * llamar al webhook (si la corrida muere en el medio queda visible y no se
 * re-despacha a ciegas), postea, y recien ahi los marca 'sent'.
 */
async function dispatchEmailBatch(campaign: EmailCampaign, quota: number): Promise<BatchOutcome> {
  if (!campaign.html_sanitized) {
    return { dispatched: 0, error: "la campania no tiene html_sanitized guardado" };
  }
  const want = Math.min(quota, campaign.pending_count);
  const batch = await fetchPending<EmailRecipientRow>("campaign_recipients", "id,email,data", campaign.id, want);
  if (batch.length === 0) {
    // pending_count desincronizado con la tabla: corregirlo.
    await rest(`campaigns?id=eq.${campaign.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ pending_count: 0 })
    });
    return { dispatched: 0 };
  }

  const ids = batch.map((r) => r.id);
  await markRecipients("campaign_recipients", ids, { status: "sending" });

  try {
    await postWebhook(EMAIL_WEBHOOK_URL, EMAIL_WEBHOOK_SECRET, {
      campaignId: campaign.id,
      html: campaign.html_sanitized,
      subject: campaign.subject ?? "",
      contacts: batch.map((r) => ({ ...(r.data ?? {}), email: r.email }))
    });
  } catch (err) {
    // El lote no salio: los destinatarios vuelven a pending y la campania queda
    // failed para que el Dashboard ofrezca reintentar (sin duplicar envios).
    await markRecipients("campaign_recipients", ids, { status: "pending" });
    await rest(`campaigns?id=eq.${campaign.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed" })
    });
    return { dispatched: 0, error: err instanceof Error ? err.message : String(err) };
  }

  await markRecipients("campaign_recipients", ids, { status: "sent", sent_at: new Date().toISOString() });

  const remaining = Math.max(0, campaign.pending_count - batch.length);
  await rest(`campaigns?id=eq.${campaign.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    // El estado final lo pone el runner, no N8N: desde que hay RLS el PATCH de N8N
    // (que usa la anon key) no matchea ninguna fila y las campanias se quedaban
    // "en cola" para siempre. Ademas N8N marcaba 'sent' al terminar CADA lote, lo
    // que mentia en campanias multi-lote.
    body: JSON.stringify({ pending_count: remaining, status: remaining > 0 ? "sending" : "sent" })
  });

  return { dispatched: batch.length };
}

async function dispatchWhatsAppBatch(campaign: WaCampaign, quota: number): Promise<BatchOutcome> {
  const want = Math.min(quota, campaign.pending_count);
  const batch = await fetchPending<WaRecipientRow>(
    "whatsapp_campaign_recipients",
    "id,phone,variables",
    campaign.id,
    want
  );
  if (batch.length === 0) {
    await rest(`whatsapp_campaigns?id=eq.${campaign.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ pending_count: 0 })
    });
    return { dispatched: 0 };
  }

  const ids = batch.map((r) => r.id);
  await markRecipients("whatsapp_campaign_recipients", ids, { status: "sending" });

  try {
    await postWebhook(WA_WEBHOOK_URL, WA_WEBHOOK_SECRET, {
      sendId: campaign.id,
      template: { name: campaign.template_name, language: campaign.template_language ?? "es" },
      recipients: batch.map((r) => ({ phone: r.phone, variables: r.variables ?? {} }))
    });
  } catch (err) {
    await markRecipients("whatsapp_campaign_recipients", ids, { status: "pending" });
    await rest(`whatsapp_campaigns?id=eq.${campaign.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed" })
    });
    return { dispatched: 0, error: err instanceof Error ? err.message : String(err) };
  }

  await markRecipients("whatsapp_campaign_recipients", ids, {
    status: "sent",
    sent_at: new Date().toISOString()
  });

  const remaining = Math.max(0, campaign.pending_count - batch.length);
  await rest(`whatsapp_campaigns?id=eq.${campaign.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    // Mismo criterio que en email: el estado final lo pone el runner.
    body: JSON.stringify({ pending_count: remaining, status: remaining > 0 ? "sending" : "sent" })
  });

  return { dispatched: batch.length };
}

// ── Corrida ──────────────────────────────────────────────────────────────────

type RunSummary = {
  skipped: boolean;
  emailDispatched: number;
  whatsappDispatched: number;
  campaignsTouched: number;
  emailQuotaLeft: number;
  whatsappQuotaLeft: number;
  errors: string[];
};

function isContinuation(total: number | null, pending: number): boolean {
  // Si ya salio al menos un lote, lo que queda es continuacion (ventana diurna).
  return (total ?? pending) > pending;
}

async function runDispatch(now: Date, campaignId: string | null): Promise<RunSummary> {
  const summary: RunSummary = {
    skipped: false,
    emailDispatched: 0,
    whatsappDispatched: 0,
    campaignsTouched: 0,
    emailQuotaLeft: 0,
    whatsappQuotaLeft: 0,
    errors: []
  };

  const nowIso = now.toISOString();
  const dayStart = startOfDayIso(now);
  const hour = bogotaHour(now);
  const inWindow = hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR;

  const sentToday = await countRows(`campaign_recipients?select=id&status=eq.sent&sent_at=gte.${dayStart}`);
  const waSentToday = await countRows(
    `whatsapp_campaign_recipients?select=id&status=eq.sent&sent_at=gte.${dayStart}`
  );
  let emailQuota = Math.max(0, DAILY_EMAIL_LIMIT - sentToday);
  let waQuota = Math.max(0, DAILY_WHATSAPP_LIMIT - waSentToday);

  // Elegibles: con pendientes, no canceladas y con su hora cumplida. Una corrida
  // dirigida (campaignId) ignora scheduled_at: el usuario pidio "ahora".
  const scheduleFilter = campaignId
    ? `&id=eq.${campaignId}`
    : `&or=(scheduled_at.is.null,scheduled_at.lte.${nowIso})`;

  if (emailQuota > 0 && EMAIL_WEBHOOK_URL) {
    const campaigns = await selectRows<EmailCampaign>(
      `campaigns?select=id,subject,html_sanitized,pending_count,recipient_count_estimate` +
        `&pending_count=gt.0&status=neq.canceled${scheduleFilter}` +
        `&order=scheduled_at.asc.nullsfirst&limit=${MAX_CAMPAIGNS_PER_RUN}`
    );
    for (const campaign of campaigns) {
      if (emailQuota <= 0) break;
      if (!campaignId && !inWindow && isContinuation(campaign.recipient_count_estimate, campaign.pending_count)) {
        continue; // lote de continuacion fuera de la ventana diurna
      }
      const outcome = await dispatchEmailBatch(campaign, emailQuota);
      if (outcome.error) summary.errors.push(`email ${campaign.id}: ${outcome.error}`);
      if (outcome.dispatched > 0) {
        emailQuota -= outcome.dispatched;
        summary.emailDispatched += outcome.dispatched;
        summary.campaignsTouched += 1;
      }
    }
  }

  if (waQuota > 0 && WA_WEBHOOK_URL) {
    const campaigns = await selectRows<WaCampaign>(
      `whatsapp_campaigns?select=id,template_name,template_language,pending_count,recipient_count` +
        `&pending_count=gt.0&status=neq.canceled${scheduleFilter}` +
        `&order=scheduled_at.asc.nullsfirst&limit=${MAX_CAMPAIGNS_PER_RUN}`
    );
    for (const campaign of campaigns) {
      if (waQuota <= 0) break;
      if (!campaignId && !inWindow && isContinuation(campaign.recipient_count, campaign.pending_count)) {
        continue;
      }
      const outcome = await dispatchWhatsAppBatch(campaign, waQuota);
      if (outcome.error) summary.errors.push(`whatsapp ${campaign.id}: ${outcome.error}`);
      if (outcome.dispatched > 0) {
        waQuota -= outcome.dispatched;
        summary.whatsappDispatched += outcome.dispatched;
        summary.campaignsTouched += 1;
      }
    }
  }

  summary.emailQuotaLeft = emailQuota;
  summary.whatsappQuotaLeft = waQuota;
  return summary;
}

// ── Envios de prueba ─────────────────────────────────────────────────────────
// Pasan por aca (y no por el navegador) para que los secretos de los webhooks no
// vuelvan al bundle. El id sintetico `test-...` no matchea ninguna fila, asi que
// el reporte de estado que N8N hace despues es un no-op (ver docs/n8n-whatsapp-flow).

const MAX_TEST_RECIPIENTS = 20;

type TestPayload = {
  channel?: string;
  html?: string;
  subject?: string;
  contacts?: Record<string, unknown>[];
  template?: { name: string; language: string };
  recipients?: { phone: string; variables: Record<string, string> }[];
};

async function runTest(test: TestPayload): Promise<void> {
  const testId = `test-${Date.now()}`;

  if (test.channel === "whatsapp") {
    if (!WA_WEBHOOK_URL) throw new Error("Falta configurar N8N_WHATSAPP_WEBHOOK_URL en la Edge Function");
    const recipients = (test.recipients ?? []).slice(0, MAX_TEST_RECIPIENTS);
    if (recipients.length === 0) throw new Error("La prueba no tiene destinatarios");
    if (!test.template?.name) throw new Error("La prueba no indica plantilla");
    await postWebhook(WA_WEBHOOK_URL, WA_WEBHOOK_SECRET, {
      sendId: testId,
      template: { name: test.template.name, language: test.template.language || "es" },
      recipients
    });
    return;
  }

  if (!EMAIL_WEBHOOK_URL) throw new Error("Falta configurar N8N_EMAIL_WEBHOOK_URL en la Edge Function");
  const contacts = (test.contacts ?? []).slice(0, MAX_TEST_RECIPIENTS);
  if (contacts.length === 0) throw new Error("La prueba no tiene destinatarios");
  await postWebhook(EMAIL_WEBHOOK_URL, EMAIL_WEBHOOK_SECRET, {
    campaignId: testId,
    html: test.html ?? "",
    subject: test.subject ?? "",
    contacts
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Faltan SUPABASE_URL / SERVICE_ROLE_KEY" }, 500);

  let body: { campaignId?: string; trigger?: string; test?: TestPayload } = {};
  try {
    body = await req.json();
  } catch {
    /* corrida completa sin cuerpo (N8N) */
  }

  // Prueba: no toca la base ni el lock, solo reenvia al webhook.
  if (body.test) {
    try {
      await runTest(body.test);
      return json({ ok: true, test: true });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
  }

  const campaignId = typeof body.campaignId === "string" && body.campaignId ? body.campaignId : null;
  const trigger = typeof body.trigger === "string" && body.trigger ? body.trigger.slice(0, 32) : "schedule";

  const now = new Date();
  const nowIso = now.toISOString();

  // Lock: si otra corrida sigue viva, esta sale sin hacer nada.
  let locked = false;
  try {
    const res = await rest(`dispatch_locks?id=eq.runner&locked_until=lt.${nowIso}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        locked_until: new Date(now.getTime() + LOCK_MS).toISOString(),
        updated_at: nowIso
      })
    });
    locked = ((await res.json()) as unknown[]).length > 0;
  } catch (err) {
    return json({ error: `No se pudo tomar el lock: ${err instanceof Error ? err.message : err}` }, 500);
  }
  if (!locked) return json({ skipped: true, reason: "otra corrida en curso" });

  // Auditoria de la corrida (nunca debe romper el despacho).
  let runId: string | null = null;
  try {
    const res = await rest("dispatch_runs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ trigger, started_at: nowIso })
    });
    const rows = (await res.json()) as { id: string }[];
    runId = rows[0]?.id ?? null;
  } catch {
    /* sin auditoria, seguimos */
  }

  try {
    const summary = await runDispatch(now, campaignId);
    if (runId) {
      await rest(`dispatch_runs?id=eq.${runId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          finished_at: new Date().toISOString(),
          email_dispatched: summary.emailDispatched,
          whatsapp_dispatched: summary.whatsappDispatched,
          campaigns_touched: summary.campaignsTouched,
          error: summary.errors.length > 0 ? summary.errors.join(" | ").slice(0, 2000) : null
        })
      }).catch(() => undefined);
    }
    return json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await rest(`dispatch_runs?id=eq.${runId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ finished_at: new Date().toISOString(), error: message.slice(0, 2000) })
      }).catch(() => undefined);
    }
    return json({ error: message }, 500);
  } finally {
    // Liberar el lock aunque haya explotado: si no, la app queda trabada 5 min.
    await rest("dispatch_locks?id=eq.runner", {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ locked_until: new Date().toISOString(), updated_at: new Date().toISOString() })
    }).catch(() => undefined);
  }
});
