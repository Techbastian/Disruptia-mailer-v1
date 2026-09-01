-- Fase 0: el asunto del correo pasa a ser un dato de la plantilla.
-- Antes se escribia a mano en cada campania y solo quedaba en campaigns.subject;
-- ahora vive en la plantilla y se reutiliza en todos sus envios.
-- Idempotente.

-- Cadena vacia = plantilla vieja sin asunto definido: la UI obliga a completarlo
-- antes de poder usarla en una campania.
alter table email_templates
  add column if not exists subject text not null default '';
