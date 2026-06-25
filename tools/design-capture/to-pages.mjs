// Map a design-capture's body sections → an editable page-builder page (the "copy the
// whole thing" body path). Emits the { pages: [ … ] } payload the Site Converter's Pages
// importer consumes — which sets the post's page-builder option so the plugin's own encoder
// regenerates post_content (nothing hand-coded), leaving every section editable in the builder.
//
// VERBATIM MIRROR (same technique as the header/footer raw-chrome path): each source
// <section> becomes a full-width builder `section` → one `column` → one `code-block` holding
// the section's EXACT outerHTML (captured in capture-extract.mjs as `section.rawHtml`, URLs
// absolutized + scripts stripped). `code-block` is the universal FALLBACK shortcode for any
// markup we don't yet map to a dedicated shortcode — its `code-editor` field outputs raw,
// un-processed HTML and survives the builder save intact. The section's OWN CSS (captured as
// `section.css`) rides in the section's Advanced → Custom CSS, so it travels with the section
// and renders late enough to win the cascade. Shared framework CSS (Bootstrap, fonts, :root,
// chrome) stays global in the theme (raw_chrome.css). <img src> is re-pointed to the imported
// attachment at import time.
//
// The builder section/column are neutral wrappers (full-width + a `.sc-mirror` reset zeroes
// their container/gutter padding in the theme CSS) so the source markup owns its own layout.
// Heavy default att-blobs are cloned from atom-templates.json (real nodes from a proven
// export); only the CONTENT is swapped, per "clone shapes from a real export, only swap content."

import { readFileSync } from 'node:fs';

// 32-hex unique id for each builder node (matches the export's unique_id shape).
// Web Crypto works in both Node (19+) and Cloudflare Workers, so the mapper is
// portable to the hosted renderer without a Node-only dependency.
const uid = () => {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};

// Default atom templates are read from disk lazily (Node CLI only). A hosted/Worker
// caller passes opts.atoms (an imported JSON), so the filesystem is never touched there.
let _atoms = null;
const defaultAtoms = () => {
  if (!_atoms) _atoms = JSON.parse(readFileSync(new URL('./atom-templates.json', import.meta.url), 'utf8'));
  return _atoms;
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Flatten a decomposed section's CSS so wrapper-scoped rules map onto the rebuilt markup:
// `.banner .block h1` → `.banner h1`. Recurses @media/@supports; leaves @font-face/@keyframes
// and 1-2 token selectors untouched. (Mirrors FW_Site_Converter_Mapper::flatten_css.)
const flattenSelectors = (sel) => sel.split(',').map((p) => {
  p = p.trim();
  if (!p) return '';
  const toks = p.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  return toks.length <= 2 ? p : toks[0] + ' ' + toks[toks.length - 1];
}).filter(Boolean).join(', ');
const flattenCss = (css) => {
  css = String(css || '');
  if (!css.trim()) return '';
  let out = '', buf = '', i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const prelude = buf.trim(); buf = '';
      let depth = 1; i++; let body = '';
      while (i < css.length && depth > 0) { const c = css[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; } body += c; i++; }
      i++;
      if (prelude[0] === '@') {
        out += /^@(media|supports)/i.test(prelude) ? prelude + '{' + flattenCss(body) + '}' : prelude + '{' + body + '}';
      } else {
        out += flattenSelectors(prelude) + '{' + body + '}';
      }
    } else { buf += ch; i++; }
  }
  return out;
};

