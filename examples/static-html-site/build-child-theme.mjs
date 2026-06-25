// Build the `payforituk-test` child theme — the PRODUCTION-ALIGNED home for the carried
// design system (contract §0.4 / analysis §6). Verified against the real payforituk site:
// brand CSS + webfont + domain shortcodes live in the CHILD THEME, not misc_custom_css
// (which was empty on the dev export). This generates a lean child of `unysonplus-theme`:
//   • style.css   — child-theme header + builder/chrome bridges + the carried source CSS,
//                   scoped under .entry-content (G12 containment), :root vars + @keyframes global.
//   • functions.php — enqueues Geist + the child stylesheet at PHP_INT_MAX (after Unyson
//                     shortcode CSS), mirroring how the real payforituk child theme loads.
// Output: d:/Web Dev/payforituk-test/{style.css,functions.php}
//
// Run: node build-child-theme.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../../../payforituk-test/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// --- carried source stylesheet, scoped (same scoper as build-theme-settings.mjs, G12) -------
let sourceCss = readFileSync(new URL('./global.css', import.meta.url), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim();
const DROP = new Set(['*', 'html', 'body', 'a', 'img', 'main', 'header', 'footer', 'section', 'body::before', 'body::after', '.wrap', 'main, header, footer, section']);
function scopeCss(css, prefix) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const n = css.length; const out = []; let i = 0;
  const matchBrace = (s) => { let d = 0; for (let j = s; j < n; j++) { if (css[j] === '{') d++; else if (css[j] === '}' && --d === 0) return j; } return n - 1; };
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    const brace = css.indexOf('{', i); if (brace === -1) break;
    const prelude = css.slice(i, brace).trim();
    const close = matchBrace(brace); const body = css.slice(brace + 1, close); i = close + 1;
    if (/^@(media|supports)/.test(prelude)) out.push(`${prelude}{\n${scopeCss(body, prefix)}\n}`);
    else if (/^@(keyframes|font-face|page|import)/.test(prelude)) out.push(`${prelude}{${body}}`);
    else if (prelude === ':root') out.push(`:root{${body}}`);
    else {
      const kept = prelude.split(',').map(s => s.trim()).filter(Boolean).filter(s => !DROP.has(s) && !/^(\*|html|body)\b/.test(s));
      if (kept.length) out.push(`${kept.map(s => `${prefix} ${s}`).join(', ')}{${body}}`);
    }
  }
  return out.join('\n');
}
sourceCss = scopeCss(sourceCss, '.entry-content');

const bridge = `
/* ===== builder bridge: map builder output -> source design (scoped to page content) ===== */
.entry-content { font-family: var(--font); color: var(--text); }
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
[class*="pfu-"] .heading-overline { font-size: 13px; font-weight: 500; color: var(--text-muted); letter-spacing: -0.1px; margin-bottom: 16px; text-transform: none; }
[class*="pfu-"] .heading-title { font-size: clamp(28px, 3.5vw, 40px); font-weight: 600; letter-spacing: -1.2px; line-height: 1.1; color: var(--black); margin-bottom: 16px; }
.pfu-hero .heading-title { font-size: clamp(38px, 5vw, 60px); line-height: 1.0; letter-spacing: -2px; }
.pfu-hero .heading-title em { font-style: italic; color: var(--blue); font-weight: 500; }
[class*="pfu-"] .heading-subtitle, [class*="pfu-"] .section-sub { font-size: 17px; color: var(--text-muted); max-width: 720px; line-height: 1.55; letter-spacing: -0.1px; margin-bottom: 8px; }
.pfu-trust .trust-pillar, .pfu-resources .trust-block { background: var(--bg); border: 1px solid var(--border); border-radius: 18px; padding: 28px; height: 100%; }
.pfu-methods .method-tile { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px; height: 100%; }
.pfu-what .pfu-what-check { margin-top: 4px; }
.pfu-placeholder { display: block; }

/* ===== chrome bridge: theme header/footer -> source topbar/footer look ===== */
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

const styleHeader = `/*
Theme Name:     PayForItUK Test
Theme URI:      https://payforituk.com/
Description:    TEST child theme of Unyson+ Theme for the AI-to-WordPress conversion round-trip.
                Carries the zippy-praline (PayForItUK) source design system — scoped to
                .entry-content (contract §0.4 / G12) — plus the Geist webfont and the
                builder/chrome bridges. Companion to the imported Full Page template + presets.
                NOT the production theme: that is "payforituk". This is a throwaway test home.
Author:         Conversion round-trip
Template:       unysonplus-theme
Version:        0.0.1
Text Domain:    payforituk-test
*/
`;

writeFileSync(new URL('./style.css', OUT), `${styleHeader}\n${bridge}\n\n/* ===== carried source stylesheet (global.css), scoped to .entry-content ===== */\n${sourceCss}\n`);

const functionsPhp = `<?php
/**
 * payforituk-test — child theme functions.
 *
 * Mirrors the real payforituk child theme's loading strategy: enqueue the Geist webfont
 * and the child stylesheet at PHP_INT_MAX so it lands AFTER Unyson shortcode CSS (printed
 * at wp_enqueue_scripts) and wins the cascade. The design system itself lives in style.css
 * (carried + scoped). No domain shortcodes here — the imported page uses code_block
 * placeholders for [casino_finder] / [reviews_table] (contract §0.5).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Geist webfont (the AI site's typeface).
 */
function payforituk_test_fonts() {
	wp_enqueue_style(
		'payforituk-test-fonts',
		'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap',
		array(),
		null
	);
}
add_action( 'wp_enqueue_scripts', 'payforituk_test_fonts', 20 );

/**
 * Child stylesheet LAST — after Unyson shortcode styles — so the carried design system
 * (scoped to .entry-content) wins the cascade. PHP_INT_MAX mirrors payforituk.
 */
function payforituk_test_style_last() {
	wp_enqueue_style(
		'payforituk-test-style',
		get_stylesheet_uri(),
		array(),
		wp_get_theme()->get( 'Version' )
	);
}
add_action( 'wp_enqueue_scripts', 'payforituk_test_style_last', PHP_INT_MAX );
`;
writeFileSync(new URL('./functions.php', OUT), functionsPhp);

console.log('OK — wrote payforituk-test/style.css + functions.php (scoped carried CSS + bridges + Geist enqueue).');
