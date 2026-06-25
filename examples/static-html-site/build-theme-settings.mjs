// Phase 2 — theme-settings DESIGN file generator (PayForItUK round-trip).
// Produces theme-settings-design.json: the `_fw_settings_export` envelope (contract §4.2)
// whose `values.misc_custom_css.custom_css` carries the whole design system —
//   (a) @import for the Geist webfont (so the font loads with no child-theme enqueue),
//   (b) a "builder bridge" mapping UnysonPlus builder output (clean pfu-* section classes +
//       .heading-title / container) to the source's section layout + heading scale, and
//   (c) the carried source stylesheet (global.css), which styles the code_block
//       bands (phone, table, pay-rows, cards, badges) that keep their source markup classes.
// misc_custom_css emits in <style id="unysonplus-custom-css"> at wp_head 999 → wins the cascade.
//
// Mapping > preservation: the template no longer carries verbatim source SECTION class names;
// each section has a clean `pfu-<name>` class + a css_id, and the bridge below maps those
// intentional classes to the source's per-section padding/background.
//
// Run: node build-theme-settings.mjs

import { readFileSync, writeFileSync } from 'node:fs';

// carried source stylesheet, minus its leading /* … */ header comment
let sourceCss = readFileSync(new URL('./global.css', import.meta.url), 'utf8');
sourceCss = sourceCss.replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim();

// --- CONTAINMENT (gap G12) ---------------------------------------------------
// A verbatim site stylesheet bleeds into the theme chrome two ways: (1) global
// resets (* / html / body / a / img / body::before/after / bare element selectors)
// restyle everything; (2) generic class names (.nav .card .cta .container .wrap)
// collide with Bootstrap/theme classes site-wide. Fix: SCOPE every component rule
// under `.entry-content` (the page-content wrapper — confirmed in the theme's
// content-page.php), keep :root vars + @keyframes GLOBAL (the chrome bridge needs
// the vars), and DROP the resets entirely.
const DROP = new Set(['*', 'html', 'body', 'a', 'img', 'main', 'header', 'footer', 'section', 'body::before', 'body::after', '.wrap', 'main, header, footer, section']);
function scopeCss(css, prefix) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const n = css.length; const out = []; let i = 0;
  const matchBrace = (s) => { let d = 0; for (let j = s; j < n; j++) { if (css[j] === '{') d++; else if (css[j] === '}' && --d === 0) return j; } return n - 1; };
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    const brace = css.indexOf('{', i); if (brace === -1) break;
    const prelude = css.slice(i, brace).trim();
    const close = matchBrace(brace);
    const body = css.slice(brace + 1, close);
    i = close + 1;
    if (/^@(media|supports)/.test(prelude)) { out.push(`${prelude}{\n${scopeCss(body, prefix)}\n}`); }
    else if (/^@(keyframes|font-face|page|import)/.test(prelude)) { out.push(`${prelude}{${body}}`); }
    else if (prelude === ':root') { out.push(`:root{${body}}`); }
    else {
      const kept = prelude.split(',').map(s => s.trim()).filter(Boolean)
        .filter(s => !DROP.has(s) && !/^(\*|html|body)\b/.test(s));
      if (!kept.length) continue;
      out.push(`${kept.map(s => `${prefix} ${s}`).join(', ')}{${body}}`);
    }
  }
  return out.join('\n');
}
sourceCss = scopeCss(sourceCss, '.entry-content');

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');`;

