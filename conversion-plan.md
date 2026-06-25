# AI-Generated Site → WordPress (UnysonPlus) — Roadmap & Session Handoff

> **Purpose of this file:** a self-contained primer so a *fresh* Claude Code session can pick
> up this initiative with full context. Read this first, then start on the "Immediate next
> task" at the bottom. This is an internal roadmap/handoff — move or rename it freely.

## The goal

Turn an **AI-generated website** (HTML/CSS, possibly multiple pages) into a **full, editable
WordPress site** built on the **UnysonPlus** plugin — one the end user can keep modifying in
WordPress's native way (page builder, theme settings, header/footer builder), not a static
HTML dump.

## Core thesis (the thing nobody ships)

Every "AI builds a site" demo stops at generation. The conversions people *do* show paste
rendered **HTML** into a Custom HTML block → pixel-OK but **dead**: not editable, no design
system, not responsive in WP terms. That's the gap and the wedge.

**Convert structure + design system, not HTML.** Map the AI site onto UnysonPlus's structured
primitives so it becomes a native, editable page-builder site with a real, global design
system. Favor **editability over pixel-perfection**, with a Code-Block + scoped-CSS escape
hatch for the ~10% that doesn't map cleanly.

## Architecture decision (locked, can revisit)

**Don't build a separate AI conversion app first.** Ship the **spec + importer (the rails)**;
let the user's *own* AI agent read our markdown spec, look at the AI-generated site, and emit
UnysonPlus's native artifacts, which the plugin imports. Lower effort, transparent, leverages
the audience's existing agents. A hosted "paste site → download WP bundle" app can come later
as a wrapper running the same agent prompt server-side. **Rails first.**

## UnysonPlus primitives the conversion targets

- **Styling Presets** — Color / Typography / Spacing / Button / Border tokens → generated
  utility classes (`presets.css`). This is the design-system layer.
- **Page Builder** — Sections → Rows → Columns (Bootstrap grid `.fw-container/.fw-row/.fw-col`,
  per-device overrides, `background-pro`, min-height, vertical-align, variants) + content
  shortcodes (heading, text, button, image, icon-box, accordion, slider, …).
- **Header/Footer Builder** — `up_header` / `up_footer` CPTs (global chrome).
- **Theme Settings** + import/export bones + the **child-theme** model (`unysonplus-theme`
  parent, `payforituk` sample child).

## The pipeline (tokens-FIRST — order matters)

1. **Design system → Styling Presets.** Agent extracts palette, type scale, spacing scale,
   radius, shadows, button styles from the AI site's CSS → emits a **Styling Presets export**.
   Import FIRST so everything downstream references tokens (globally editable, clean markup).
2. **Header/Footer → HF Builder export.** Map logo/nav/CTA/footer → import as global chrome.
3. **Page bodies → Page Builder content ("Full Page template").** Segment each page into
   sections → rows/columns → map content to shortcodes, referencing Phase-1 tokens.
4. **Assets + wiring.** Images → media library/child theme; menus; front-page assignment.
5. **Package** as a child theme of `unysonplus-theme` + one-click demo-content import bundle
   (pages + header/footer + theme settings + media manifest).

## "Only Bootstrap?" — No

Bootstrap maps ~1:1 onto the `.fw-*` grid (least translation). But ANY source (Tailwind,
flexbox, CSS grid) converts because the agent does *semantic* mapping ("this is a 3-col feature
section") and emits *our* grid. Constraint = agent interpretation, not source framework.

**Upstream power move:** also ship a "**generate convert-ready**" prompt so AI builds the site
in Bootstrap grid + CSS-variable tokens + semantic sections from the start → conversion becomes
nearly mechanical. Two specs: *generate convert-ready* + *convert*.

## What to build (≈70% already exists)

1. **The "conversion contract" — agent-facing markdown specs.** Formalize the per-area
   `AGENTS.md` files into machine-readable schemas: section/column/shortcode notation, Styling
   Presets export format, header/footer export, Full Page template format. *Highest leverage;
   mostly documenting what exists.* ✅ **DRAFTED** →
   [conversion-contract.md](conversion-contract.md) (the
   schema↔transport map + cross-links; gaps section feeds #2).
2. **Full Page template importer** (builder notation + tokens → real pages) + a small
   **"Convert / Import bundle"** admin screen ingesting the agent's zip/JSON (applies Phases 1–5).
   🚧 **STARTED** — new `site-converter` extension (Unyson+ → Convert). First slice shipped: the
   **Media tool** (fetch source images into the Media Library, de-duped; reusable
   `FW_Site_Converter_Media` engine). Next slices: presets import (§1.4), menu import (§3.3),
   the one-shot bundle. (Full Page template import already exists — used in the MVP round-trip.)
3. Lean on existing import/export bones (theme settings export, Unyson backup/demo content) —
   document + extend, don't rebuild.

## Immediate next task

**#1 is drafted** → [conversion-contract.md](conversion-contract.md).
It inventories all four formats (builder-tree JSON + template envelope, Styling Presets store,
`up_header`/`up_footer` chrome, theme-settings design export), separates **schema vs transport**,
and cross-links every relevant `AGENTS.md`. Key findings worth knowing before continuing:
- Agents emit **builder-tree JSON**, never the htmlentities-encoded shortcode string (the plugin
  generates that on import). Page-builder transport = the `.json` template envelope (`kind:"full"`).
- **Styling Presets have no file importer yet** — they live in the theme-independent wp_option
  `fw_ext_settings_options:shortcodes` and are NOT carried by the theme-settings design export.
  Building that importer is the top item in the contract's §7 "Known gaps" → roadmap #2.

**Next:** the **MVP round-trip** (below) — hand-build ONE page's artifacts per the contract, then
have an agent reproduce them from the raw AI site. That validates the contract before #2 (importer).

## MVP validation (do this before generalizing)

Round-trip **ONE** AI-generated landing page by hand once (tokens → header/footer → one Full
Page template), then write the agent spec describing exactly those artifacts, and have an agent
reproduce the hand-built result from the raw AI site. When it round-trips one page, the process
is repeatable → then productize the importer + bundle.

## Honest trade-offs

- Pixel-perfection vs editability → favor editability + Code-Block/scoped-CSS escape hatch.
- JS interactivity (sliders/animations) → map to slider/GSAP equivalents or carry JS in child theme.
- Fonts → map to typography presets + enqueue web fonts in the child theme.

## Codebase pointers (where things live)

- Plugin: `d:\Web Dev\unysonplus` (framework + extensions). Page builder:
  `framework/extensions/shortcodes` (+ `extensions/page-builder`). Shortcodes:
  `framework/extensions/shortcodes/shortcodes/*`. Styling presets / tokens:
  `framework/includes/css-tokens.php` + the shortcodes styling settings.
  Header/Footer: `framework/extensions/header-footer-builder`. Forms: `framework/extensions/forms`.
- Parent theme: `d:\Web Dev\unysonplus-theme` (theme settings under
  `framework-customizations/theme/options`). Sample child: `payforituk`.
- Conventions: `d:\Web Dev\CLAUDE.md` (version bumps, multi-picker pattern, settings layout, etc.).
- Per-area specs to formalize: the various `AGENTS.md` files under the shortcodes/page-builder trees.

## Status when this handoff was written

Plugin at `unysonplus.php` 2.10.24 / shortcodes 1.6.5 / forms 2.0.37. Recent work: Forms made a
visible extension + global reCAPTCHA settings page; honeypot field; Section min-height hybrid
multi-picker + migration; reusable `sc_migrate_atts` runner. None of that blocks this initiative.
