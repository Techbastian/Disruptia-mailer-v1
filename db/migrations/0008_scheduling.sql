-- Fase 5: despacho server-side + envios programados (email y WhatsApp).
-- Idempotente.

-- ── 1. Programacion ──────────────────────────────────────────────────────────
-- scheduled_at null = "cuanto antes": la proxima corrida del runner la toma.
alter table campaigns
  add column if not exists scheduled_at timestamptz;

alter table whatsapp_campaigns
  add column if not exists scheduled_at timestamptz;

-- ── 2. WhatsApp tambien batchea ──────────────────────────────────────────────
-- pending_count es la FUENTE DE VERDAD del progreso (status miente en multi-lote:
-- N8N lo pone en 'sent' al terminar cada lote).
alter table whatsapp_campaigns
  add column if not exists pending_count integer not null default 0;

-- Los destinatarios WA nacen PENDIENTES (antes se insertaban ya enviados, porque
-- el envio salia entero desde el navegador).
alter table whatsapp_campaign_recipients
  alter column status set default 'pending';

alter table whatsapp_campaign_recipients
  alter column sent_at drop not null;

alter table whatsapp_campaign_recipients
  alter column sent_at drop default;

-- ── 3. Indices de despacho ───────────────────────────────────────────────────
create index if not exists wa_campaign_recipients_campaign_status_idx
  on whatsapp_campaign_recipients (campaign_id, status);

-- Cupo diario WhatsApp: enviados de hoy entre todas las campanias.
create index if not exists wa_campaign_recipients_sent_at_idx
  on whatsapp_campaign_recipients (sent_at) where status = 'sent';

-- Campanias elegibles para la proxima corrida.
create index if not exists campaigns_dispatchable_idx
  on campaigns (scheduled_at) where pending_count > 0;

create index if not exists whatsapp_campaigns_dispatchable_idx
  on whatsapp_campaigns (scheduled_at) where pending_count > 0;

-- ── 4. Lock anti-solapamiento ────────────────────────────────────────────────
-- Una sola fila ('runner'): la corrida la toma con
-- update ... where locked_until < now() returning id. Si no devuelve fila, ya hay
-- otra corriendo y esta sale sin hacer nada. Sin extensiones ni advisory locks.
create table if not exists dispatch_locks (
  id           text primary key,
  locked_until timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

insert into dispatch_locks (id, locked_until)
  values ('runner', now())
  on conflict (id) do nothing;

alter table dispatch_locks disable row level security;

-- ── 5. Auditoria de corridas ─────────────────────────────────────────────────
create table if not exists dispatch_runs (
  id                  uuid primary key default gen_random_uuid(),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  -- 'schedule' (N8N) | 'manual' (boton del Dashboard) | 'campaign' (recien creada).
  trigger             text not null default 'schedule',
  email_dispatched    integer not null default 0,
  whatsapp_dispatched integer not null default 0,
  campaigns_touched   integer not null default 0,
  skipped             boolean not null default false,
  error               text
);

create index if not exists dispatch_runs_started_at_idx
  on dispatch_runs (started_at desc);

alter table dispatch_runs disable row level security;

-- ── 6. Backfill ──────────────────────────────────────────────────────────────
-- Las campanias WhatsApp existentes ya salieron enteras: pending_count 0 (default)
-- y sus destinatarios siguen 'sent'. Las de email conservan su pending_count.