const bridge = `
/* ===== builder bridge (Phase 2): map builder output -> source design ===== */
/* Sections use clean pfu-* classes + a css_id; section layout (padding/bg) is mapped to
   those intentional classes here (not incidental source names). Component leaves keep
   well-mapped classes (.method-tile, .trust-pillar, .what-pay-row, .section-sub, …) that
   the carried stylesheet below already styles. */
/* page content uses the brand font (scoped to .entry-content — does NOT touch chrome) */
.entry-content { font-family: var(--font); color: var(--text); }

/* per-section vertical rhythm + backgrounds (ported from the source section rules) */
.pfu-hero        { padding: 40px 0 48px; }
.pfu-match       { padding: 8px 0 80px; }
.pfu-what        { padding: 0 0 88px; }
.pfu-trust       { padding: 0 0 80px; }
.pfu-trust-strip { padding: 24px 0; background: var(--bg-alt); border-block: 1px solid var(--border); }
.pfu-listing     { padding: 0 0 80px; }
.pfu-compare     { padding: 72px 0; background: var(--bg-alt); }
.pfu-methods     { padding: 72px 0; }
.pfu-faq         { padding: 72px 0; background: linear-gradient(180deg, var(--bg-alt) 0%, #F0F4F8 100%); }
.pfu-resources   { padding: 72px 0; }

/* special_heading output -> source heading scale (scoped to builder sections only) */
[class*="pfu-"] .heading-overline { font-size: 13px; font-weight: 500; color: var(--text-muted); letter-spacing: -0.1px; margin-bottom: 16px; text-transform: none; }
[class*="pfu-"] .heading-title { font-size: clamp(28px, 3.5vw, 40px); font-weight: 600; letter-spacing: -1.2px; line-height: 1.1; color: var(--black); margin-bottom: 16px; }
.pfu-hero .heading-title { font-size: clamp(38px, 5vw, 60px); line-height: 1.0; letter-spacing: -2px; }
.pfu-hero .heading-title em { font-style: italic; color: var(--blue); font-weight: 500; }
[class*="pfu-"] .heading-subtitle, [class*="pfu-"] .section-sub { font-size: 17px; color: var(--text-muted); max-width: 720px; line-height: 1.55; letter-spacing: -0.1px; margin-bottom: 8px; }

/* icon_box wrappers inherit the source card / tile / pillar looks via their component classes */
.pfu-trust .trust-pillar, .pfu-resources .trust-block { background: var(--bg); border: 1px solid var(--border); border-radius: 18px; padding: 28px; height: 100%; }
.pfu-methods .method-tile { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px; height: 100%; }
.pfu-what .pfu-what-check { margin-top: 4px; }

.pfu-placeholder { display: block; }

/* ===== chrome bridge (Phase 3): theme header/footer -> source topbar/footer look ===== */
/* Confirmed selectors: #masthead (header), .primary-menu (primary location), #colophon (footer). */
#masthead, #masthead .header-main { background: rgba(255, 255, 255, 0.85); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
#masthead { border-bottom: 1px solid var(--border); }
#masthead .primary-menu { display: flex; gap: 28px; align-items: center; }
#masthead .primary-menu a { font-size: 14px; color: var(--text-muted); font-weight: 500; letter-spacing: -0.1px; transition: color .15s; }
#masthead .primary-menu a:hover { color: var(--text); }
#masthead .site-title, #masthead .site-title a { font-size: 20px; font-weight: 600; letter-spacing: -0.4px; color: var(--text); }
#colophon { font-size: 12px; color: var(--text-light); line-height: 1.7; letter-spacing: -0.1px; }
#colophon a { color: var(--text-muted); font-weight: 500; }
#colophon a:hover { color: var(--text); }
`;

const css = [fontImport, bridge, '/* ===== carried source stylesheet (global.css) ===== */', sourceCss].join('\n\n');

const envelope = {
  _fw_settings_export: {
    format_version: 1,
    scope: 'design',
    theme_id: 'unysonplus', // parent theme id; import is tolerant of child-theme id (warns, still applies recognized keys)
    theme_version: '2.1.43',
    exported_at: 1749513600,
    excluded: ['misc_analytics', 'misc_performance', 'misc_maintenance', 'misc_404', 'misc_custom_scripts'],
    media_stripped: true,
  },
  values: {
    misc_custom_css: { custom_css: css },
  },
};

writeFileSync(new URL('./theme-settings-design.json', import.meta.url), JSON.stringify(envelope, null, 2));
console.log(`OK — wrote theme-settings-design.json (custom_css ${css.length} chars).`);
