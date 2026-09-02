-- Limpieza de politicas heredadas.
--
-- La 0010 activo RLS y creo la politica de usuarios autenticados, pero algunas
-- tablas ya tenian politicas viejas y PERMISIVAS de cuando la app entraba con la
-- anon key (detectado en `assets`: seguia devolviendo filas al anonimo despues de
-- la 0010, porque en RLS las politicas se SUMAN: alcanza una que permita).
--
-- Deja UNA sola politica por tabla: la del mailer.
-- Idempotente.

do $$
declare
  t text;
  pol record;
  keep text;
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
    keep := 'mailer_authenticated_all_' || t;
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t and policyname <> keep
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;

  -- Tablas del despachador: solo service_role escribe; la app solo lee corridas.
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'dispatch_locks'
  loop
    execute format('drop policy %I on public.dispatch_locks', pol.policyname);
  end loop;

  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'dispatch_runs'
      and policyname <> 'mailer_authenticated_read_dispatch_runs'
  loop
    execute format('drop policy %I on public.dispatch_runs', pol.policyname);
  end loop;
end $$;
