# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Disruptia Mailer v1** is a React + TypeScript SPA (Vite) for outbound campaign automation over **two channels**:

- **Email** — reusable HTML templates + a contact list (CSV/XLSX) → N8N webhook → Gmail.
- **WhatsApp** — Meta/YCloud approved HSM templates + a phone list → a second N8N webhook → YCloud.

Supabase holds all persistence (templates, projects, campaigns, recipients, assets). Template HTML can be
generated with Claude through a Supabase **Edge Function** (the Anthropic key never reaches the browser).
There is **no auth layer**: RLS is disabled on every table and rows are attributed to `VITE_DEFAULT_ACTOR_ID`.

## Commands

```bash
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # tsc -b + production build → /dist
npm run preview   # serve the production build
```

No test suite, no linter. Type errors surface only via `npm run build` (or `npx tsc -b`).

Edge Function (the Supabase CLI is a devDependency — always `npx supabase`, project ref `upkvrgncduvxzjvtxbpv`):

```bash
npx supabase login
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref upkvrgncduvxzjvtxbpv
npx supabase functions deploy generate-template --project-ref upkvrgncduvxzjvtxbpv
```

**Migrations are applied by hand** in the Supabase SQL editor — no migration runner is wired up.
`db/migrations/000N_*.sql` is the authoritative, ordered, idempotent set; `supabase/migrations/` mirrors
0005-0009 for the CLI (0001-0004 were applied by hand and are missing there). New migrations go in `db/migrations/` and must stay idempotent
(`create table if not exists`, `add column if not exists`, `disable row level security`).

## Architecture

`App.tsx` is both the router and the data loader — there is no routing library. `currentView` (a string union
in `types.ts`) selects one of the views; `App.tsx` owns every load-on-mount effect and passes callbacks down,
so views stay mostly presentational. Templates and WhatsApp templates load in **separate** effects with their
own `loading`/`error`/`retry` state, because a missing migration must degrade only its own section.

```
src/
  App.tsx                    # view switch + Supabase sync effects + cross-view handoffs (AI draft, selected ids)
  types.ts                   # AppView union + every domain type (camelCase; db.ts maps to/from snake_case rows)
  store/useMailerStore.ts    # Zustand: loaded collections + the in-progress campaign draft
  lib/
    supabase.ts    # client + hasSupabaseConfig guard (app renders without config, features error out)
    db.ts          # ALL Supabase access (tables + storage). Row→type mapping lives here, nowhere else.
    api.ts         # client of the dispatch-runner Edge Function (runs, test sends). Talks to no webhook.
    dispatch.ts    # daily quota constants + asks the runner for a campaign run
    ai.ts          # calls the generate-template Edge Function
    csv.ts         # CSV/XLSX → contacts, email validation + dedup
    whatsappCsv.ts # same for phones, normalized to E.164
    report.ts      # .txt evidence reports (auto-downloaded after each send)
    sanitizeHtml.ts
  views/           # dashboard, campaign creator, email templates + editor, assets, WhatsApp templates + editor + send
  data/baseTemplates.ts      # 6 seed templates inserted on first run when email_templates is empty
supabase/functions/generate-template/   # Deno Edge Function: Claude → email HTML
supabase/functions/dispatch-runner/     # Deno Edge Function: THE dispatcher (quota, batches, webhooks)
db/migrations/                          # run manually in the Supabase SQL editor
docs/n8n-whatsapp-flow.md               # the app↔N8N WhatsApp contract + node-by-node build guide
docs/n8n-dispatch-runner.md             # the N8N Schedule clock that calls the runner + its contract
```

### Template variables — two kinds, substituted in different places

The **subject also lives in the template** (`email_templates.subject`, migration 0007): it is edited only in the
template editor, shown read-only in step 1 of the creator, and copied into `campaigns.subject` when the campaign
is created — a later template edit must never change what an in-flight campaign sends. It is plain text: the
editor rejects `{{...}}` there.

An `EmailTemplate` declares two disjoint variable lists, both written as `{{name}}` in the HTML:

- `variablesCampaign` — one value for the whole campaign (a link, a date). Substituted **client-side** by
  `CampaignCreatorView.substituteVars` at approval time, then sanitized and stored as `html_sanitized`.
- `variablesCsv` — per recipient. Left as literal `{{col}}` in the stored HTML; **N8N** fills them from each
  contact record. `csv.ts` lower-cases every column name, so the file header must match the variable name.

WhatsApp templates instead use Meta's **positional** `{{1}}`, `{{2}}`; `WhatsAppSendView` maps each index to
either a file column or a fixed value and sends already-resolved `variables: { "1": "…" }` to N8N.

