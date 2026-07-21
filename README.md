# Collection

A small personal museum. It holds things I like — songs, films, books, games, the occasional stray thought — and, for each one, the reason I kept it. The link is the object; the note is the point.

Everything lives as version-controlled JSON. Adding a thing is a commit. The site reads that content and dresses it up in an amber-phosphor CRT theme because why not.

Live at [lib.chakri.me](https://lib.chakri.me).

## What it does

- **Browse** — home (featured / recent / collections / random), Everything with client-side search + a filters dropdown, per-type views, and deep-linkable entry pages.
- **Entries** — a card grid of uniform cards; clicking one opens a focus-trapped modal (a reload or shared link renders the full page instead). Safe Markdown notes (rendered to React elements, never raw HTML). Lazy provider embeds that only load on click and fall back to Open Original.
- **Capture** — the owner pastes or shares a link; the provider registry (Spotify, YouTube, generic web, manual note) detects it and `/api/metadata` enriches it behind an SSRF guard. A review form with a live preview commits the item to the repo.
- **Extras** — animated route transitions, a "suggest something" box that DMs me, cookieless analytics, the boot sequence, an installable PWA manifest with a share target.

Content type and provider are separate, both registry-driven — adding either is one module + one registry entry, no surgery across the app. Unknown types/providers fall back to a safe generic card.

## How content flows

This is the interesting part. Content is JSON in the repo — one file per item under `content/items/<year>/`, plus `collections.json` / `tags.json` / `moods.json`. Where the app *reads* that from is switchable (`lib/content/source.ts`):

- **`fs`** (default) — read the local `content/` directory. This is dev, and any build that ships content alongside the code.
- **`github`** (`CONTENT_SOURCE=github`) — read content from the repo **at runtime** via the GitHub API (one tree call to list files, then the Contents API per file), cached through Next's fetch cache tagged `"content"`. A content-only commit then shows up **without a rebuild**.

Freshness in github mode comes from three places:

1. The write endpoint calls `revalidateTag("content")` right after it commits, so an add/edit is live immediately.
2. `POST /api/revalidate` (shared-secret) — for content edited **directly on GitHub**; point a push webhook at it.
3. A `CONTENT_REVALIDATE` time window (default 300s) as a fallback.

A bad content file is logged and skipped, never fatal — one broken item can't take the site down. A source failure yields an empty collection, not a crashed page.

## Adding a thing

Two ways:

- **The capture UI** (owner-only) — sign in, hit **+ Add** (or share a link into the installed PWA), paste a link, verify the auto-filled fields, save. It commits `content/items/<year>/<slug>.json` for you. The server owns id/slug/timestamps and rejects duplicates.
- **By hand** — drop a JSON file in `content/items/<year>/` matching `lib/content/schema.ts`. Copy an existing item to see the shape.

## The write path

The browser never sees a repo credential. `POST /api/items` does auth + same-origin CSRF + schema validation + dedupe + edit-conflict detection, then commits via a `Committer` picked by environment (`lib/git/committer.ts`):

- **Local** — a `git commit` in the working tree. This is the owner running it on their own machine.
- **GitHub** (`GITHUB_TOKEN` + `GITHUB_REPO` set) — commits through the GitHub Contents API with a repo-scoped, server-only token. This is what a deployed host uses, where there's no local repo.

An idempotency key collapses double-taps/retries into a single commit. Auth is a single-owner password → HMAC-signed HttpOnly session; `proxy.ts` gates `/capture` and `/edit`, and every write route re-verifies. Public pages stay statically generated — owner chrome checks status client-side, so the shared layout never reads cookies.

## Running it

```bash
npm run dev     # dev server on :3000 (fs content source)
npm run build   # production build
npm run lint
```

Copy `.env.example` → `.env.local` and set `OWNER_PASSWORD` + `SESSION_SECRET`. Without them it runs on a loud-warning dev default (password `let-me-in`), which is fine locally and must never ship.

## Deploying (Vercel)

The app uses API routes + `proxy.ts` (Node-only in Next 16) + dynamic owner pages, so it needs a Node/serverless host — not a static export.

1. **Env vars:** `OWNER_PASSWORD`, `SESSION_SECRET`, `CONTENT_SOURCE=github`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TOKEN` (fine-grained PAT, Contents: read+write on just this repo), and `REVALIDATE_SECRET` if you want the webhook. All documented in `.env.example`.
2. **Ignored Build Step** → "Run my Node script":
   ```
   node scripts/vercel-ignore-build.js
   ```
   It exits `0` (skip) when a commit only touches `content/` — those changes are served from GitHub at runtime, so no rebuild — and `1` (build) for any code/config/deps change. Builds by default on any uncertainty.
3. **(Optional)** a GitHub push webhook (filtered to `content/`) → `https://<host>/api/revalidate` with the `REVALIDATE_SECRET`, so edits made directly on GitHub go live instantly instead of within the fallback window.

Net effect: push code → it builds; commit content → it just appears.

## Layout

```
lib/content/        model, schema, registries, source, loader, query helpers
  registry/         provider adapters + content-type registry
lib/capture/        capture input, dedupe, metadata scrape (SSRF-guarded), save
lib/git/            local + GitHub-API committers
content/            the collection itself (JSON, the source of truth)
components/         cards, grid, explorer, modal, note renderer, embed, capture form
app/                routes + api/ (auth, items, metadata, revalidate)
scripts/            vercel-ignore-build.js
```

The look is the "Amber Phosphor Terminal" theme — tokens inlined in `app/globals.css`. One accent color, monospace everywhere, glow instead of shadow. Full guide in `ui_theme.md`. Product + technical spec in `spec.md`.

## Not built yet

Phase 3 museum features (timeline, tag/mood permalink pages, RSS/JSON feeds, install education, app shortcuts), a service worker for offline, and tests (unit / provider-contract / a11y). See `spec.md` §20.
