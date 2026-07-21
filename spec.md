# Personal Collection — Product & Technical Specification

## 1. Product Summary

Personal Collection is an installable, public-facing PWA for collecting and sharing things the owner likes: songs, albums, movies, television shows, YouTube videos, articles, books, games, websites, standalone notes, and future content types.

The site should feel like a small personal museum rather than a media tracker or social network. Every item may include a short personal note explaining why it matters. Visitors browse a polished, themed website; the owner can add items rapidly by sharing links from other apps into the installed PWA.

All published content is stored as version-controlled JSON in a Git repository. Adding or editing an item creates a commit, and the production site updates after the repository's normal deployment completes.

## 2. Goals

- Provide one beautiful home for things the owner recommends or wants to remember.
- Allow links to be captured through the operating system share sheet using the Web Share Target API.
- Keep content portable, human-readable, versioned, and editable as Git-backed JSON.
- Make providers and content types extensible without modifying the core UI for every new service.
- Support personal notes as both annotations on media and independent published entries.
- Present a deliberate animated loading experience before revealing a completely assembled site.
- Remain useful when embeds, metadata services, or the network are unavailable.

## 3. Non-goals

- Becoming a multi-user social network.
- Hosting copyrighted music or video files.
- Replacing Spotify, YouTube, Google TV, Letterboxd, Goodreads, or similar services.
- Providing full media playback for providers that do not offer official embeds.
- Allowing anonymous visitors to modify the collection.
- Acting as a general-purpose rich-text CMS in the initial release.

## 4. Primary Experiences

### 4.1 Public browsing

A visitor opens the site and sees a branded animated loading sequence while the content snapshot, configuration, fonts, and essential visual assets load. The application then transitions into the complete collection.

Visitors can:

- Browse everything or select a type, collection, tag, mood, or time period.
- Search titles, creators, notes, tags, and collections.
- Open a themed detail modal for any item.
- Read the owner's note without leaving the site.
- Play supported embeds on demand.
- Open the original item in its native service.
- Open and share a permanent URL for an individual entry.
- Request a random item from the collection.

### 4.2 Share-to-PWA capture

The owner shares a URL or text from an application such as Spotify, YouTube, Google TV, a browser, or another installed app and chooses Personal Collection from the operating system share sheet.

The PWA must:

1. Receive the shared `title`, `text`, and/or `url` through its manifest share target.
2. Extract all candidate URLs from the payload.
3. Ask the provider registry to identify the best matching provider adapter.
4. Normalize tracking parameters and provider-specific URL variants.
5. Fetch or infer available metadata.
6. Open a prefilled review screen.
7. Allow the owner to edit the title, type, note, tags, mood, collection, artwork, visibility, and featured state.
8. Show a preview of the resulting card.
9. Commit the item only after explicit confirmation.
10. Display commit/deployment progress and retain a retryable local draft if saving fails.

Share Target support is a progressive enhancement. The same capture screen must also be reachable through an in-app Add button and accept pasted URLs or plain text.

### 4.3 Standalone notes

The owner can publish a note that is not attached to external media. Notes are first-class collection items and may contain:

- A title, optional subtitle, and body.
- Markdown-style paragraphs, emphasis, lists, blockquotes, and links from a restricted safe subset.
- Tags, mood, collection membership, cover artwork, accent colour, and publication date.
- Optional relationships to other collection entries.
- Draft, unlisted, or published visibility.

Notes use the same cards, routes, search, filters, Git history, and sharing model as other items. A media entry may also contain a shorter annotation in its `note` field. Long annotations may be promoted to a standalone note and related back to the original item.

## 5. Information Architecture

### 5.1 Primary views

- **Home:** featured items, recently added items, selected collections, and a Random Thing action.
- **Everything:** the complete filterable collection.
- **Type view:** items matching a registered content type, such as songs, movies, videos, books, games, articles, or notes.
- **Collections:** editorial groupings such as “Things that broke my brain,” “Comfort watches,” or “Movies I would erase my memory to watch again.”
- **Timeline:** discoveries grouped by year or period.
- **Entry permalink:** a shareable page for one item.
- **Capture:** authenticated owner-only add/review flow.
- **Editor:** authenticated owner-only edit and delete/archive flow.

Navigation is generated from configuration and registered types. Adding a new type must not require adding a hardcoded navigation component.

### 5.2 Discovery features

