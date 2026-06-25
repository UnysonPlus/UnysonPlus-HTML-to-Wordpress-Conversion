# PayForItUK round-trip — import guide

Hand round-trip of the AI page at https://zippy-praline-efd695.netlify.app/ onto UnysonPlus,
following [the conversion contract](../../conversion-contract.md). This folder is the
**bundle**; `analysis.md` is the mapping + findings; the real production export
(`../../reference-exports/example-full-page-template-export.json`) was used to validate and correct the approach.

## Files

| File | What | Import target |
|---|---|---|
| `source/index.html` | the original AI page | — |
| `analysis.md` | token extraction, section→primitive map, contract gaps (G1–G11) | — |
| `presets.json` | Phase 1 — Styling Presets (palette, type scale, button presets) | wp_option `fw_ext_settings_options:shortcodes` |
| **`../../../payforituk-test/`** | **Phase 2 (recommended) — child theme: scoped carried CSS + bridges (`style.css`) + Geist enqueue (`functions.php`)** | Upload to `wp-content/themes/` → **Activate** |
| `theme-settings-design.json` | Phase 2 (alternative) — same CSS in `misc_custom_css`, for when you can't use a child theme | Theme Settings → Misc → **Import design** |
| `global.css` | the source stylesheet, carried (scoped into both routes above) | (reference) |
| `build-child-theme.mjs` | generator for the child theme | `node build-child-theme.mjs` |
| `full-page-template.json` | the page body — 10 sections, `kind:"full"` | Templates → Full → **Import** |
| `phase3-chrome.sh` | Phase 3 — header/footer menus + site title (WP-CLI) | `bash phase3-chrome.sh` (or Appearance → Menus) |
| `build-template.mjs` / `build-theme-settings.mjs` | the generators (reusable reference) | `node build-*.mjs` |

## Import order (tokens first — contract §0.3)

1. **Presets** (`presets.json`). No preset-import UI yet (contract gap §1.4 / roadmap #2). Apply by
   writing the option, e.g. WP-CLI:
   ```
   wp option patch update fw_ext_settings_options:shortcodes theme_colors "<json>"
   ```
   (one key at a time, or update the whole option), or re-enter via the Shortcodes settings form.
2. **Design system — pick ONE route:**
   - **(recommended) Child theme** `payforituk-test/` → upload the folder to `wp-content/themes/` on
     the test site and **activate** it (Appearance → Themes). It enqueues Geist + the carried,
     `.entry-content`-scoped brand stylesheet at `PHP_INT_MAX` (wins the cascade). This is how the real
     `payforituk` site is built (analysis §6). *Use it on the **test** site (caracruznetdev) — it
     replaces the active theme, so don't activate it over the real `payforituk`.*
   - **(alternative) Design file** `theme-settings-design.json` → Theme Settings → Misc → **Import
     design**. Same CSS, into `misc_custom_css` (emitted at wp_head 999). No theme switch — use this
     when you can't add a child theme.
3. **Page template** (`full-page-template.json`) → Templates → **Full → Import**, then create a
   page from it and set it as the front page.
4. **Chrome** (`phase3-chrome.sh`) → populates the **Primary** menu (header nav) + **Footer** menu
   from the source links and sets the site title. The theme renders its header (`#masthead`) from the
   `primary` menu location + its footer (`#colophon`) from the `footer` location; the design file's
   chrome bridge (step 2) gives them the source's sticky-blur topbar + footer look. Run via WP-CLI,
   or do it by hand in Appearance → Menus. Set the copyright line in Theme Settings → Footer.

After step 3 the page renders with the AI site's design system, because each section carries a clean
`pfu-*` class + a `css_id` (`#hero`, `#compare-methods`, `#faqs`, … — identifiable in the builder and
usable as nav anchors), the leaves carry well-mapped component classes, and the design file carries
CSS written to those (the §0.4 mapping principle — not literal source-class preservation).

## Placeholders → real shortcodes (contract §0.5)

Two bands ship as `code_block` placeholders carrying the original markup (clearly commented):

- **`[casino_finder]`** (the match-quiz band) — `{heading, subheading}`.
- **`[reviews_table]`** (the operator-listing band) — `{title, icon, category[], post_count}` (CPT query).

**On the `payforituk` child theme these already exist** (`casino_finder` is in
`payforituk/framework-customizations/extensions/shortcodes/shortcodes/casino-finder/`), so on the
live site you swap each placeholder for the real shortcode and the band becomes fully dynamic.
On any other site, leave the placeholder until the shortcode is built.

## Known fidelity caveats (expected — editability over pixel-perfection)

- Builder Bootstrap columns approximate the source's CSS-grid layouts (`.hero-grid`, `.what-grid`).
- Decorative bands (phone mockup, brand badges, comparison table) are `code_block` (contract §2.4 / G6 / G11).
- Fonts: Geist loads via `@import` in the design file; the child-theme `wp_enqueue_style` route
  (in `payforituk-test`) is the cleaner production alternative (gap G9).
- The comparison `[table]` shortcode was escape-hatched — its option shape is opaque and needs a
  reference export to author safely (gap G11).
