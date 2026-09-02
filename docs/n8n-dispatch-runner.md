# El reloj del despachador (N8N → `dispatch-runner`)

Desde la fase 5 **todo** el despacho de la app pasa por una sola Edge Function,
`dispatch-runner`. El navegador ya no llama a los webhooks de N8N: solo pide
"corré". N8N deja de ser el que decide *qué* sale y pasa a ser dos cosas:

- **el reloj** — un Schedule Trigger que llama a la función cada 5–10 minutos;
- **el brazo** — los dos workflows de envío que ya existen (`envio-correos` y
  `envio-whatsapp`), que la función invoca con los mismos payloads de siempre.

La lógica (cupos, lotes, zona horaria, reintentos) vive en TypeScript versionado
en git, no en nodos Code.

## Qué hace cada corrida

1. Toma un **lock** de una fila (`dispatch_locks`). Si otra corrida sigue viva,
   sale sin hacer nada — una corrida lenta nunca se pisa con la siguiente.
2. Calcula el **cupo del día** con el corte en `America/Bogota`:
   `1200 - correos enviados hoy` y `1000 - WhatsApp enviados hoy`, contando
   entre **todas** las campañas (protegen una cuenta de Gmail y un número de
   Meta, no una campaña).
3. Busca las campañas con `pending_count > 0`, no canceladas, cuya
   `scheduled_at` ya venció (o es nula = "cuanto antes"), en orden FIFO.
4. Por cada una, mientras quede cupo: toma un lote paginado, marca esos
   destinatarios **`sending`**, postea al webhook, y recién ahí los marca
   `sent` y descuenta `pending_count`.
5. Sin cupo **no falla**: lo que quedó pendiente lo toma la próxima corrida.
   Los lotes de continuación (días siguientes) solo salen entre las **08:00 y
   las 20:00** de Bogotá; el primer lote de una campaña programada sale a la
   hora que diga `scheduled_at`.

Si un webhook falla, ese lote vuelve a `pending` y la campaña queda `failed`:
esa combinación es la que hace seguro reintentar desde el Dashboard sin
duplicar envíos.

Cada corrida queda registrada en la tabla `dispatch_runs` (cuándo, qué disparó,
cuánto salió por canal y el error si lo hubo).

## Armar el workflow del reloj

**Nombre sugerido:** `disruptia-dispatch-runner`

### 1. Schedule Trigger

- Nodo: **Schedule Trigger**
- Trigger Interval: **Minutes**, cada **10** (5 también sirve; menos no aporta:
  el lock evita solapamientos, pero cada corrida consulta la base).

### 2. HTTP Request

- Nodo: **HTTP Request**
- **Method:** `POST`
- **URL:** `https://<project-ref>.supabase.co/functions/v1/dispatch-runner`
  (para este proyecto: `https://upkvrgncduvxzjvtxbpv.supabase.co/functions/v1/dispatch-runner`)
- **Headers:**

  | Name            | Value                  |
  |-----------------|------------------------|
  | `Content-Type`  | `application/json`     |
  | `apikey`        | *(anon key del proyecto)* |
  | `Authorization` | `Bearer <anon key>`    |

- **Body (JSON):**

  ```json
  { "trigger": "schedule" }
  ```

- **Options → Timeout:** `120000` (2 min). Una corrida con varios lotes tarda.

> La anon key es pública (ya viaja en el bundle del front). Lo que dejó de estar
> expuesto son los **secretos de los webhooks**: ahora viven como secretos de la
> Edge Function y solo ella los usa.

### 3. (Opcional) Aviso de error

Un nodo de notificación colgado de la salida de error del HTTP Request, o
revisar `dispatch_runs` donde `error is not null`.

## Respuesta de la función

```json
{
  "skipped": false,
  "emailDispatched": 340,
  "whatsappDispatched": 0,
  "campaignsTouched": 1,
  "emailQuotaLeft": 860,
  "whatsappQuotaLeft": 1000,
  "errors": []
}
```

- `skipped: true` con `reason` → había otra corrida en curso; no es un error.
- `errors` trae un renglón por campaña que falló; el resto igual se despacha.

## Otras formas de llamarla

La app usa la **misma** función, con el cuerpo cambiado:

| Quién | Cuerpo | Efecto |
|---|---|---|
| N8N (reloj) | `{"trigger":"schedule"}` | corrida completa |
| Crear campaña | `{"campaignId":"…","trigger":"campaign"}` | despacha esa campaña ya (ignora su programación) |
| "Enviar lote" del Dashboard | `{"campaignId":"…","trigger":"manual"}` | ídem |
| Envío de prueba | `{"test":{…}}` | reenvía al webhook con un id sintético `test-…`, sin tocar la base |
| N8N al terminar un lote | `{"report":{"campaignId":"…","channel":"email","status":"failed"}}` | marca la campaña como fallida |

### El reporte de resultado

El estado **`sent` lo pone el runner**, no N8N: es el único que sabe si quedaron
lotes pendientes (N8N solo ve el lote que acaba de procesar y en una campaña
multi-lote diría "terminada" desde el primero).

Lo que N8N sí sabe y el runner no es si **Gmail aceptó o rechazó** los correos.
Por eso el workflow de correos cierra con el nodo **"Reportar resultado a la
app"**, que postea `{"report": …}` a la función. Solo se aplica `status:
"failed"` (que N8N manda cuando *ningún* correo del lote salió); los `sent` se
ignoran y los ids `test-…` también.

Ese reporte **no se autentica con el JWT sino con el secreto del webhook**
(header `x-disruptia-webhook-secret`), que N8N ya tiene. Antes este nodo escribía
directo a la tabla con la anon key: al activar RLS empezó a no matchear ninguna
fila **devolviendo 200 igual**, así que las campañas se quedaban "En cola" para
siempre sin que nada fallara a la vista.

El workflow de WhatsApp no reporta nada: su nodo equivalente escribía `"sent"`
fijo, sin detección de fallos, así que quedó **desactivado** — el runner ya hace
ese trabajo.

## Secretos que necesita la función

```bash
npx supabase secrets set \
  N8N_EMAIL_WEBHOOK_URL=... \
  N8N_WEBHOOK_SECRET=... \
  N8N_WEBHOOK_SECRET_HEADER=x-disruptia-webhook-secret \
  N8N_WHATSAPP_WEBHOOK_URL=... \
  N8N_WHATSAPP_WEBHOOK_SECRET=... \
  --project-ref upkvrgncduvxzjvtxbpv
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase sola: la
función escribe con service_role, así no depende de la anon key ni de RLS
(que se activa en el paso siguiente del plan).

Deploy:

```bash
npx supabase functions deploy dispatch-runner --project-ref upkvrgncduvxzjvtxbpv
```