- Full-text client-side search.
- Type, provider, tag, mood, year, and collection filters.
- Sort by recently added, oldest, title, custom rank, or manually curated order.
- Random item, optionally scoped to the current filters.
- Featured and pinned items.
- Related items based on explicit relationships, shared tags, type, or collection.
- Stable deep links for entries, types, tags, moods, and collections.

## 6. Extensible Content Architecture

Content type and provider are separate concepts:

- A **content type** describes what an item is: `song`, `album`, `movie`, `show`, `video`, `article`, `book`, `game`, `website`, `note`, or a future type.
- A **provider** describes where it came from: `spotify`, `youtube`, `google-tv`, `letterboxd`, `goodreads`, `steam`, `web`, `manual`, or a future provider.

The core application operates on a normalized `ContentItem`. It must not contain provider-specific rendering branches scattered through page components.

### 6.1 Provider adapter contract

Each provider is registered through a provider adapter:

```ts
interface ProviderAdapter {
  id: string;
  displayName: string;
  priority?: number;

  matches(input: ShareInput): boolean | Promise<boolean>;
  normalize(input: ShareInput): Promise<NormalizedSource>;
  resolveMetadata(source: NormalizedSource): Promise<ResolvedMetadata>;
  getEmbed?(item: ContentItem): EmbedDescriptor | null;
  getOpenUrl(item: ContentItem): string;
}
```

An adapter owns URL recognition, canonicalization, ID extraction, metadata resolution, embed creation, and outbound links for its provider.

Adapters are registered in one registry. A new provider should normally require:

1. One adapter module.
2. One registry entry.
3. Optional theme tokens or a specialised card presentation.
4. Adapter fixtures and contract tests.

It should not require changes to storage, routing, filtering, search, capture state, or the base card component.

### 6.2 Content type registry

Display behaviour is driven by a type registry:

```ts
interface ContentTypeDefinition {
  id: string;
  label: string;
  pluralLabel: string;
  icon: string;
  defaultAspectRatio: string;
  allowedLayouts: string[];
  metadataFields?: FieldDefinition[];
}
```

Unknown future types must render with a safe generic card instead of breaking the application.

### 6.3 Generic web fallback

If no specialised provider matches, the generic web adapter should:

- Canonicalize the URL.
- Attempt server-side Open Graph, Twitter Card, JSON-LD, favicon, and document-title extraction.
- Suggest a type based on metadata while allowing manual correction.
- Render a generic link card with artwork, domain, title, description, note, and Open Original action.

Plain text without a URL is treated as a new standalone note.

## 7. Data Model

### 7.1 Repository layout

```text
content/
  manifest.json
  items/
    2026/
      everything-in-its-right-place.json
      arrival.json
      note-why-old-films-feel-different.json
  collections.json
  tags.json
  moods.json
  redirects.json
  schema/
    content-item.schema.json
    manifest.schema.json
public/
  media/
    items/
```

One file per item is preferred over a single monolithic `content.json` because it reduces merge conflicts, produces meaningful diffs, and keeps commits readable. The build pipeline generates optimized aggregate files such as `content.generated.json`, `songs.generated.json`, and a search index. Generated aggregates are not the authoring source of truth.

### 7.2 Content item

```ts
interface ContentItem {
  schemaVersion: number;
  id: string;
  slug: string;
  type: string;
  provider: string;

  title: string;
  subtitle?: string;
  creator?: string;
  description?: string;
  note?: string;
  noteFormat?: "plain" | "markdown";

  source?: {
    url: string;
    canonicalUrl?: string;
    providerId?: string;
    embedUrl?: string;
  };

  artwork?: {
    src: string;
    alt: string;
    dominantColor?: string;
    blurhash?: string;
    attribution?: string;
  };

  metadata?: Record<string, string | number | boolean | string[] | null>;
  tags: string[];
  moods: string[];
  collections: string[];
  relatedItemIds?: string[];

  featured?: boolean;
  pinned?: boolean;
  rank?: number;
  visibility: "draft" | "unlisted" | "published" | "archived";

  discoveredAt?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}
```

Provider-specific properties belong in `metadata`. Core UI must tolerate absent optional metadata.

### 7.3 Standalone note example

