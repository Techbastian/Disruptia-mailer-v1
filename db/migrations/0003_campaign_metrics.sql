-- 0003: metricas de validacion de contactos por campaña.
-- Se muestran en el historial del Dashboard (validos / invalidos / duplicados).
alter table public.campaigns
  add column if not exists validation_metrics jsonb;

comment on column public.campaigns.validation_metrics is
  'Metricas del archivo de contactos al crear la campaña: {totalLoaded, validEmails, invalidEmails, duplicatesRemoved}';