### Send pipeline — one server-side dispatcher (both channels)

Since phase 5 the browser **never** calls an N8N webhook. It persists the campaign and asks the
`dispatch-runner` Edge Function to run; that function owns quota, batching, timezone and the webhook secrets.

1. Approving in `CampaignCreatorView` (or sending in `WhatsAppSendView`) → `createCampaign`
   (`pending_count` = full list) + `addCampaignRecipients` (chunked inserts, `status="pending"`) →
   `runDispatcher({ campaignId })` for immediate feedback, then the campaign row is re-read.
2. `dispatch-runner` takes a one-row lock (`dispatch_locks`), computes the day quota with the cut in
   **America/Bogota** — 1200 email / 1000 WhatsApp, counted **across all campaigns** because they protect one
   Gmail account and one Meta number — and walks the eligible campaigns FIFO.
3. Per batch: mark the recipients `sending` **before** the POST, POST to the webhook, then mark them `sent`
   and decrement `pending_count`. The reserve-before-send is what keeps a dead run from re-sending a batch.
4. No quota left is **not** a failure: the rest stays pending for the next run. Continuation batches (later
   days) only go out 08:00-20:00 Bogota; the first batch of a scheduled campaign goes at its `scheduled_at`.
5. N8N still flips `campaigns.status` to `sent`/`failed` by PATCHing the REST API, so with multiple batches
   `status` lies — **`pending_count` is the source of truth for progress**, not `status`.

If a webhook call fails, the batch returns to `pending` and the campaign is force-marked `failed` — that pair
is what makes the Dashboard retry safe (no duplicate sends). Preserve it in any change to this path.

`campaigns.status` is a Postgres **enum** (`campaign_status`): a new state needs `alter type ... add value`
(migration 0009), not just a TS union. `whatsapp_campaigns.status` is plain text.

The daily limits live in **two** places on purpose (`lib/dispatch.ts` for the UI copy, the Edge Function for
enforcement). Change both.

### Cross-cutting rules

- **Every** Supabase call goes through `lib/db.ts`; views and other libs import from it. `db.ts` starts each
  call with `ensureSupabase()` and converts snake_case rows via the `rowTo*` helpers.
- **All** HTML — template previews, AI output, stored campaign HTML — passes through `sanitizeHtml` before
  rendering, and previews go into `<iframe srcDoc>` with a restricted `sandbox`.
- Secrets stay server-side: `ANTHROPIC_API_KEY` and the N8N webhook URLs/secrets are Supabase function
  secrets, the YCloud API key lives only in N8N credentials. **Nothing secret is left in the browser bundle** —
  only the Supabase URL + anon key. Both webhooks share the same secret header name.
- Test sends (`sendTestEmail`, `sendWhatsAppTest`) also go through the runner (`{ test: {...} }`), which
  forwards them to the production webhook with a synthetic `test-<timestamp>` id that matches no Supabase row,
  so the status report N8N sends back is a harmless no-op. Keep them there: moving them back to the browser
  would put the webhook secrets in the bundle again.
- Only `campaignDraft` is persisted from the Zustand store (localStorage, key `disruptia-mailer-draft`). Its
  custom `StateStorage` drops the contact list on a quota error and flags `contactsDropped`; keep that guard
  if you extend the draft.
- `projectId: null` means "General" everywhere (templates, campaigns, WhatsApp templates). Deleting a project
  sends its templates back to General instead of cascading.

## Environment Variables

`.env` (gitignored; template in `.env.example`). Anything the browser needs must be `VITE_`-prefixed.

```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_BUCKET_ASSETS, VITE_DEFAULT_ACTOR_ID
VITE_WHATSAPP_ENABLED   # optional: "false" hides real WhatsApp sending in the UI
```

The N8N URLs and secrets are **Edge Function secrets**, not `VITE_` vars (see `docs/n8n-dispatch-runner.md`):
`N8N_EMAIL_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET_HEADER`, `N8N_WHATSAPP_WEBHOOK_URL`,
`N8N_WHATSAPP_WEBHOOK_SECRET`. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase.

## Design System

Full spec in `Referencias/DESIGN.md`; tokens live in `tailwind.config.js` (`surface`, `card`, `primary`,
`primary-soft`, `text`, `text-muted`, `border`, `success`, `warning`, `error`) and the `.card` / `.input` /
`.btn-primary` / `.btn-secondary` component classes in `src/styles.css`. Fonts: Manrope (`font-heading`) +
Inter (`font-body`), loaded from Google Fonts in `styles.css`. 8px spacing scale, 8/16px radii.

**All UI copy, code comments and commit messages are in Spanish** — match that when adding code.