```json
{
  "schemaVersion": 1,
  "id": "note-old-films",
  "slug": "why-old-films-feel-different",
  "type": "note",
  "provider": "manual",
  "title": "Why old films feel different",
  "note": "There is a kind of patience in them that newer films rarely allow...",
  "noteFormat": "markdown",
  "tags": ["films", "memory"],
  "moods": ["nostalgic"],
  "collections": ["small-thoughts"],
  "relatedItemIds": ["arrival"],
  "visibility": "published",
  "createdAt": "2026-07-21T13:30:00+05:30",
  "updatedAt": "2026-07-21T13:30:00+05:30",
  "publishedAt": "2026-07-21T13:30:00+05:30"
}
```

### 7.4 Manifest

`manifest.json` records the generated snapshot version, build timestamp, item counts, available filters, type registry version, and content hashes. The client uses it to determine whether cached content is current.

## 8. Git-backed Write Pipeline

The browser must never receive a repository access token.

### 8.1 Save request

1. The authenticated owner submits a normalized item to a server-side endpoint.
2. The server validates authentication, CSRF protection, payload size, URL safety, and the JSON schema.
3. The server fetches the latest repository revision.
4. It checks for duplicate provider IDs, canonical URLs, IDs, and slugs.
5. It creates or modifies the appropriate item file.
6. It optionally downloads and stores permitted artwork, or records a remote image URL according to site policy.
7. It commits the change through the Git provider API using a narrowly scoped credential.
8. It returns the commit SHA and an operation status.
9. The normal repository deployment builds and publishes the new snapshot.
10. The PWA polls a deployment/status endpoint or the public manifest until that commit is live.

Suggested commit messages:

```text
content: add Everything in Its Right Place by Radiohead
content: update note for Arrival
content: publish Why old films feel different
```

### 8.2 Update conflicts

- Every edit includes the base blob SHA or item `updatedAt` value.
- If the repository changed after the editor loaded the item, the server returns a conflict rather than silently overwriting it.
- The UI shows the current and submitted versions and allows the owner to retry after review.
- Idempotency keys prevent repeated taps or network retries from creating duplicate commits.

### 8.3 Deletes

The default delete action changes visibility to `archived`. Permanent deletion is an explicitly separate action and still remains recoverable through Git history.

### 8.4 Drafts and offline capture

- Unsaved capture state is persisted in IndexedDB.
- Offline shares open as local drafts.
- Drafts are queued and retried only after the owner confirms submission.
- Failed Git writes retain their payload, preview, error state, and retry action.
- Local drafts are private to the device and are never included in the public content snapshot.

## 9. PWA Requirements

- Installable web app manifest with name, short name, icons, theme colours, start URL, and standalone display mode.
- `share_target` declaration accepting `title`, `text`, and `url`.
- Service worker interception and forwarding of share-target requests to the capture route.
- Offline app shell and cached most-recent published snapshot.
- IndexedDB storage for capture drafts and pending submissions.
- Install prompt presented contextually, not immediately on first paint.
- App shortcuts for Add Item, New Note, Random Item, and Recently Added where supported.
- Clear fallback instructions when installation or Share Target is unavailable.
- Share-target input parsing must handle URLs placed inside the `text` field rather than assuming `url` is populated.

## 10. Loading Experience

The animated loading screen is an intentional opening sequence and part of the site's identity.

### 10.1 Loading phases

The animation may respond to real phases rather than a fake percentage:

1. App shell ready.
2. Configuration and manifest loaded.
3. Content aggregates loaded and validated.
4. Essential fonts and above-the-fold artwork decoded.
5. Search/filter indexes initialized.
6. Collection revealed through a coordinated transition.

The screen can show playful changing copy such as “Opening the archive,” “Rewinding the tapes,” or type-specific objects passing through the scene. Exact visual direction belongs in a separate design document.

### 10.2 Behavioural requirements

- Minimum display duration may be used to preserve the animation rhythm, but should remain short on repeat visits.
- A cached repeat visit should feel intentionally quick rather than replaying an unnecessarily long sequence.
- External embeds are explicitly excluded from the blocking load; they load only after interaction.
- Non-critical below-the-fold images are excluded from the blocking load.
- If loading exceeds a defined timeout, show retry and Continue with cached content actions.
- If one content item is invalid, log and omit that item rather than trapping the entire site on the loading screen.
- Respect `prefers-reduced-motion` with a quiet fade-based alternative.
- The final layout must not jump after the loading screen exits; reserve artwork and card dimensions in advance.

## 11. Cards, Detail Modals, and Embeds

### 11.1 Base card

