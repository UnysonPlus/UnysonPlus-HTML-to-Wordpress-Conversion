# design-capture

Render a (possibly JS-only) website in headless Chrome and capture its **design** so the
Unyson+ **Site Converter** can rebuild it in WordPress. One pass produces everything the
converter needs — copying *stylings and structure*, never the source's identity (the logo
stays the WordPress site's own Site Logo / Site Title; the footer brand is the Site Title).

## Usage

```bash
npm install                       # once (installs playwright-core)
node capture.mjs <url> [outdir]   # outdir defaults to ./capture-out
```

## Site Analyzer — convert by URL from the WordPress admin (`serve.mjs`)

Instead of running the CLI and uploading the `.zip` by hand, run this tool as a tiny
**local service** and convert sites straight from **Unyson+ → Convert → "Convert a site by
URL"**. Three steps (this is what the admin page's "Capture service — setup" panel describes):

```bash
# 1. Prerequisites: Node 20+ and Google Chrome installed (the capture uses your system Chrome).
node -v                              # confirm Node 20+

# 2. Install the service (first time only) — from this folder (tools/design-capture):
npm install

# 3. Start it and leave it running:
npm start                            # = node serve.mjs, serves http://localhost:8787
PORT=9000 npm start                  # different port (PowerShell: $env:PORT=9000; npm start)
```

Leave it running while you convert sites; the WordPress admin page (in your browser, same
machine) reaches `http://localhost:8787` directly.

## AI companion — refine a conversion with Claude (`to-ai.mjs`)

The same service exposes **`POST /ai-convert`**, used by the **"Use AI"** checkbox in
**Unyson+ → Convert → Convert from a file**. The deterministic converter parses an export into a draft
*mapping* (sections → elements); the AI step hands that draft + the original markup to Claude and gets
back a **refined mapping** (corrected roles, decorative chrome dropped) plus a **`custom_css`** that styles
the rebuilt WordPress markup to look like the original. The plugin then builds the page from the refined
mapping and folds the CSS into the generated child theme — so the model never hand-writes fragile
page-builder JSON.

Enable it by starting the service with your **Anthropic API key** in the environment:

```bash
# macOS / Linux
ANTHROPIC_API_KEY=sk-ant-... npm start
# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."; npm start
# optional: pick a model (default: claude-sonnet-4-6)
ANTHROPIC_MODEL=claude-opus-4-8 ANTHROPIC_API_KEY=sk-ant-... npm start
```

`GET /health` then reports `"aiReady": true`, and the admin's AI status turns green. **Your key never
leaves your machine** — it lives only in this local service; WordPress only ever receives the finished
mapping + CSS. No key set → `/ai-convert` returns 503 and the converter falls back to the deterministic +
manual-review flow.

> The package is **not published to npm**, so `npx unysonplus-site-capture` will not resolve on
> a clean machine — use the `npm install` + `npm start` steps above. (To get the bare command
> working locally without publishing, `npm link` once in this folder; then
> `unysonplus-site-capture` starts the service from anywhere.)

Then in WP admin, paste a URL and click **Analyze & convert**. The admin page runs in *your*
browser on *your* machine, so it reaches `http://localhost:8787` directly — even though the
(remote) WP server can't. The service renders the page, builds the bundle, and the extension
applies it (media → theme → pages → menus). Leave the service running while you convert sites.

| Endpoint | Returns |
|---|---|
| `GET /health` | `{ ok, service, version }` (the admin page pings this to show "service detected") |
| `GET /capture?url=<url>` | the `convert-bundle.zip` for that URL |

CORS is open and `Access-Control-Allow-Private-Network: true` is sent, so an `https` WP admin
page can fetch from `http://localhost` (browsers treat loopback as trustworthy). No service?
The manual `capture.mjs` → upload-`.zip` path still works as a fallback.

## Outputs

| File | What | Where it goes in WordPress |
|---|---|---|
| `design-capture.json` | The raw capture — tokens, header/footer chrome, full body block model, assets. | Source of truth; can be pasted into the generator directly (auto-detected). |
| `design-config.json` | The **theme** config (fonts, colors, header logo/menu/button styling, footer menu/social/copyright, background). | Unyson+ → Convert → **Generate header & footer theme** (Child or Standalone). |
| `pages.json` | The **body** as an editable page-builder **Home page** (sections → `special_heading` / `text_block` / `icon_box` columns). | Unyson+ → Convert → **Import Pages** (or drop into a Convert bundle). |
| `full.png`, `header.png` | Screenshots for reference. | — |

## Raw chrome — pixel-faithful header & footer

`capture-extract.mjs` also emits a **`chrome`** block: the **verbatim HTML** of the header
and footer (URLs absolutized, `<script>` stripped) plus the **matching CSS** — every rule
across the page's stylesheets whose selector matches an element inside the header/footer,
plus `:root`/`html`/`body` globals, `@font-face` and `@keyframes`. Cross-origin sheets that
can't be read (CDN Bootstrap / Font Awesome / Google Fonts) are returned as `linked_css`
hrefs. This rides along in `theme-design.json` as `raw_chrome`.

When the generator sees `raw_chrome`, it **mirrors the chrome exactly** instead of rebuilding
it: the captured HTML becomes the header/footer template parts, the captured CSS becomes the
theme's `style.css`, and the `linked_css` libraries are re-enqueued (the chrome CSS depends on
them so it wins the cascade). A small reset neutralizes the parent theme's `#page`/`#content`/
`#colophon` wrappers so the mirrored markup owns its own layout. The result reproduces the
source header & footer pixel-for-pixel (hover, responsive, webfonts included). Trade-off: it's
a static visual mirror — the nav isn't a WordPress menu yet, and the logo is the source's own.

