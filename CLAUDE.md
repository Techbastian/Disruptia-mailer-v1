# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Disruptia Mailer v1** is a React + TypeScript SPA for email campaign automation. It lets users upload contact lists (CSV/XLSX), generate AI-powered email HTML via N8N webhooks, sanitize and preview the HTML, then queue campaigns in Supabase.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # TypeScript check + production build → /dist
npm run preview   # Serve production build locally
```

No test suite configured. No linter configured.

## Architecture

```
src/
  main.tsx                 # React DOM mount
  App.tsx                  # Root component, view routing
  types.ts                 # Shared TypeScript types
  styles.css               # Tailwind imports + custom utility classes (.card, .btn-primary, etc.)
  components/Layout.tsx    # Fixed sidebar navigation
  views/
    DashboardView.tsx      # Campaign history + validation metrics
    CampaignCreatorView.tsx # Contact upload, prompt input, HTML generation, approval
    AssetLibraryView.tsx   # Image upload and gallery (Supabase Storage)
  store/useMailerStore.ts  # Zustand global state (contacts, campaigns, assets, generatedHtml)
  lib/
    supabase.ts            # Supabase client (reads VITE_SUPABASE_* env vars)
    db.ts                  # All Supabase DB operations (campaigns, assets, runs)
    api.ts                 # N8N webhook call for HTML generation
    csv.ts                 # PapaParse + XLSX parsing, email validation, deduplication
    sanitizeHtml.ts        # DOMPurify wrapper — always call this before rendering user/AI HTML
```

**Data flow for campaign creation:**
1. `csv.ts` parses uploaded file → validates emails, deduplicates (full list kept, no cut)
2. User writes a prompt → `api.ts` POSTs to N8N webhook with prompt + contacts
3. N8N returns HTML → `sanitizeHtml.ts` strips XSS vectors → sandboxed `<iframe>` preview
4. "Aprobar" saves campaign (`status="queued"`) + full recipient list in `campaign_recipients`, then dispatches the first batch up to the **global 1200/day quota** (`lib/dispatch.ts`, counted across all campaigns); the excess stays `pending` and is sent from the Dashboard via "Enviar lote"

## Key Technical Decisions

- **State**: Zustand (`useMailerStore`) is the single source of truth; views read from it and dispatch actions
- **HTML security**: All generated/external HTML must go through `sanitizeHtml` (DOMPurify) before rendering. Preview iframes use a restricted `sandbox` attribute.
- **N8N auth**: Webhook calls include a secret via header `VITE_N8N_WEBHOOK_SECRET_HEADER` (value = `VITE_N8N_WEBHOOK_SECRET`)
- **Supabase actor**: Campaigns are attributed to `VITE_DEFAULT_ACTOR_ID` (UUID) — there's no auth layer yet
- **File support**: Contacts can be `.csv` or `.xlsx`; the `csv.ts` module handles both

## Environment Variables

Defined in `.env` (excluded from git). Template in `.env.example`:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_BUCKET_ASSETS   # Storage bucket name for images
VITE_DEFAULT_ACTOR_ID         # UUID used as campaign author
VITE_N8N_WEBHOOK_URL
VITE_N8N_WEBHOOK_SECRET_HEADER
VITE_N8N_WEBHOOK_SECRET
```

All env vars must be prefixed with `VITE_` to be accessible in the browser bundle.

## Design System

Defined in `Referencias/DESIGN.md`. Key points:
- **Colors**: Extended Tailwind theme (`surface`, `card`, `primary`, `text-*`, `border`, `success`, `warning`, `error`)
- **Fonts**: Manrope (headings) + Inter (body) — loaded via CSS, not installed locally
- **Spacing**: 8px base scale, 8px/16px border-radius, 24px gutters
- **Custom classes**: `.card`, `.input`, `.btn-primary`, `.btn-secondary` defined in `styles.css`
- UI language is **Spanish** (lang="es")
