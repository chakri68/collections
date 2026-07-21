# Collection

A small personal museum. It holds things I like — songs, films, books, games, the occasional stray thought — and, for each one, the reason I kept it. The link is the object; the note is the point.

Everything lives as version-controlled JSON. Adding a thing is a commit. The site is a static read of that content, dressed up in an amber-phosphor CRT theme because why not.

## Where it's at

**Phase 1 (done): read-only collection.**

- Content model + Zod schema as the single source of truth (`lib/content/`).
- One JSON file per item under `content/items/<year>/`. Invalid items are logged and skipped, never fatal.
- Provider adapters (Spotify, YouTube, generic web, manual note) and a content-type registry — adding either is one module + one registry entry, no surgery across the app.
- Home, Everything (client-side search/filter/sort/random), per-type views, and deep-linkable entry pages.
- Safe Markdown notes (renders to React elements, never raw HTML — nothing to inject).
- Lazy provider embeds that only load on click and fall back to Open Original.
- The boot sequence, installable manifest (with a `share_target` declaration wired for Phase 2).

**Phase 2 (next): owner capture + Git writes** — auth, the share-to-PWA capture flow, metadata enrichment, and the server-side Git commit endpoint. See `spec.md` §8 and §20.

## Running it

```bash
npm run dev     # dev server on :3000
npm run build   # static build — every route prerenders
npm run lint
```

## Adding a thing (for now)

Drop a JSON file in `content/items/<year>/`, matching the shape in `lib/content/schema.ts`. Reference an existing item to see the fields. The build validates it; a bad file just gets skipped with a warning rather than taking the site down.

## Layout

```
lib/content/        model, schema, registries, loader, query helpers
  registry/         provider adapters + content-type registry
content/            the actual collection (JSON, the source of truth)
components/         cards, grid, explorer, note renderer, embed, boot screen
app/                routes — home, everything, type/[type], item/[slug]
```

The look is the "Amber Phosphor Terminal" theme — tokens inlined in `app/globals.css`. One accent color, monospace everywhere, glow instead of shadow. Full guide in `ui_theme.md`.
