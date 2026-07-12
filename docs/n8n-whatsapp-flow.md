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

## 4. Paso a paso en la UI de N8N (instancia: n8n.srv1018582.hstgr.cloud)

Análogo al workflow de email (`/webhook/envio-correos`), pero para WhatsApp.

**Nodo 1 — Webhook**
1. Workflow nuevo → nombralo `Disruptia WhatsApp`.
2. Agregá un nodo **Webhook**: HTTP Method `POST`, Path `envio-whatsapp`, Respond `Immediately`.
3. La URL de producción quedará: `https://n8n.srv1018582.hstgr.cloud/webhook/envio-whatsapp`
   (mientras el workflow no esté "Active", solo funciona la Test URL `.../webhook-test/...`).

**Nodo 2 — IF (validar secreto)**
1. Agregá un nodo **IF** conectado al Webhook.
2. Condición (String → Equals):
   - Value 1: `{{ $json.headers["x-disruptia-webhook-secret"] }}`
   - Value 2: el secreto que inventes (una cadena larga aleatoria; la misma que va al `.env` de la app).
3. Solo la rama **true** continúa; la false queda sin conectar.

**Nodo 3 — Split Out (destinatarios)**
1. Agregá un nodo **Split Out**.
2. Field to Split Out: `body.recipients` → genera un item por destinatario (`phone` + `variables`).

**Nodo 4 — Loop Over Items**
1. Agregá **Loop Over Items** (Split in Batches), Batch Size `10`.

**Nodo 5 — Code (armar payload YCloud)**
Dentro del loop, un nodo **Code** (Run Once for Each Item) — arma los `parameters` según cuántas
variables tenga la plantilla, sin hardcodear la cantidad:

```js
const t = $('Webhook').first().json.body.template;
const r = $json;
const nums = Object.keys(r.variables ?? {}).sort((a, b) => Number(a) - Number(b));
const payload = {
  from: "TU_NUMERO_EMISOR_YCLOUD", // ej. +57300XXXXXXX (el número registrado en YCloud)
  to: r.phone,
  type: "template",
  template: { name: t.name, language: { code: t.language } }
};
if (nums.length > 0) {
  payload.template.components = [{
    type: "body",
    parameters: nums.map((n) => ({ type: "text", text: String(r.variables[n]) }))
  }];
}
return { json: payload };
```

**Nodo 6 — HTTP Request (YCloud)**
1. Method `POST`, URL `https://api.ycloud.com/v2/whatsapp/messages/sendDirectly`.
2. Authentication: Generic → Header Auth → Name `X-API-Key`, Value = tu API key de YCloud
   (guardala como credencial de N8N; nunca en la app).
3. Send Body: ON → Body Content Type `JSON` → Specify Body `Using JSON` → `{{ JSON.stringify($json) }}`.
4. Settings del nodo: **On Error → Continue** (un número que falle no frena el lote).
5. Salida del nodo → conectar a un nodo **Wait** de `1` segundo → y este de vuelta a **Loop Over Items**.

**Nodo 7 — Reporte a Supabase (rama "done" del loop)**
1. De la salida **done** del Loop, un nodo **IF**: `{{ $('Webhook').first().json.body.sendId }}` → String → `Does Not Start With` → `test-`.
2. En la rama true, un **HTTP Request**:
   - Method `PATCH`
   - URL: `https://upkvrgncduvxzjvtxbpv.supabase.co/rest/v1/whatsapp_campaigns?id=eq.{{ $('Webhook').first().json.body.sendId }}`
   - Headers: `apikey: <anon key>`, `Authorization: Bearer <anon key>`, `Content-Type: application/json`, `Prefer: return=minimal`
   - Body JSON: `{ "status": "sent" }`
   (la anon key es la misma `VITE_SUPABASE_ANON_KEY` del `.env`; RLS está deshabilitado en la tabla).

**Activar**
1. Guardá y poné el workflow en **Active**.
2. Probá con la app (botón "Enviar prueba" — usa `sendId: test-*`, no toca Supabase).

## 5. Checklist para activar el canal

- [ ] Correr `db/migrations/0004_whatsapp_campaigns.sql` en el SQL editor de Supabase.
- [ ] Crear el workflow según la sección 4 y activarlo.
- [ ] Descomentar y completar en `.env`: `VITE_N8N_WHATSAPP_WEBHOOK_URL` y `VITE_N8N_WHATSAPP_WEBHOOK_SECRET` (reiniciar `npm run dev`).
- [ ] Registrar la plantilla aprobada de YCloud en la app (sección Plantillas WhatsApp — la tabla está vacía).
- [x] (App) Envío real + envío de prueba (siempre a +573157281832 + extras) + persistencia en `whatsapp_campaigns` + historial en Dashboard.
