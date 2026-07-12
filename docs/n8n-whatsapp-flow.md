# Flujo N8N para envíos de WhatsApp (YCloud)

Guía para armar el workflow de N8N que recibe los envíos del mailer y los despacha a YCloud.
Este documento define el **contrato** entre la app y N8N: la app enviará exactamente este payload
cuando se active el botón "Enviar por WhatsApp".

## 1. Contrato: lo que envía la app

**Método:** `POST` a la URL del webhook (se configurará en `.env` como `VITE_N8N_WHATSAPP_WEBHOOK_URL`).

**Headers:**

```
Content-Type: application/json
x-disruptia-webhook-secret: <VITE_N8N_WHATSAPP_WEBHOOK_SECRET>
```

**Body:**

```json
{
  "sendId": "wa-1720900000000",
  "template": {
    "name": "nombre_exacto_aprobado_en_ycloud",
    "language": "es"
  },
  "recipients": [
    {
      "phone": "+573001234567",
      "variables": { "1": "Juan", "2": "viernes 18 de julio" }
    },
    {
      "phone": "+573009876543",
      "variables": { "1": "María", "2": "viernes 18 de julio" }
    }
  ]
}
```

- `sendId`: identificador del envío. Cuando exista la tabla `whatsapp_campaigns` será su UUID; N8N lo usará para reportar el estado final a Supabase.
- `template.name` y `template.language` deben coincidir **exactamente** con la plantilla aprobada en YCloud/Meta.
- `variables`: mapa posicional `{{1}}, {{2}}…` ya resuelto por la app (columna del archivo o valor fijo). Si la plantilla no tiene variables, llega `{}`.
- Los teléfonos llegan ya validados y deduplicados en E.164.

**Envío de prueba:** mismo payload con `sendId` con prefijo `test-` y un único destinatario. En ese caso N8N **no** debe reportar estado a Supabase (el `sendId` no corresponde a ninguna fila).

## 2. Workflow N8N sugerido (nodos)

```
[Webhook] → [IF secret válido] → [Loop Over Items (batch 10)] → [HTTP Request → YCloud] → [Wait 1s] ↩
                                            ↓ (al terminar)
                                   [Supabase: update estado]
```

1. **Webhook** — método POST, "Respond immediately" (la app no espera el resultado del envío masivo, solo la aceptación).
2. **IF (autenticación)** — comparar `{{ $json.headers["x-disruptia-webhook-secret"] }}` contra el secreto. Si no coincide, terminar sin procesar.
3. **Split/Loop Over Items** — iterar `recipients` en lotes chicos (ej. 10) para respetar el rate limit del número (los tiers de Meta limitan conversaciones/día según la calidad del número).
4. **HTTP Request a YCloud** — por cada destinatario:
   - `POST https://api.ycloud.com/v2/whatsapp/messages/sendDirectly`
   - Header: `X-API-Key: <tu API key de YCloud>` (vive SOLO en N8N, nunca en el navegador)
   - Body:

   ```json
   {
     "from": "<tu número emisor de YCloud>",
     "to": "{{ $json.phone }}",
     "type": "template",
     "template": {
       "name": "{{ $('Webhook').item.json.body.template.name }}",
       "language": { "code": "{{ $('Webhook').item.json.body.template.language }}" },
       "components": [
         {
           "type": "body",
           "parameters": [
             { "type": "text", "text": "{{ $json.variables['1'] }}" },
             { "type": "text", "text": "{{ $json.variables['2'] }}" }
           ]
         }
       ]
     }
   }
   ```

   > Nota: el array `parameters` debe tener tantos ítems como variables tenga la plantilla, en orden.
   > Si la plantilla no tiene variables, omitir `components`. Si el **header** de la plantilla tiene
   > variable propia, agregar un componente `{ "type": "header", "parameters": [...] }` aparte.
5. **Wait** — 0.5–1s entre lotes para no golpear el rate limit.
6. **Reporte final a Supabase** (cuando exista `whatsapp_campaigns`): `UPDATE whatsapp_campaigns SET status = 'sent' | 'failed' WHERE id = sendId` — igual que hoy hace el workflow de email con `campaigns.status`. Saltar este paso si `sendId` empieza con `test-`.

## 3. Manejo de errores recomendado

- Configurar el nodo HTTP con "Continue on Fail" y acumular los teléfonos fallidos; un fallo individual no debe frenar el lote.
- YCloud responde `4xx` por plantilla inexistente/idioma incorrecto → el error más común: `template.name` o `language` no coinciden con lo aprobado.
- Números sin WhatsApp no fallan al enviar (fallan async); el estado real llega por webhooks de YCloud (mejora futura: suscribirse a `whatsapp.message.updated`).

## 4. Checklist para activar el canal

- [ ] Crear el workflow según esta guía y activarlo.
- [ ] Definir el secreto compartido y pasarme la URL del webhook + secreto.
- [ ] Agregar a `.env`: `VITE_N8N_WHATSAPP_WEBHOOK_URL` y `VITE_N8N_WHATSAPP_WEBHOOK_SECRET`.
- [ ] (App, lo hace Claude) Cablear el botón de envío real + envío de prueba a un número propio + persistencia en `whatsapp_campaigns`.
