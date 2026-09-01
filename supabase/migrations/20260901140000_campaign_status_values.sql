-- Fase 5: estados nuevos del ciclo de despacho.
-- campaigns.status es un ENUM (campaign_status), no texto: sin estos valores el
-- runner explota al filtrar (status=neq.canceled) o al marcar un envio en curso.
-- whatsapp_campaigns.status si es text, no necesita nada.
-- Idempotente.

alter type campaign_status add value if not exists 'scheduled';
alter type campaign_status add value if not exists 'sending';
alter type campaign_status add value if not exists 'canceled';