Every card is built from a common composition:

- Artwork or type-specific visual fallback.
- Type and provider indicators.
- Title, creator/subtitle, tags, and optional mood.
- Short note preview.
- Open Details, Play/Watch/Read, and Open Original actions as applicable.

Types and providers supply visual tokens and optional slots; they do not replace the accessible base interaction model.

### 11.2 Detail modal

- Opens from a card without losing scroll/filter state.
- Displays the complete note, metadata, related items, provider action, and share action.
- Is keyboard accessible, focus trapped, dismissible with Escape, and represented by a deep-linkable route.
- On direct navigation, renders as a full entry page while preserving the same content.

### 11.3 Embeds

- Official embeds are loaded lazily only after explicit user interaction.
- Providers without embeds show a themed preview and Open Original action.
- The surrounding frame matches the site theme; cross-origin iframe internals are not assumed to be styleable.
- Embed failure falls back to the standard card without breaking the modal.
- Only allowlisted, provider-generated embed origins may be rendered.
- Avoid initializing multiple media players simultaneously; beginning one playback may pause another where provider APIs permit it.

## 12. Metadata and Artwork

- Metadata resolution happens server-side to avoid exposing credentials and to bypass browser CORS limitations.
- The capture preview indicates which fields were inferred and allows manual correction.
- Store the canonical provider ID and URL whenever available.
- Prefer locally persisted, optimized artwork when licensing and provider terms allow it; otherwise retain a remote URL and a deterministic fallback.
- Record meaningful alt text instead of deriving it solely from filenames.
- Generate width/height, dominant colour, and a lightweight placeholder during the build.
- Treat fetched metadata as a convenience, not an authority: user edits win.
- Never block publishing solely because metadata enrichment failed.

## 13. Search, Collections, Timeline, and Recommendations

- Generate a lightweight search index at build time from published and unlisted-eligible fields.
- Search covers title, creator, description, personal note, tags, moods, collections, and selected metadata.
- Collections have their own title, description, artwork, manual order, and visibility.
- Timeline uses `discoveredAt` when present and falls back to `publishedAt` or `createdAt`.
- Random Thing chooses uniformly by default and supports current filters.
- Related recommendations prioritize explicit `relatedItemIds`, followed by collection, mood, tags, and type similarity.
- No behavioural tracking or opaque recommendation algorithm is required.

## 14. Authentication and Security

- All public reads are anonymous and static/cacheable.
- Capture, edit, archive, and Git status routes require owner authentication.
- Use a server-managed secure session with `HttpOnly`, `Secure`, and appropriate `SameSite` cookies.
- The Git credential is server-only, repository-scoped, and limited to required content writes.
- Validate every write against a versioned JSON Schema.
- Sanitize note Markdown and disallow arbitrary HTML, scripts, event handlers, and unsafe URL schemes.
- Protect metadata fetching against SSRF by validating protocols, resolving hosts safely, imposing size/time limits, and blocking internal/private network destinations.
- Rate-limit write and metadata endpoints.
- Allowlist embed hosts and generate embed URLs through trusted adapters rather than accepting raw iframe HTML.
- Never commit secrets, sessions, raw authentication responses, or private local drafts.

## 15. Build and Deployment

On each content or application commit, CI must:

1. Validate all source JSON against its schema.
2. Verify unique IDs, slugs, canonical URLs where applicable, and valid relationships.
3. Verify referenced tags, moods, and collections.
4. Run provider adapter contract tests.
5. Generate aggregate content files, type-specific files, the search index, RSS/JSON feeds, sitemap, and content manifest.
6. Optimize permitted local images and generate placeholders.
7. Build the application.
8. Run unit, integration, accessibility, and smoke tests.
9. Deploy only if validation succeeds.

If a content commit fails CI, the capture UI should report that the commit was saved but not published and link the owner to actionable build status where possible.

## 16. Accessibility and Performance

- Meet WCAG 2.2 AA contrast and interaction expectations.
- Full keyboard navigation for cards, filters, dialogs, players, and capture forms.
- Visible focus styles and semantic headings/landmarks.
- Reduced-motion mode for loading and card transitions.
- Artwork alt text and labelled provider actions.
- Do not autoplay audio or video.
- Public content and metadata should be statically generated or CDN-cacheable.
- Lazy-load embeds and non-critical artwork.
- Avoid shipping provider SDKs until the associated embed is requested.
- Target good Core Web Vitals after the intentional loading sequence; do not use the animation to conceal an unnecessarily large initial bundle.

