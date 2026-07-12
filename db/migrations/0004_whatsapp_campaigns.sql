-- Fase 2: WhatsApp (YCloud) — historial de envios.
-- Correr en el SQL editor de Supabase (proyecto del .env: upkvrgncduvxzjvtxbpv).
-- Idempotente.

create table if not exists whatsapp_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  -- Nombre e idioma EXACTOS de la plantilla aprobada usada en el envio.
  template_name      text not null,
  template_language  text not null default 'es',
  -- Cantidad de destinatarios validos incluidos en el envio.
  recipient_count    integer not null default 0,
  -- queued → N8N lo actualiza a sent | failed al terminar el despacho.
  status             text not null default 'queued',
  -- Metricas de validacion del archivo cargado: { totalLoaded, validPhones, invalidPhones, duplicatesRemoved }.
  validation_metrics jsonb,
  created_at         timestamptz not null default now(),
  created_by         uuid
);

-- Sin auth todavia (mismo criterio que el resto de tablas del mailer).
alter table whatsapp_campaigns disable row level security;
