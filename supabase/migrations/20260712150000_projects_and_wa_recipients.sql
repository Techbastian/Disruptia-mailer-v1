-- Lote de mejoras 2026-07-12: proyecto por envio + evidencias WhatsApp.
-- Idempotente.

-- El envio hereda el proyecto de la plantilla usada (null = General).
alter table campaigns
  add column if not exists project_id uuid references projects(id) on delete set null;

alter table whatsapp_campaigns
  add column if not exists project_id uuid references projects(id) on delete set null;

-- Las plantillas HSM tambien se agrupan por proyecto (como email_templates).
alter table whatsapp_templates
  add column if not exists project_id uuid references projects(id) on delete set null;

-- Destinatarios de cada envio WhatsApp (evidencias / reportes).
create table if not exists whatsapp_campaign_recipients (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references whatsapp_campaigns(id) on delete cascade,
  phone        text not null,
  -- Variables posicionales resueltas del mensaje: { "1": "Juan", ... }.
  variables    jsonb not null default '{}'::jsonb,
  -- WhatsApp no batchea por cupo (limites de Meta por tier): se insertan como sent.
  status       text not null default 'sent',
  sent_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists wa_campaign_recipients_campaign_idx
  on whatsapp_campaign_recipients (campaign_id);

-- Sin auth todavia (mismo criterio que el resto de tablas del mailer).
alter table whatsapp_campaign_recipients disable row level security;
