-- Seguridad: RLS en todas las tablas del mailer + politicas para usuarios logueados.
--
-- Hasta ahora la app entraba con la anon key y RLS deshabilitado: cualquiera con
-- la URL de Vercel leia las listas completas de contactos y podia borrar campanias.
-- Desde aca hace falta una sesion de Supabase Auth (el login de la app).
--
-- ORDEN DE APLICACION: primero tiene que estar desplegado el login y creados los
-- usuarios del equipo. Si se aplica antes, la app queda sin acceso a nada.
--
-- El despachador (Edge Function dispatch-runner) usa service_role, que ignora RLS:
-- los envios programados siguen funcionando sin sesion de nadie.
--
-- Idempotente.

-- ── 1. Tablas de la app: todo permitido para usuarios autenticados ───────────
-- No hay roles ni pertenencia por usuario: el equipo comparte los datos. Lo que
-- se corta es el acceso ANONIMO, que era el agujero real.
do $$
declare
  t text;
begin
  foreach t in array array[
    'campaigns',
    'campaign_runs',
    'campaign_recipients',
    'email_templates',
    'assets',
    'projects',
    'whatsapp_templates',
    'whatsapp_campaigns',
    'whatsapp_campaign_recipients'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'mailer_authenticated_all_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'mailer_authenticated_all_' || t, t
    );
  end loop;
end $$;

-- ── 2. Tablas del despachador: solo service_role ─────────────────────────────
-- El lock no lo toca nadie mas que el runner. Las corridas se pueden LEER desde
-- la app (sirven para el panel "Hoy" de la fase 7), pero no escribir.
alter table public.dispatch_locks enable row level security;
drop policy if exists mailer_authenticated_all_dispatch_locks on public.dispatch_locks;

alter table public.dispatch_runs enable row level security;
drop policy if exists mailer_authenticated_read_dispatch_runs on public.dispatch_runs;
create policy mailer_authenticated_read_dispatch_runs
  on public.dispatch_runs for select to authenticated using (true);

-- ── 3. Storage del bucket de activos ─────────────────────────────────────────
-- Las imagenes de los correos TIENEN que seguir siendo publicas: los destinatarios
-- las cargan desde su bandeja, sin sesion. Lo que se cierra es escribir y borrar.
-- Se limpian solo las politicas que mencionan este bucket, para no tocar otros
-- proyectos que compartan la instancia.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') like '%mailer_assets%' or coalesce(with_check, '') like '%mailer_assets%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy mailer_assets_public_read
  on storage.objects for select to public
  using (bucket_id = 'mailer_assets');

create policy mailer_assets_authenticated_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mailer_assets');

create policy mailer_assets_authenticated_update
  on storage.objects for update to authenticated
  using (bucket_id = 'mailer_assets') with check (bucket_id = 'mailer_assets');

create policy mailer_assets_authenticated_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'mailer_assets');
