# ⚠️ Keep the "no‑AI" conversion algorithm in sync — BOTH implementations

The deterministic (**no‑AI**) converter — the logic that turns a source design into a UnysonPlus
**child theme + page‑builder pages** *without* calling an LLM — exists **TWICE**, once per input path.
**If you change one, you MUST change the other** so the two paths produce consistent results.

> **📘 Manual procedure + hard-won learnings — read before a demo OR a launch-site conversion.**
> The human-followed process these converters AUTOMATE, and every gotcha from building demos
> (Theme-Settings-first mapping, Text Styles, the 3-tier Custom CSS escape hatch, logo strips /
> inline SVG, `mask-image` background fades, the fidelity + computed-style diff gate, …) lives in the
> **Site Conversion Playbook**: `framework/extensions/site-converter/docs/site-conversion-playbook.md`
> (in the plugin / `UnysonPlus-Site-Converter-Extension` repo). The converters' north star is to EMIT
> what that playbook builds by hand — keep them converging on it.

| Path | Lives in | Files |
|---|---|---|
| **URL capture** (this repo) | `tools/design-capture/` (JS) | `capture-extract.mjs`, `to-pages.mjs`, `to-design-config.mjs` |
| **File upload** (the WP plugin) | `unysonplus/framework/extensions/site-converter/includes/` (PHP) | `class-fw-site-converter-stitch.php`, `class-fw-site-converter-mapper.php`, `class-fw-site-converter-theme-generator.php` |

> The **AI** path (`to-ai.mjs`, `/ai-convert`) is separate — this rule is about the **deterministic**
> path that runs offline. (When the AI authors the child theme, the deterministic path is the fallback.)

## What "conversion logic" means (any of these changed → sync the other side)

- What counts as a **page section** vs. chrome.
- How sections map to **shortcodes** (roles: `title` / `text` / `button` / `columns` / `icon_box` /
  `counter` / `feature_list` / `image` / `video` / `scroll_indicator` / `code` / `skip`).
  **Pick the purpose-built element for the content pattern** (see "element selection vs effect addition"
  in the site playbook) — the resting state matches the source; never add motion the source lacks.
  - **`video`** — a source `<video>` (self-hosted) or a provider `<iframe>` (YouTube/Vimeo/…) → the
    native **`media_video`** shortcode (self-hosted file / oEmbed URL), **never** a raw `<video>` in a
    text/code block. PHP: `stitch` `video` recognizer + `Mapper::n_video()` / `embed_to_page_url()`.
    JS: `videoBlockOf()` (before `SKIP_TAGS`) + `videoNode()` / `embedToPageUrl()`. Self-hosted mode
    carries autoplay/muted/loop/controls/playsinline; autoplay forces muted.
  - **`counter`** — a big KPI/stat number → the **`counter`** (Animated Counter). Number-only; the
    label is a sibling `special_heading`/`text_block`; prefix/suffix are inline captions ($, %, PB/s).
    PHP `Mapper::n_counter()` + JS `counterNode()` (both already wired).
  - **`feature_list`** — an icon-led list / checklist (`<ul>`/list of icon+text rows) → **`feature_list`**
    (design `icon` = per-item icons, or `check`/`numbered`/`bullet`), NOT stacked `icon_box`es. Each item
    = `{ text, subtext, icon, state }`. Carry an explicit icon size to `marker_size`.
  - **`image`** — a standalone `<img>` → the native **`media_image`** shortcode, **never** a `gallery`
    (that's for multiple images) and never a `code_block`. A `gallery` is only for a set of images.
  - **`scroll_indicator`** — a bottom-of-hero `animate-bounce` label + chevron that anchors to the next
    section → the **`scroll_indicator`** shortcode (text, icon, target `#anchor`, layout, animation).
- **Per-section container width** — read each section's `mx-auto max-w-{3xl..6xl}` and set the section's
  **Container Width** option (Narrow 768 / Medium 896 / Wide 1024 / Custom) instead of the global width or
  per-element max-widths. The GLOBAL Container Width still maps the widest band (`max-w-7xl` → 1328px).
- **Hover overlays** — a card's `absolute inset-0` + `opacity-0` + `group-hover:opacity-100` child is a
  fade-in sheen; reproduce as a scoped `::before`/`::after` fade (+ the `hover:border-*` change).
- **Icon size** — a source icon with an explicit size (`text-4xl`, `w-8 h-8`) → the element's **Icon Size**
  option (icon / feature_list / icon_box), not child CSS.
- What's treated as **chrome** (header / footer / nav) vs. body **content**.
- **Header / footer detection** — e.g. a bare sticky `<nav class="fixed top-0">` as the header when
  there's no `<header>`; excluding the standalone brand link and the CTA from the nav menu.
- **Token / design extraction** — palette, fonts, spacing → the design‑config / child‑theme CSS.
- **Child‑theme file generation** — `style.css`, `header.php`, `footer.php` (the plugin's theme
  generator owns these; the capture path feeds it the same design‑config shape).

## Reference

The **capture service's extraction is usually the more‑complete** one (it has a live DOM + computed
styles, not just static HTML). When in doubt, make the PHP match the JS behavior.

**…but not always — check both before assuming.** A real case (fixed in v1.7.47): body-band
detection. The PHP `walk_section_roots()` was a correct depth‑agnostic DFS (dive through plain
wrappers, claim the outermost `<section>`s), while the JS used a hardcoded 3‑level selector
(`:scope > section, :scope > div > section, :scope > div > div > section`). That silently matched
**nothing** on the very common WordPress chain `main > article > div.entry-content > div > section`,
so such pages converted to an EMPTY page with no error. The JS now mirrors the PHP: query every
`<section>` under `main` and keep only the outermost ones. **Lesson: when the two paths disagree,
the more‑complete one is whichever is depth/structure‑agnostic — verify, don't assume it's the JS.**

## Checklist before finishing any conversion change

- [ ] PHP file‑path engine updated (`class-fw-site-converter-*`).
- [ ] JS URL‑path engine updated (`capture-extract.mjs` / `to-pages.mjs` / `to-design-config.mjs`).
- [ ] Both make the same chrome / section / shortcode decisions on a shared sample.
- [ ] Versions bumped (plugin `unysonplus.php` + `framework/manifest.php`; the extension manifest;
      this repo's `tools/design-capture/package.json`).

_(This rule is also recorded in the workspace `CLAUDE.md` and the extension's `AGENTS.md`.)_
