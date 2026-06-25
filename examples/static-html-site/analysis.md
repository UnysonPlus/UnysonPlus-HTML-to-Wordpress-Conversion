# MVP round-trip — analysis: zippy-praline (PayForItUK landing page)

> Source: `source/index.html` (downloaded from https://zippy-praline-efd695.netlify.app/).
> A single self-contained HTML file (inline `<style>`, Geist webfont, inline SVG icons).
> This is the **hand round-trip** the roadmap calls for: map one AI page onto UnysonPlus
> primitives per [the contract](../../conversion-contract.md), then record what
> mapped cleanly and where the contract needs work. Convenient bonus: the page IS PayForItUK,
> which already has a `payforituk` child theme in the workspace.

## 1. Design-system extraction (→ Phase-1 Styling Presets)

The page is fully tokenised via `:root` CSS variables — a near-ideal source. Mapping to the
preset store (`fw_ext_settings_options:shortcodes`, contract §1). Emitted in `presets.json`.

### Colors → `theme_colors` (name → slug → `.text-{slug}` / `.bg-{slug}` / `--color-{slug}`)

| Source var | Hex | Preset name | Slug | Role |
|---|---|---|---|---|
| `--blue` | `#185FA5` | Primary | `primary` | brand, links, primary accents |
| `--blue-light` | `#4A8BCC` | Primary Light | `primary-light` | gradient partner |
| `--blue-bg` | `#F0F6FC` | Primary Soft | `primary-soft` | eyebrow/icon chips |
| `--amber` | `#EF9F27` | Accent | `accent` | stars, highlight bar |
| `--green` | `#1FBA8E` | Success | `success` | CTAs, positive states |
| `--green-dark` | `#15A179` | Success Dark | `success-dark` | CTA gradient partner |
| `--green-bg` | `#E1F5EE` | Success Soft | `success-soft` | "yes/✓" pills |
| `--green-text` | `#0F6E56` | Success Text | `success-text` | pill text |
| `--red-text` | `#A32D2D` | Danger Text | `danger-text` | "no" cells |
| `--black` | `#0A0A0F` | Ink | `ink` | headings, dark CTA |
| `--text` | `#14141A` | Text | `text` | body |
| `--text-muted` | `#5A5A65` | Muted | `muted` | sub copy |
| `--text-light` | `#8E8E97` | Light | `light` | captions |
| `--text-faint` | `#B8B8BE` | Faint | `faint` | empty stars, rules |
| `--bg-alt` | `#FAFAF7` | Surface | `surface` | grey sections, chips |
| `--dark` | `#0F0F1A` | Dark | `dark` | "Staying in control" band |

(`--bg #FFFFFF` = default White; `--border`/`--border-strong` are alpha-on-ink, handled via
border presets / custom_css, not color presets.)

### Type scale → `font_sizes` (px; the plugin's mobile scaler covers the `clamp()` shrink intent)

| Role (source) | px | Preset name | Class |
|---|---|---|---|
| `.h1` hero (clamp 38–60) | 60 | Hero | `font-hero` |
| `.section-h` (clamp 28–40) | 40 | Heading | `font-heading` |
| `.match-title` | 22 | Title | `font-title` |
| `.hero-sub` | 18 | Lead | `font-lead` |
| body / `.what-visual-h` | 17 | Body | `font-body` |
| `.match-q-text` | 15 | Small | `font-small` |
| `.section-sub`/`.trust-pillar-p` | 14 | Caption | `font-caption` |
| `.match-sub`/`.card-headline meta` | 13 | Micro | `font-micro` |
| badges/footer | 12 | Tiny | `font-tiny` |
| eyebrows | 11 | Overline | `font-overline` |

### Other tokens

- **Fonts:** `Geist` (400/500/600/700) + `Geist Mono` (Google Fonts). → set as the body/heading
  family in **theme-settings typography** (§4) **and enqueue the webfont in the child theme**
  (`payforituk`). Mono is used only for small chrome (float chips, faq-num) → carry via custom_css.
- **Radius:** cards 18–24px, tiles/pills 10–12px, chips 999px. → a couple of **border presets**
  (`.colb-card` ≈ 18px + soft shadow; `.colb-tile` ≈ 12px) + custom_css for the rest.
- **Spacing:** 8px rhythm; section vertical padding 56–88px. Default Bootstrap scale (0–5) covers
  inline gaps; section padding is set per-section on the `section` atts, not a global step.
- **Buttons (two):** `.cta` = solid Ink (#0A0A0F), radius 10 → button preset "Dark". `.match-cta`
  = Success→Success-Dark **gradient**, radius 12 → button preset "Success" (needs the gradient
  sub-field). See gap G7 — emitting these is Phase-1b after verifying the button-preset shape.

## 2. Section-by-section map (→ Phase-4 Full Page template)

`✅ clean` = maps to a primitive 1:1 · `🟡 partial` = primitive + custom_css · `🔶 escape hatch`
= code_block / carried HTML+JS (the predicted ~10%).

| # | Section | UnysonPlus mapping | Verdict |
|---|---|---|---|
| 0 | `header.topbar` (brand + 4-link nav, sticky+blur) | **`up_header`** (§3): `site_logo` + `nav_menu`; `hf_behavior:sticky`; blur via header custom_css | 🟡 |
| 1 | `hero` (2-col: copy + phone mockup) | `section` → 2 columns `2_3`/`1_3`: **left** `special_heading`(title w/ `<em>`)+`text_block`+tested-by(`text_block`/`icon_box`); **right** phone mockup = **`code_block`** (decorative SVG/CSS) | 🔶 (visual) |
| 2 | `match-section` (4-Q interactive quiz card) | stateful JS widget — **`code_block`** carrying markup+JS, or a future `quiz`/`form` shortcode | 🔶 |
| 3 | `what-section` (2-col: checklist + pay-method stack) | `section` → 2 cols: **left** `special_heading` + 4× `icon_box`(check icon); **right** `code_block` or 5× `icon_box` rows in a bordered column | 🟡 |
| 4 | `trust-section` (6 pillars, 3-col) | `special_heading` + a row of **6 `icon_box`** (`1_3` ×3 ×2 rows) — inline-SVG via `icon_box.custom_icon` | ✅ |
| 5 | `trust-strip` ("Aligned with" + 5 brand SVG badges) | row of badges — **`code_block`** (brand SVGs) or `icon_box` w/ custom_icon + label | 🔶 (brand art) |
| 6 | `listing-section` (5 operator cards) | **repeating data component** → ideally a `casino_card` shortcode + CPT; for MVP one card = column(`bg`,`border`)+svg(`code_block`)+`special_heading`+pills(`text_block`)+`button`. Rest = escape hatch / loop | 🔶 (see G3) |
| 7 | `section-grey` comparison (5×4 table) | **`table`** shortcode (+ method-icon cells via inline markup) | ✅ |
| 8 | `methods-section` (12 linked method tiles, 4-col) | `special_heading` + **12 `icon_box`** (`1_4`), each linked, `custom_icon` SVG | ✅ |
| 9 | `section-grey` FAQ (6 `<details>`) | `special_heading` + **`accordion`** (6 items) | ✅ |
| 10 | `trust-footer` (3 linked trust blocks) | `special_heading`-less → row of **3 `icon_box`** (`1_3`), linked | ✅ |
| 11 | `sic` (DARK: toolkit + Talk·Ban·Stop + helpline) | **`section` variant `dark`** → `special_heading`(light) + 2 cols of `icon_box`/`text_block` + helpline `notification`/`call_to_action` + disclosure `text_block` | 🟡 |
| 12 | `footer` (9 links + copyright) | **`up_footer`** (§3): link row + copyright `text_block` (theme footer slots) | ✅ |

**Headline finding:** ~7 of 13 bands map cleanly to existing shortcodes, ~4 are partial
(primitive + custom_css), and ~4 are genuine escape-hatch (phone mockup, match quiz, brand-badge
strip, operator cards). That's right in line with the contract's "favor editability, ~10% escape
hatch" thesis — and the escape-hatch ones are all either *decorative brand art* or *data-driven
repeating components*, which is a useful, generalizable distinction (see G3).

## 3. Contract gaps & findings (the real output of this exercise → roadmap #2)

- **G1 — "eyebrow + heading + subtitle" is the workhorse.** Every section uses it and
  `special_heading` (overline/title/subtitle + alignment + display-size) fits exactly. Strong
  validation. *Contract action: hold `special_heading` up as the canonical section-header mapping
  in a future "common patterns" appendix.*
- **G2 — inline SVG icons map via `icon_box.custom_icon`.** The whole page uses Feather/Lucide-style
  inline SVGs; `icon_box`'s `custom_icon` (inline SVG, per its AGENTS.md) is the right carrier, and
  `icon` set to `{"type":"none"}`. Clean. *Contract action: state this explicitly — converters
  should route arbitrary SVG icons to `custom_icon`, not try to match an icon-font glyph.*
- **G3 — data-driven repeating components need a CPT+shortcode, not hand-built columns.** The 5
  operator cards (logo, headline, stars, ✓-pills, CTA, T&Cs) are records, not layout. Hand-building
  each as columns is wrong (not editable as data, no reuse). *Contract action: the importer should
  detect a repeating-card list and recommend a dedicated shortcode + CPT (here: casinos). This is
  the single biggest "structure not HTML" lever and deserves its own contract section.*
- **G4 — no rating / badge-pill / stat primitive.** `★★★★☆`, `✓ Pay by Mobile`, `£10 min`,
  `UKGC LICENSED` are tiny inline UI with no shortcode. Today → `text_block`/`notification` with
  inline markup + preset classes. *Contract action: note these as candidate primitives; for now
  document the `text_block`-with-classes fallback.*
- **G5 — interactive/stateful widgets have no home.** The match quiz is JS state. *Contract action:
  formalize the "carry as `code_block` + child-theme JS" path the plan's trade-offs section
  promises; flag candidates for a future `form`/`quiz` mapping.*
- **G6 — decorative brand art (phone mockup, brand badges, operator logos) → `code_block`.** These
  are presentation, not content. `code_block` (or rasterized `media-image`) is correct; trying to
  rebuild them as columns is wasted effort. *Contract action: add an explicit "decoration vs
  content" rule — decoration goes to `code_block`/image, content gets structured.*
- **G7 — button-preset shape: RESOLVED.** Read `unysonplus_default_button_color_presets()` /
  `unysonplus_default_border_presets()`: each preset has a `states` map (default/hover/active/
  focus/disabled) of compact color pickers `{predefined,custom}`, plus a per-state `gradient`
  (Gradient V2: `{type,angle,stops:[{color,position}]}`), `border_width {value,unit}`,
  `border_style`. Both brand CTAs are now emitted in `presets.json` (Dark = solid Ink; CTA =
  green gradient w/ reversed-stop hover). Border `Card`/`Hover Lift` defaults cover the cards.
- **G10 — replacing the whole palette breaks default button/border presets (NEW, important).**
  The built-in `button_colors`/`border_presets` reference *fixed* color slugs (`primary`, `green`,
  `teal`, `indigo`, `light-gray`, `red`, `white`); a one-shot migration even *blanks* any button
  color whose slug isn't in the current palette. So a converter that renames the palette wholesale
  silently kills `btn-primary`, `btn-success`, `colb-card`, etc. **Fix (used here): keep those
  slugs and re-point their hex to brand values, then ADD brand-only colors** — the defaults then
  theme themselves for free. *Contract action: §1 must tell converters to preserve the
  default-referenced slugs (or regenerate the dependent presets), not just emit an arbitrary
  palette. This is the #1 preset-layer gotcha.*
- **G12 — carried CSS MUST be scoped + sanitized, or it bleeds into the theme (NEW, found on import).**
  Importing a *verbatim* site stylesheet into `misc_custom_css` messed up the theme chrome two ways:
  (1) global resets (`*`, `html`, `body`, `a`, `img`, `body::before/::after` gradient blobs, bare
  `section`/`header`/`footer`) restyle the whole site; (2) generic class names (`.nav`, `.card`,
  `.cta`, `.container`, `.wrap`) collide with Bootstrap/theme classes. **Fix (applied): scope every
  component rule under `.entry-content`** (the page-content wrapper, confirmed in the theme's
  `content-page.php`), keep `:root` vars + `@keyframes` global (the chrome bridge needs the vars),
  and **drop the resets**. Page font set on `.entry-content`, not `body`. `build-theme-settings.mjs`
  now does this via a small CSS scoper. *Contract action: §0.4 — carried CSS is scoped to the
  page-content wrapper + stripped of resets, never dumped verbatim site-wide.*
- **G8 — gradients, gradient accent bars, layered shadows, backdrop-blur** (hero/match cards, the
  4px gradient top-border, sticky header blur) exceed structured options → carried via per-item
  `custom_css` (the `selector` token) and header custom_css. Expected; confirms custom_css is
  load-bearing for fidelity. *No contract change; just budget for it.*
- **G9 — webfont enqueue is a child-theme step.** Typography presets reference `Geist`, but the
  font must be enqueued (Google Fonts) in `payforituk`. *Contract action: the theme-settings/
  font-mapping section should state that non-system fonts require a child-theme enqueue step in the
  bundle (roadmap #2).*

## 4. Artifact plan (this round-trip)

1. **`presets.json`** — `theme_colors` + `font_sizes` (verified shapes) now; buttons/borders after
   G7 verification. ← **Phase 1, this turn.**
2. **`theme-settings-design.json`** — typography (Geist), header/footer slot defaults, `general_pages`
   defaults, `misc_custom_css` for global chrome CSS. *(next)*
3. **`up_header` / `up_footer`** — brand+nav header (sticky), link+copyright footer. *(next)*
4. **`full-page-template.json`** (`kind:"full"`) — sections 1–12, clean primitives where they fit,
   `code_block` for the 4 escape-hatch bands. *(next, built section-by-section)*

Each is validated against the contract section it implements; gaps above feed roadmap #2.

## 6. Learnings from the real THEME-SETTINGS export (`example-theme-settings-design-export.json`)

A real `_fw_settings_export` from the dev site (theme 2.1.96). 167 `values` keys. Decisive findings:

- **The brand design system lives in the CHILD THEME, not theme settings.** On the production
  site: `theme_colors` are **defaults** (`Primary #0d6efd`, not brand blue), `misc_custom_css` is
  **empty**, and `typography.body.family` is **empty** (no Geist). Yet the live page is fully
  branded — so the `pfu-*`/`hero-sub`/`method-tile` CSS + the Geist enqueue + the `casino_finder`/
  `reviews_table` shortcodes all live in the **`payforituk` child theme**. This is the production
  architecture and why the user signposted `payforituk-test`. **Correction to my Phase 2:** I put the
  carried CSS in `misc_custom_css` (self-contained, but caused the G12 bleed and isn't how it's done).
  The production-aligned home is a **child-theme stylesheet** (cleanly scoped, versioned, no DB bloat).
- **The theme-settings design export DOES carry the design-token keys** (`theme_colors`,
  `spacing_scale`, `gap_scale`, `default_gap*`, `button_colors`, `button_sizes`, `button_animations`,
  `border_presets`) — a correction to contract §1.1, which said tokens are only in the
  `fw_ext_settings_options:shortcodes` store and absent from this export. **But** the plugin's preset
  store still reads `fw_ext_settings_options:shortcodes` and I found **no sync** between the two, so
  it's unconfirmed whether importing tokens via the design file actually drives the page-builder
  presets. On production it didn't matter — presets were left at defaults (the look came from child-
  theme CSS). *Net: treat the design-file token keys as real, but verify ext-store propagation before
  relying on the design import to rebrand page-builder presets.*
- **Token shapes validated against my `presets.json`:** `theme_colors` `{name,color}` ✓,
  `spacing_scale` `{name,size}` ✓, `button_colors` is the full per-state `states` map ✓ — but with
  MORE per-state fields than I emitted (`font` object, `transition`, `text_transform`, full
  `box_shadow {x,y,blur,spread,color,inset}`, `border_width/-style` on every state). My minimal shape
  is a valid subset (import merges), but a faithful generator should emit the full per-state object.
- **`misc_custom_css` shape confirmed** = `{ custom_css: "…" }` (Phase 2 target was right).

### Revised approach (production-aligned)
Move the carried design CSS + Geist enqueue out of `misc_custom_css` and into a **`payforituk-test`
child theme** (the proper, scoped, versioned home — and what the user pointed to). The theme-settings
design file then only needs the bits that ARE theme settings (site title via `header_logo`, footer
slots) — most of which are fine at defaults for this conversion. Net pipeline becomes: **child theme
(CSS + font + domain shortcodes) + page template (structure) + a thin chrome/menus step** — which is
exactly how the production `payforituk` site is built.

## 5. Learnings from the REAL export (`example-full-page-template-export.json`)

The user supplied the actual WordPress conversion of this page (live at
`payforitukdev.wpenginepowered.com`). Decoded: envelope `kind:"full"`, `format_version:2`,
plugin `2.10.23`, **10 sections** (= the 10 `<main>` bands; the `sic` dark band + `footer` are
**theme chrome**, not in the page template — a correction to my §2 map, which wrongly put a dark
section in the page body). Shortcodes used: `special_heading, text_block, icon_box, accordion,
divider, code_block` + two **custom domain shortcodes** `casino_finder`, `reviews_table`.

### The defining pattern — structure in the builder, design system in global CSS

**`custom_css` appears 0× across all 96 items.** Instead, every section/column/leaf keeps the AI
site's **original semantic class name** (`pfu-hero`, `hero-sub`, `tested-by`, `what-pay-row`,
`method-tile`, `section-sub`, …) in its `css_class`, and the **entire source stylesheet is carried
globally** (child theme / `misc_custom_css`), scoped by those classes. The builder provides
*structure + class hooks*; the stylesheet provides *fidelity*. The hero `code_block` carries the
phone markup with **no inline CSS** — it relies on the global `.phone*`/`.float-shape*` rules.
**This is the headline correction to my approach:** don't rebuild styling as per-item structured
options *or* per-item `custom_css` — **carry the CSS once, globally, keyed by preserved class
names**, and reserve presets for the genuinely global tokens (colors/fonts/buttons). My generated
template over-used structured options (badges/colors) where the real one leans on `pfu-*` classes.

### Gap resolutions / confirmations from the real data

- **G3 (operator cards) — RESOLVED by `reviews_table`.** Atts `{title, icon, category[],
  post_count}` — a **CPT-query** shortcode that renders the cards from a casinos category. Exactly
  the "repeating data → CPT + shortcode" prediction, already built.
- **G5 (match quiz) — RESOLVED by `casino_finder`.** Atts just `{heading, subheading}`; all quiz
  UI/JS lives in the shortcode. The lesson: domain widgets become **thin data shortcodes**, not
  page-builder trees.
- **G11 (comparison table) — CONFIRMED.** The real export also escape-hatched it to `code_block`
  (section `pfu-section-grey`). My instinct was right.
- **G6 (brand badges) — CONFIRMED.** `trust-strip` is a single `code_block`.
- **special_heading.title carries HTML** — real value: `"Find your UK casino, by <em>how you
  pay.</em>"` (I'd assumed plain text). So inline emphasis/brand spans are preserved in the title.
- **Section/column atts are a superset of the AGENTS.md §3 skeleton** — sections also carry
  `min_height` (`{preset,custom:{custom_height:{value,unit}}}`), `content_valign`, and a full
  `background` (background-pro object); columns also carry responsive `w_desktop`/`w_tablet`/
  `w_phone`, `offset_*`, `align_self`, `content_v/h`, `position`, `z_index`, `border_preset`. My
  generator omitted these; the importer fills defaults, so it still imports, but a faithful
  generator should include them. *(The §3 skeleton is from plugin 2.8.x; this export is 2.10.x —
  the page-builder AGENTS.md "training workflow" should refresh it.)*
- **icon_box matched mine almost exactly** — same `icon:{type:"none"}` + `custom_icon` inline SVG,
  `style:"stack-left"`, `title_tag:"h4"`. Difference: theirs leaves colors/badge empty (global CSS
  does it); mine set `icon_badge`/`icon_color`. Both import; theirs is the cleaner convention.

### Adopted strategy (per user): code_block placeholders for not-yet-existing shortcodes

For domain shortcodes that don't exist yet on a target site, the converter **emits a `code_block`
placeholder** (carrying the original markup, clearly marked) and lets the user create the real
shortcode later, then swap it in. So a round-trip never blocks on missing custom shortcodes:
`casino_finder` / `reviews_table` bands ship as marked `code_block`s in the portable template, and
become `[casino_finder]` / `[reviews_table]` once the user builds them. This extends the
escape-hatch philosophy to the data-driven bands and keeps the template importable anywhere.