## Multi-page conversion

`capture.mjs` captures the **home** page, then crawls the **header nav's internal links**
(same-origin, real paths — not `#anchors` / `mailto:` / `tel:`) and captures each as its own
WordPress page (capped at `MAX_PAGES`, default 10). The chrome (header/footer), theme, style
guide and media come from home + the union of all pages; each page's body is a verbatim mirror.
Page slugs derive from the URL's last path segment (`speakers.html` → `speakers`); home is the
front page. **Internal links are rewritten to root-relative WP paths** (`/speakers/`, `/` for
home/index) in both the chrome and every page body, so the converted site navigates between the
real pages. The Pages importer (plugin side) already creates a page per entry, idempotent by slug.

## Element decomposition (intro-only) → real shortcodes

`capture-extract.mjs` `decompose()` routes a section's content to editable builder elements,
keeping the layout:
- standalone **headings** → `special_heading`, **intro paragraphs** → `text_block`, **CTA
  buttons** → `button` (alignment from the captured `text-align`);
- a **multi-column row** → real builder **columns** at the captured widths (from the `col-*`
  span), each cell's content a **`code_block`** (e.g. a speakers grid → a `special_heading`
  intro + a row of `1_4` columns, one per speaker-item);
- anything else (media leaves, lists, tables) stays a verbatim `code_block`.

A section only decomposes when it yields at least one shortcode-able element; **hero sections
with an absolute background layer (`bgWrapperOf`) and detected sliders stay as-is**. The source
section class is carried onto the builder `section` so descendant CSS still styles the
extracted + verbatim content. `code_block` remains the universal fallback for unmapped markup.

## Slider → carousel mapping

`capture-extract.mjs` `detectSlider()` recognizes initialized sliders (Swiper / Owl / Slick /
Splide / Bootstrap carousel — excluding the loop CLONES those libs inject) inside a section and
extracts each slide's `image / heading / text / button`. `to-pages.mjs` then emits the editable
**`carousel`** shortcode instead of a static code-block, choosing a layout heuristic: image-only
slides → a logo strip (multi-per-view, no arrows); heading+button+image → a hero (background
image, text overlaid); otherwise a 1-up content slider. A hero whose background is an absolute
layer (bg-box) is left as a verbatim code-block so the background survives.

## How the mapping stays faithful

- **Grid detection** — `findGrids` recognizes both CSS `display:grid` AND **Bootstrap flex
  rows** (`.row > .col-*`). Bootstrap (which the plugin itself uses) is flexbox, not CSS grid,
  so without this every Bootstrap card grid flattened into the generic mirror; now they map to
  real feature/card columns. (Tile cap is 12 so larger card grids — e.g. a food menu — aren't skipped.)
- **Header detection** — `capture-extract.mjs` first looks for `<header>` / `[role=banner]`;
  if neither exists (common in SPA / Lovable / v0 / React sites) it falls back to the topmost
  pinned bar — a `<nav>` (or navbar/header-classed element) at `top ≈ 0`, full-ish width, with
  ≥2 links/buttons — and reads its logo (styling only), nav items and CTA from there. Logo/CTA
  scanning includes `<button>` since SPAs route via JS.
- `to-design-config.mjs` — capture → theme config. Mirrors the PHP
  `FW_Site_Converter_Theme_Generator::from_capture` (the generator auto-detects a raw capture
  too, so either file works). Heading/body fonts (incl. the source's own Google Fonts URL),
  `--primary` accent, logo + CTA-button styling (pill radius clamped), header sticky, footer
  link columns → an editable menu, copyright tagline.
- `to-pages.mjs` — capture body sections → the Pages-importer payload. Clones the heavy default
  att-blobs from `atom-templates.json` (real nodes extracted from a proven export) and swaps
  only the content, per the conversion rule *"clone shapes from a real export, only swap
  content."* The plugin's own encoder regenerates `post_content`, so every section stays
  editable in the builder. **Archetype vs. mirror routing:** simple sections (hero, steps, plain
  feature grids) use native shortcodes; sections that are grids of *chrome'd* cards (stat cards,
  — and a **countdown** in the hero (a row of number + time-unit cells like "03 Days 14 Hours
  21 Min 56 Sec") is detected and emitted as the `countdown` shortcode, targeting capture-time +
  the snapshot's remaining time (the editor user can reset it to the real event date). **Hero
  buttons** are emitted as real, editable `button` shortcodes (inline-block `.btn`, so they flow
  inline; the hero's text-align centers/left-aligns the row) rather than text-block links —
  auction-item cards with badge/price/bid-count, progress cards) are detected by
  `isRichCardSection()` and routed to the DOM-mirror instead — the icon_box archetype can't
  express that richness, but the mirror reproduces it faithfully (card bg/border/shadow, badges,
  price, etc.). The **hero** has two shapes: a *cover* hero (full-bleed background photo with
  centered white text, chosen when the heading text is light) and the *split* text/media layout.
- `to-mirror.mjs` — the generic DOM-mirror. Maps a mirror subtree → section/column/text-block
  carrying each element's computed styles into `.scm-*` classes. A bare "NN%" text is synthesized
  into a progress bar (the source's fill width/colour aren't captured, so width comes from the %
  and the fill is painted with the `--primary` accent).

`atom-templates.json` is regenerated from a proven page export (see the extraction one-liner in
the repo history) whenever the builder's option schema changes.
