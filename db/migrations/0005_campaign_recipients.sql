-- Fase 3: persistencia de destinatarios por campaña + batching del excedente.
-- Idempotente.

create table if not exists campaign_recipients (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  email       text not null,
  -- Registro completo del contacto (todas las columnas del archivo) para
  -- sustituir variables {{col}} al despachar lotes posteriores.
  data        jsonb not null default '{}'::jsonb,
  -- pending: aun no despachado | sent: entregado a N8N | failed: reservado
  -- para cuando N8N reporte fallos por destinatario (backlog).
  status      text not null default 'pending',
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists campaign_recipients_campaign_status_idx
  on campaign_recipients (campaign_id, status);

-- Para el conteo del cupo diario global (1200/dia entre todas las campañas).
create index if not exists campaign_recipients_sent_at_idx
  on campaign_recipients (sent_at) where status = 'sent';

-- Destinatarios que faltan por despachar (denormalizado para no agregar en el listado).
alter table campaigns add column if not exists pending_count integer not null default 0;

-- Sin auth todavia (mismo criterio que el resto de tablas del mailer).
alter table campaign_recipients disable row level security;