## 17. Analytics and Privacy

Analytics are optional. If enabled, prefer a small privacy-respecting system and collect only aggregate events such as entry opened, provider link followed, random item requested, or install prompt accepted. Do not send personal drafts, note text, shared payloads, or authentication data to analytics.

## 18. Error States

The product must define friendly states for:

- Unsupported or malformed share payload.
- Unknown provider handled by the generic web adapter.
- Metadata lookup failure.
- Duplicate item detection.
- Authentication expiry during capture.
- Offline capture.
- Git API failure or rate limiting.
- Repository write conflict.
- Successful commit awaiting deployment.
- CI or deployment failure.
- Invalid content item skipped during public loading.
- Embed blocked, unavailable, or region restricted.
- No search or filter results.

No recoverable failure should discard the owner's draft.

## 19. Suggested Technical Shape

The specification is framework-agnostic, but a suitable implementation could use:

- TypeScript throughout.
- A static-capable frontend framework such as SvelteKit or Next.js.
- A service worker generated with Workbox or the framework's PWA integration.
- Zod for runtime input validation plus emitted or parallel JSON Schemas for repository validation.
- A serverless authenticated write endpoint for metadata enrichment and Git provider API calls.
- IndexedDB via a small typed wrapper for drafts and offline queueing.
- A CI workflow for schema validation, aggregate generation, testing, and deployment.

Provider adapters and the normalized content schema are architectural requirements; the particular libraries are not.

## 20. Delivery Phases

### Phase 1 — Read-only collection

- Core schema and repository layout.
- Build-time validation and aggregate generation.
- Animated loading experience.
- Home, Everything, type filters, cards, detail modal, notes, search, and permalinks.
- Spotify, YouTube, generic web, manual note, and movie/show adapters.
- Lazy embeds and Open Original actions.

### Phase 2 — Owner capture and Git writes

- Authentication.
- Paste/manual Add flow.
- Web Share Target integration.
- Metadata enrichment and capture preview.
- Git commit endpoint, duplicate handling, deployment status, and editing.
- Local drafts and offline capture queue.

### Phase 3 — Personal museum features

- Curated collections, moods, tags, timeline, related items, and Random Thing.
- Install education and app shortcuts.
- Shareable entry cards and optional feeds.
- Additional provider adapters based on actual use.

## 21. Acceptance Criteria for Initial Release

- The public site loads a validated Git-backed collection and reveals it through the animated loading sequence.
- A malformed individual entry cannot permanently block the loading screen.
- Visitors can browse, search, filter, open detail modals, read notes, follow original links, and use supported lazy embeds.
- Standalone notes can be created, published, displayed, searched, linked, and related to media entries.
- The installed PWA can receive supported shared text/URLs on compatible platforms.
- The same Add flow works through pasted input where Share Target is unsupported.
- Spotify and YouTube links are recognized by adapters; movie/show and unknown web links have safe fallbacks.
- Adding a new provider requires an adapter and registry entry, not changes throughout the application.
- Adding a new content type can be achieved through configuration/registration and renders safely using the generic card.
- Only the authenticated owner can create repository commits.
- Repository credentials never reach client code.
- Save failures and offline captures preserve retryable drafts.
- Each successful create or edit produces a readable Git commit and is published only after schema-valid CI succeeds.
- Embeds load on demand and gracefully fall back to Open Original.
- Keyboard, reduced-motion, responsive-layout, and basic screen-reader flows pass automated and manual checks.

## 22. Future Possibilities

- Browser extension for one-click capture on desktop.
- Importers for Spotify playlists, Letterboxd lists, Goodreads shelves, or existing bookmarks.
- “On this day” rediscovery prompts.
- Optional private entries encrypted separately from the public repository.
- Generated social preview cards using the entry's artwork and note excerpt.
- Yearly personal media retrospectives generated from the Git history.
- Public JSON Feed/RSS feeds for the full collection and individual types.
- A command-line capture tool using the same normalized API and adapters.
- Webmention support for conversations elsewhere on the web without building an internal social system.

## 23. Product Principle

The external link is the object, but the owner's reason for keeping it is the collection's soul. Every feature should make capturing that reason easy and presenting it beautifully, without allowing provider integrations or CMS machinery to overpower the personal character of the site.
