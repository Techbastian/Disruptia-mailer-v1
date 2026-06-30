# Edge Function: generate-template

Genera el HTML de plantillas de correo con Claude (Sonnet 4.6). La
`ANTHROPIC_API_KEY` vive como **secreto** en Supabase — nunca en el navegador.

## Despliegue (una sola vez)

La CLI está instalada como dependencia del proyecto, así que se usa con
`npx supabase ...`. Corré esto desde la raíz del proyecto:

```bash
# 1. Iniciar sesión en Supabase (interactivo: abre el navegador o pide un token)
npx supabase login

# 2. Cargar la API key de Anthropic como secreto (NO va en .env ni en el bundle)
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui --project-ref upkvrgncduvxzjvtxbpv

# 3. Desplegar la función
npx supabase functions deploy generate-template --project-ref upkvrgncduvxzjvtxbpv
```

Tras esto, la función queda en:
`https://upkvrgncduvxzjvtxbpv.supabase.co/functions/v1/generate-template`
y la app la llama automáticamente (deriva la URL de `VITE_SUPABASE_URL`).

> Alternativa al paso 1 sin navegador: creá un Personal Access Token en
> https://supabase.com/dashboard/account/tokens y corré
> `npx supabase login --token sbp_tu_token`.

## Actualizar la función

Si cambia el código (`index.ts`), volvé a desplegar:

```bash
npx supabase functions deploy generate-template --project-ref upkvrgncduvxzjvtxbpv
```

## Cambiar la API key

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-nueva-clave --project-ref upkvrgncduvxzjvtxbpv
```

## Notas

- **Auth:** la función verifica el JWT por defecto; la app envía la `anon key`
  como `Authorization: Bearer`. Para un control más estricto contra abuso
  (rate limiting / auth real) ver fase posterior.
- **Modelo:** `claude-sonnet-4-6`, fijado en `index.ts` (`MODEL`).
- **Datos que recibe:** solo brief + nombres de variables + HTML de plantillas
  de referencia. Nunca contactos, emails ni listas.
