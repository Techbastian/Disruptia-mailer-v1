-- Frente 4: WhatsApp (YCloud) — registro de plantillas HSM aprobadas por Meta.
-- Correr en el SQL editor de Supabase (proyecto del .env: upkvrgncduvxzjvtxbpv).
-- Idempotente.

create table if not exists whatsapp_templates (
  id           uuid primary key default gen_random_uuid(),
  -- Nombre EXACTO de la plantilla aprobada en YCloud/Meta (ej. invitacion_entrevista).
  name         text not null,
  -- Codigo de idioma de la plantilla aprobada (ej. es, es_AR, en).
  language     text not null default 'es',
  -- Categoria Meta: MARKETING | UTILITY | AUTHENTICATION.
  category     text not null default 'MARKETING',
  -- Encabezado de texto estatico (opcional; '' si no tiene).
  header_text  text not null default '',
  -- Cuerpo con variables posicionales {{1}} {{2}} ... (como en Meta).
  body_text    text not null default '',
  -- Pie de pagina (opcional).
  footer_text  text not null default '',
  -- Botones: jsonb array de { type, text, value }.
  buttons      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid
);

-- Sin auth todavia (mismo criterio que el resto de tablas del mailer).
alter table whatsapp_templates disable row level security;
