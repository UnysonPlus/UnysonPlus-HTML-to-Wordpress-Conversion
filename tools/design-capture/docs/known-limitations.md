# Known limitations — conversion misses to fix upstream

## FIXED in v1.7.47 — three audit findings (poly.app re-audit)

1. **Body bands missed entirely on common WordPress markup.** The JS section detector used a
   hardcoded 3-level selector, so the standard `main > article > div.entry-content > div > section`
   chain matched **0 of N** sections and the page converted EMPTY, silently. Now depth-agnostic
   (outermost `<section>`s at any depth), mirroring the PHP DFS. *Verified: a page that extracted
   0 sections / 0 elements now extracts 3 / 16.*
2. **No design tokens on scroll-hijacked pages, and gradient CTAs yielded no brand colour.** Token
   extraction only read in-flow `sections[]` + body styles, so hijacked pages shipped seeded
   Bootstrap defaults. A **brand-token sampler** now reads the rendered page (text runs + button
   fills, parsing **gradients**) and *backfills only empty tokens* — never overriding a good
   extraction. *Verified on poly.app: `heading=?`/`accent=?` → `heading=Haffer Variable`,
   `accent=rgb(244,130,77)`, `ink=#F4F4F4`, `bg=#090909`; presets' Primary/Accent became the brand
   orange instead of Bootstrap blue, and the contrast review stopped flagging seeded defaults.*
3. **The conversion report was blind to the Scroll Story emit** — it counts only `kind:'section'` /
   `kind:'element'` trace rows, so a fully-converted hijacked page read as "0 elements / 0
   sections". Story emits now push proper rows (a section row per story + an element row per scene
   leaf, with scene index and pacing). *Verified: 0 → 24 elements.*

Recorded per the AI Dev Kit playbook: systematic misses belong to the converter
*algorithm* and are fixed here (mirrored JS + PHP), not per-site. Each entry is a
reproducible pattern with the observed failure.

## Scroll-hijacked / virtual-scroll SPAs extract 0 sections

**Observed:** a Nuxt/Lenis marketing site whose whole page is a fixed-viewport
cinematic experience — `document.body.scrollHeight` stays ≈ one viewport, every
content "slide" is a `fixed inset-0` full-screen overlay (often `invisible` /
`pointer-events-none` until its scroll segment), and the visual background is a
`<canvas>` scroll-scrubbed image sequence in a fixed `-z-10` container. Wheel
events drive a virtual timeline, not the document scroll.

**Failure:** `capture-extract.mjs` section_roots() finds no in-flow bands →
`extracted 0 sections`, empty `pages.json` builder, empty conversion report
(misleading 100% style-coverage). The rendered DOM + media ARE captured fine.

**Repro:** any site with `position:fixed; inset:0` slide containers and a
~viewport-height body (e.g. AI-product launch sites with Apple-style camera
rides).

**Status (v1.7.43):** DETECTION + EMIT SHIPPED — the animation tracer (`to-animations.mjs`) flags
the pattern (`animation-report.csv`: a high-confidence `scroll-hijack` row + `frame-sequence` rows
with the exact `%d` pattern/count/start), extracts the fixed overlays as **story scenes** (text
nodes joined across word/letter-split spans; heading vs paragraph classified by effective
font-size), and the capture pipeline emits **one editable scrollytelling STAGE section** (one
column per scene + the longest sequence as the scrubbed backdrop) into `pages.json` when the page
would otherwise convert empty. A detected motion profile (reveal / hover lift-scale-color_shift /
Lenis smooth scroll) is also stamped onto converted nodes as Animation Engine fx blocks.

**v1.7.44 — TIMELINE SAMPLER:** the tracer now wheel-drives hijacked pages from the top (after a
reload), sampling per step which fixed overlays are visible; the **canvas-bearing overlays'
visible spans segment the page into story stretches** (frame requests preload upfront, so request
timing can't), long sequences map onto stretches in request order, scene pacing comes from
first-appearance deltas, and fragmented stretches are merged to a fixed point. The emit then
produces **multiple properly-paced stage sections** (e.g. hero-ride story + footer-ride story)
instead of one guessed section.

**v1.7.45 — SLIDE IMAGERY + WORD REVEALS:** each scene now carries its **hero image** as a
`media_image` node (largest non-backdrop raster/`background-image` in the overlay; the full-bleed
sequence is excluded by area) — so picture-led slides survive and text+image slides keep both, and
an image-only slide is a real (quiet) scene that preserves pacing. Headings shattered into many
single-word/letter spans are detected as **word reveals** and emitted with the
`scroll_text_highlight` (fill) fx, reproducing the source's SplitText-style reveal.

**v1.7.46 — SELF-CONTAINED IMPORT (no hotlinking):** the scroll-story backdrop is now emitted as
the **`frames` source** (each frame a Media-Library slot the user can swap) with the frame URLs
enumerated from the ride pattern, and the capture harvests **every** URL the emitted builder trees
reference (backdrop frames + slide `media_image`) into `media.json`. So the standard converter
pipeline sideloads them in its media phase and rewrites each tree URL to its local attachment in the
pages phase — the converted page hotlinks nothing. Verified end-to-end: a cold poly.app capture
imported into a clean install renders the rides + scenes from local media.

**Still open:**
- **Long rides are slow + heavy to sideload.** poly = 636 frames = 636 sequential downloads
  (minutes) and 636 Media-Library items. Correct per the replaceability principle, but a future
  optimization (parallel sideload, or a folder-based numbered-sequence import that keeps ONE
  reference) would make big rides painless. Typical rides (~120 frames) are fine today.
- The scene's image is placed below its heading (stacked); the source's exact composition
  (overlap, offset, film-strip framing) isn't reconstructed — a builder refinement.
- Backdrop frames are hotlinked to the source CDN — the importer should localize them (or the
  builder user swaps in uploaded frames via the backdrop's `frames` source).
- `pg.smooth_scroll` on a pages.json entry needs the PHP importer to honor it (harmless if ignored).
- Scene extraction is text-first — imagery inside overlay slides is not yet carried into scenes.

**Fix direction (when tackled):**
1. Detect the pattern: body scrollHeight ≤ ~1.5 × viewport AND ≥ 2 fixed
   full-viewport containers with meaningful text/media.
2. Treat each fixed full-screen overlay group as a *virtual section* (order =
   DOM order), un-fix it for extraction, and emit sections from those.
3. Detect a fixed canvas + numbered frame requests (e.g. `…/N.webp`) and emit an
   `image_sequence` node (pattern branch) instead of dropping the canvas.
4. Drive the page with synthetic wheel events (not scrollTo) during capture so
   lazy slide assets and frame sequences load.
5. Flag the pattern in the conversion report (`scroll-hijack` row) instead of
   reporting 0 elements silently.

Mirror any implemented fix in the PHP file path (`class-fw-site-converter-stitch.php`
has the same in-flow section_roots() assumption).
