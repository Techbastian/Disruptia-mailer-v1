-- Frente 2: Proyectos en plantillas
-- Correr en el SQL editor de Supabase (proyecto del .env: upkvrgncduvxzjvtxbpv).
-- Idempotente: se puede correr mas de una vez sin romper.

-- 1. Tabla de proyectos
create table if not exists projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Sin auth todavia (mismo criterio que el resto de tablas del mailer)
alter table projects disable row level security;

-- 2. Columna project_id en email_templates
--    NULL = plantilla "General" (agnostica, visible en todos los proyectos).
--    Al borrar un proyecto, sus plantillas vuelven a General (no se pierden).
alter table email_templates
  add column if not exists project_id uuid references projects(id) on delete set null;

-- 3. Indice para filtrar por proyecto
create index if not exists email_templates_project_id_idx
  on email_templates (project_id);