export function toPages(capture, opts = {}) {
  const atoms = opts.atoms || defaultAtoms();
  const clone = (k) => structuredClone(atoms[k]);
  const origin = (() => { try { return new URL(capture.url || '').origin; } catch { return ''; } })();
  // De-brand absolute links back to the source origin → site-relative (used for carousel buttons).
  const localize = (href) => {
    href = (href || '').trim();
    if (!href || href === '#') return '#';
    if (origin && href.toLowerCase().startsWith(origin.toLowerCase())) {
      const rest = href.slice(origin.length) || '/';
      return rest[0] === '/' ? rest : '/' + rest;
    }
    return href;
  };

  // Fresh unique_id, and clear any css_id baked into the cloned atom (the `section` atom
  // carries a stale id="hero" from the export it was traced from — without this every
  // section would render id="hero").
  const stamp = (n) => { if (n.atts) { n.atts.unique_id = uid(); n.atts.css_id = ''; } return n; };

  const textBlock = (html) => {
    const n = stamp(clone('text_block'));
    n.atts.text = html;
    n.atts.css_class = '';
    return n;
  };
  const column = (width, items) => {
    const c = stamp(clone('column'));
    c.width = width;
    if (c.atts) c.atts.css_class = '';
    c._items = items;
    return c;
  };
  // The verbatim section HTML goes into a `code-block` (raw, un-processed output — the
  // universal fallback for anything we don't yet map to a dedicated shortcode). The section's
  // own CSS rides in the section's Advanced → Custom CSS (`custom_css`), so it travels with
  // the section, renders late (wins the cascade over the plugin's framework CSS) and stays
  // editable. Source selectors pass through the aggregator unchanged (only the literal token
  // `selector` is rewritten), so the rules target the verbatim markup's source classes.
  const codeBlock = (html) => ({ type: 'simple', shortcode: 'code_block', _items: [], atts: { code: html, unique_id: uid() } });

  // Decomposed leaves → dedicated, editable shortcodes (intro-only): a heading → special_heading,
  // a paragraph → text_block, a CTA → button. Everything else stays a code-block (incl. each grid
  // cell). The source section class is carried onto the builder section so descendant CSS
  // (`.section h2`, `.section .speaker-item`) still styles the extracted/verbatim content.
  const headingNode = (b) => {
    const n = stamp(clone('special_heading'));
    n.atts.title = b.html;
    n.atts.subtitle = '';
    n.atts.overline = '';
    n.atts.heading = 'h' + (b.level >= 1 && b.level <= 6 ? b.level : 2);
    n.atts.alignment = /^(center|right)$/.test(b.align || '') ? b.align : 'left';
    n.atts.css_class = '';
    if (n.atts.overline_color) n.atts.overline_color = { predefined: '', custom: '' };
    return n;
  };
  const buttonBlockNode = (b) => ({ type: 'simple', shortcode: 'button', _items: [], atts: { label: b.label, link: localize(b.href), target: 'no', unique_id: uid() } });
  const blockToNode = (b) => (b.t === 'heading' ? headingNode(b) : b.t === 'button' ? buttonBlockNode(b) : b.t === 'text' ? textBlock(b.html) : codeBlock(b.html));

  // Build a section from decomposed blocks: consecutive intro blocks stack in a full-width
  // column; a `row` block becomes a row of builder columns (one code-block per grid cell).
  const blocksSectionNode = (sec) => {
    const s = stamp(clone('section'));
    const srcCls = String(sec.sectionClass || '').split(/\s+/).filter((c) => c && !/^(swiper|owl|slick|splide|carousel|aos|init|wow)/i.test(c));
    if (s.atts) {
      // Centered .fw-container (not full-width / sc-mirror) — the extracted content has no
      // source .container of its own, so match the source's .container width.
      s.atts.css_class = srcCls.join(' ');
      s.atts.is_fullwidth = false;
      if (sec.css && sec.css.trim()) s.atts.custom_css = flattenCss(sec.css);
    }
    const items = []; let buf = [];
    const flush = () => { if (buf.length) { items.push(column('1_1', buf)); buf = []; } };
    for (const b of sec.blocks) {
      if (b.t === 'row') { flush(); for (const c of b.cols) items.push(column(c.width, [codeBlock(c.html)])); }
      else buf.push(blockToNode(b));
    }
    flush();
    s._items = items.length ? items : [column('1_1', [codeBlock(sec.rawHtml || '')])];
    return s;
  };

  // Verbatim section. The source root's CLASS is hoisted onto the builder <section> and its
  // INNER html goes in the code-block — so there's no nested <section>, and CSS scoped to inner
  // wrappers (e.g. `.banner .block h1`) still matches. `.sc-mirror` resets the builder
  // container/column gutters so the source markup renders edge-to-edge.
  const mirrorSectionNode = (sec) => {
    const s = stamp(clone('section'));
    const srcCls = String(sec.sectionClass || '').split(/\s+/).filter((c) => c && !/^(swiper|owl|slick|splide|carousel|aos|init|wow)/i.test(c));
    if (s.atts) {
      s.atts.css_class = ['sc-mirror'].concat(srcCls).join(' ');
      s.atts.is_fullwidth = true;
      if (sec.css && sec.css.trim()) s.atts.custom_css = sec.css;
    }
    const inner = (sec.rawInner != null ? sec.rawInner : sec.rawHtml) || '';
    s._items = [column('1_1', [codeBlock(inner)])];
    return s;
  };

  // A detected slider section → the editable `carousel` shortcode. Slides carry image /
  // heading / text / button. Heuristics pick the layout: image-only slides read as a logo
  // strip (multi-per-view, no arrows/dots); slides with a heading+button+image read as a hero
  // (background image, text overlaid); everything else is a 1-up content slider.
  const carouselNode = (slider) => {
    const slides = slider.slides;
    const hasText = slides.some((s) => s.heading || s.text || (s.button && s.button.label));
    const isLogo  = !hasText;
    const isHero  = hasText && slides.some((s) => s.button && s.button.label && s.image);
    const perPage = isLogo ? Math.min(slides.length, 5) : 1;
    return {
      type: 'simple', shortcode: 'carousel', _items: [],
      atts: {
        slides: slides.map((s) => ({
          image: { url: s.image || '' },
          image_mode: isHero ? 'background' : 'inline',
          heading: s.heading || '',
          text: s.text || '',
          button_label: (s.button && s.button.label) || '',
          button_link: (s.button && localize(s.button.href)) || '#',
          link: '',
          content_align: 'center',
        })),
        per_page: String(perPage),
        per_page_tablet: String(isLogo ? Math.min(slides.length, 3) : 1),
        per_page_mobile: isLogo ? '2' : '1',
        gap: isLogo ? '2rem' : '1rem',
        height: isHero ? '80vh' : '',
        arrows: isLogo ? 'no' : 'yes',
        pagination: isLogo ? 'no' : 'yes',
        autoplay: 'yes', interval: '5000', speed: '600',
        pause_hover: 'yes', loop: 'yes', drag: 'yes', effect: 'slide',
        overlay: isHero ? 'yes' : 'no', overlay_opacity: 45,
        unique_id: uid(),
      },
    };
  };
  // Slider section → builder section (carries the source section's bg/padding via its class +
  // custom_css) → optional heading code-block + the carousel shortcode.
  const sliderSectionNode = (sec) => {
    const items = [];
    if (sec.slider.heading) items.push(codeBlock(`<h2 class="sc-slider-heading">${sec.slider.heading}</h2>`));
    items.push(carouselNode(sec.slider));
    const s = stamp(clone('section'));
    if (s.atts) {
      const srcCls = String(sec.sectionClass || '').split(/\s+/).filter((c) => c && !/^(swiper|owl|slick|splide|carousel|aos|init)/i.test(c));
      // Centered .fw-container (not full-width / sc-mirror) — matches the source's .container.
      s.atts.css_class = srcCls.join(' ');
      s.atts.is_fullwidth = false;
      if (sec.css && sec.css.trim()) s.atts.custom_css = flattenCss(sec.css);
    }
    s._items = [column('1_1', items)];
    return s;
  };

  // No-rawHtml fallback (older captures / a section the capture couldn't snapshot): dump its
  // heading + paragraphs + buttons + lead image as one column of plain text-blocks.
  const headingTitle = (sec) => (sec.headingHtml && sec.headingHtml.trim()) ? sec.headingHtml : esc(sec.heading || '');
  const buildPlain = (sec) => {
    const items = [];
    if (sec.heading) {
      const lvl = sec.level >= 1 && sec.level <= 6 ? sec.level : 2;
      items.push(textBlock(`<h${lvl}>${headingTitle(sec)}</h${lvl}>`));
    }
    const seen = new Set();
    for (const p of (sec.paragraphs || []).slice(sec.heading ? 1 : 0)) {
      const t = (p || '').trim(); const k = t.toLowerCase();
      if (t && !seen.has(k)) { seen.add(k); items.push(textBlock(`<p>${esc(t)}</p>`)); }
    }
    for (const b of (sec.buttons || [])) {
      if ((b.label || '').trim()) items.push(textBlock(`<p><a href="${esc(b.href || '#')}">${esc(b.label.trim())}</a></p>`));
    }
    if ((sec.images || []).length) items.push(textBlock(`<figure><img src="${esc(sec.images[0])}" alt="" loading="lazy"></figure>`));
    return items.length ? (() => { const s = stamp(clone('section')); if (s.atts) s.atts.css_class = ''; s._items = [column('1_1', items)]; return s; })() : null;
  };

  const builder = [];
  (capture.sections || []).forEach((sec) => {
    let node;
    if (sec.slider && sec.slider.slides && sec.slider.slides.length >= 2) {
      node = sliderSectionNode(sec);            // editable carousel shortcode
    } else if (sec.blocks && sec.blocks.length) {
      node = blocksSectionNode(sec);            // special_heading / text_block / button + grid columns
    } else if (sec.rawHtml || sec.rawInner) {
      node = mirrorSectionNode(sec);            // verbatim (hero / undecomposable) — no nested <section>
    } else {
      node = buildPlain(sec);
    }
    if (node) builder.push(node);
  });

  return {
    pages: [{ title: 'Home', slug: 'home', status: 'publish', front_page: true, builder }],
    css: '', // styling comes from the captured used-CSS shipped with the theme (raw_chrome.css)
  };
}
