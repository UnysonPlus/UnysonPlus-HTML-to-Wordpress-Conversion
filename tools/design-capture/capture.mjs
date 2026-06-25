// Design-capture for the Site Converter.
// Renders the source in the installed Chrome and produces the convert bundle. MULTI-PAGE:
// captures the home page, then crawls the header nav's internal links and captures each as
// its own WordPress page. The chrome (header/footer) + theme + style guide come from home;
// every page's body is a verbatim mirror. Internal links are rewritten to root-relative WP
// paths (/<slug>/) so the converted site navigates between the real pages.
//
//   node capture.mjs <url> [outdir]
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
import { toDesignConfig } from './to-design-config.mjs';
import { toPages } from './to-pages.mjs';
import { toStyleGuide } from './to-styleguide.mjs';
import { toPresets } from './to-presets.mjs';
import { makeZip } from './minimal-zip.mjs';
import { extractDesign } from './capture-extract.mjs';

const url = process.argv[2];
if (!url) { console.error('usage: node capture.mjs <url> [outdir]'); process.exit(1); }
const outdir = process.argv[3] || 'capture-out';
mkdirSync(outdir, { recursive: true });

const MULTIPAGE = false; // TEMP: home-only while we perfect the homepage. Flip to true to crawl the nav.
const MAX_PAGES = 10;    // home + up to 9 nav pages (keeps the capture within a sane time budget)

const origin = (() => { try { return new URL(url).origin; } catch { return ''; } })();

// A WP-friendly slug from a URL path's last segment (drops extension). '' / index → home.
function slugFromUrl(u) {
  try {
    const path = new URL(u, origin).pathname.replace(/\/+$/, '');
    let seg = (path.split('/').filter(Boolean).pop() || 'home').replace(/\.(html?|php|aspx?)$/i, '');
    seg = seg.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return seg === '' || seg === 'index' ? 'home' : seg;
  } catch { return 'home'; }
}

// Render a URL: navigate, scroll to trigger lazy assets, settle, extract.
async function renderPage(page, target) {
  await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0; const step = 600;
      const t = setInterval(() => {
        window.scrollBy(0, step); y += step;
        if (y >= document.body.scrollHeight) { clearInterval(t); res(); }
      }, 100);
    });
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const data = await page.evaluate(extractDesign);
  return { url: target, ...data };
}

// Internal page URLs from the home nav (same-origin, real paths — not #anchors / mail / tel).
function navPageUrls(homeCapture) {
  const nav = (homeCapture.header && homeCapture.header.nav) || [];
  const homeSlug = slugFromUrl(url);
  const seen = new Set([homeSlug, 'home', 'index']);
  const out = [];
  for (const item of nav) {
    const href = (item.href || '').trim();
    if (!href) continue;
    let abs;
    try { abs = new URL(href, origin); } catch { continue; }
    if (!/^https?:$/.test(abs.protocol) || abs.origin !== origin) continue; // external / mailto / tel
    abs.hash = '';
    const path = abs.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '') continue;     // home / same-page anchor
    const slug = slugFromUrl(abs.href);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(abs.href);
    if (out.length >= MAX_PAGES - 1) break;
  }
  return out;
}

// Rewrite internal links (href="<sourceURL>") to the converted site's root-relative WP path.
function relinkInternal(html, pageMap) {
  if (!html) return html;
  for (const { abs, local } of pageMap) {
    for (const form of [abs, abs.replace(/\/$/, ''), abs.endsWith('/') ? abs : abs + '/']) {
      html = html.split(`href="${form}"`).join(`href="${local}"`);
    }
  }
  // Links to the source home (origin root or an index file) → the WP home.
  if (origin) {
    ['', '/', '/index.html', '/index.htm', '/index.php', '/home'].forEach((suf) => {
      html = html.split(`href="${origin}${suf}"`).join('href="/"');
    });
  }
  return html;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 1) Home.
const home = await renderPage(page, url);

// 1b) Responsive column widths — re-measure each tagged grid cell (data-sc-col, set during the
// extract) at tablet + phone viewports. Framework-agnostic: works for Bootstrap, Tailwind
// (grid-cols-*, w-1/3, md:/lg: prefixes), or custom flex. Merged onto each cell as `wResp`
// {phone,tablet,desktop} (1–12) so the builder column reproduces the source's responsive widths.
// Guarded — any failure leaves the desktop-only fraction (cell.cw) and even-division fallback.
async function measureColWidths(vw) {
  try {
    await page.setViewportSize({ width: vw, height: 900 });
    await page.waitForTimeout(350);
    return await page.evaluate(() => {
      const o = {};
      document.querySelectorAll('[data-sc-col]').forEach((c) => {
        const row = c.parentElement;
        const rw = row ? row.getBoundingClientRect().width : 0;
        const cw = c.getBoundingClientRect().width;
        o[c.getAttribute('data-sc-col')] = (rw > 0 && cw > 0) ? Math.max(1, Math.min(12, Math.round((cw / rw) * 12))) : 12;
      });
      return o;
    });
  } catch { return {}; }
}
const wTablet = await measureColWidths(768);
const wPhone  = await measureColWidths(375);
await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {}); // restore desktop
(home.sections || []).forEach((s) => {
  (s.mapBlocks || []).forEach((b) => {
    (b.cols || []).forEach((c) => {
      if (!c || !c.colId) return;
      c.wResp = { phone: wPhone[c.colId] || c.cw || 12, tablet: wTablet[c.colId] || c.cw || 12, desktop: c.cw || 12 };
    });
  });
});

// 2) Crawl the nav and capture each internal page (disabled while we focus on the homepage).
const extraUrls = MULTIPAGE ? navPageUrls(home) : [];
const captures = [{ capture: home, slug: 'home', front: true }];
for (const u of extraUrls) {
  try {
    const cap = await renderPage(page, u);
    captures.push({ capture: cap, slug: slugFromUrl(u), front: false });
  } catch (e) {
    console.log('  ! skipped', u, '-', e.message);
  }
}

// 3) Link map (source URL → root-relative WP path) and relink chrome + every page's body.
const pageMap = captures.map((c) => ({ abs: c.capture.url, local: c.front ? '/' : '/' + c.slug + '/' }));
if (home.chrome) {
  home.chrome.header_html = relinkInternal(home.chrome.header_html, pageMap);
  home.chrome.footer_html = relinkInternal(home.chrome.footer_html, pageMap);
  // Relink the mapped nav tree's hrefs to local pages too (same source→WP path map).
  const relinkTree = (items) => (Array.isArray(items) ? items.map((it) => ({
    ...it,
    href: typeof it.href === 'string' ? relinkInternal(it.href, pageMap) : it.href,
    children: relinkTree(it.children),
  })) : []);
  if (Array.isArray(home.chrome.nav_tree)) { home.chrome.nav_tree = relinkTree(home.chrome.nav_tree); }
  // Relink the footer column placeholders + copyright HTML too.
  if (Array.isArray(home.chrome.footer_cols)) { home.chrome.footer_cols = home.chrome.footer_cols.map((h) => relinkInternal(h, pageMap)); }
  if (typeof home.chrome.footer_copyright === 'string') { home.chrome.footer_copyright = relinkInternal(home.chrome.footer_copyright, pageMap); }
}
captures.forEach((c) => {
  (c.capture.sections || []).forEach((s) => { if (s.rawHtml) s.rawHtml = relinkInternal(s.rawHtml, pageMap); });
});

// 4) Theme + style guide from home; one builder page per captured source page.
const config = toDesignConfig(home);
if (home.chrome) config.raw_chrome = home.chrome;

const titleFor = (cap, slug) => {
  const t = (cap.title || '').split(/\s+[|–—·-]\s+/)[0].trim();
  return t || slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
};
const builderPages = captures.map((c) => {
  const pg = toPages(c.capture).pages[0];
  pg.title = titleFor(c.capture, c.slug);
  pg.slug = c.slug;
  pg.status = 'publish';
  pg.front_page = c.front;
  return pg;
});
const pages = { pages: builderPages };

// 5) Media = union of every captured page's images.
const mediaSet = new Set();
captures.forEach((c) => (c.capture.assets.images || []).forEach((u) => mediaSet.add(u)));
const media = { urls: [...mediaSet] };

const styleguide = { pages: [toStyleGuide(home, config)] };

// Color/styling presets from the captured palette — so the converted site's Component Presets
// (Color Presets admin) match the /style-guide/ page. Without this the plugin defaults stay.
const presets = toPresets(config, home);

// Mapping document — every captured page's sections broken into candidate elements, so the
// plugin's review editor can suggest a role per element (heuristics + learned rules) and the
// user can correct it before the page is built. Roles are assigned plugin-side.
const mapping = {
  pages: captures.map((c) => ({
    slug: c.slug,
    front_page: c.front,
    sections: (c.capture.sections || []).map((s, i) => ({
      index: i,
      sectionClass: s.sectionClass || '',
      colClass: s.colClass || '',
      innerWrapClass: s.innerWrapClass || '', // styling wrapper inside the content column → column's Inner Wrapper Class
      css: s.css || '',
      computed: s.computed || {},  // appearance summary (background, padding, color, font…)
      assets: s.assets || [],      // images / bg-images used in this section
      raw: s.rawInner || s.rawHtml || '', // verbatim inner HTML — used by the "As one code-block" toggle
      blocks: s.mapBlocks || [],
    })),
  })),
};

writeFileSync(`${outdir}/design-capture.json`, JSON.stringify(home, null, 2));
writeFileSync(`${outdir}/mapping.json`, JSON.stringify(mapping, null, 2));

// Per-section spec — a human-readable audit of each section's id/class, computed look, assets,
// elements and matched-CSS size. Mirrors the clone-website skill's per-section spec, adapted to
// our section-based pipeline. (The admin mapper reads the same data from mapping.json.)
function specSlug(cls, idx) {
  // Prefer a descriptive class (about/process/cta/portfolio) over generic structural ones.
  const first = (cls || '').split(/\s+/).find((c) => c && !/^(sc-mirror|section|wrapper|block|area|inner|content|main|elementor|d-|align-|justify-|text-|p[xytrbl]?-|m[xytrbl]?-|g-|container|row|col|w-|h-|bg-|position-|overflow-|order-)/.test(c));
  return ((first || ('section-' + (idx + 1))).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || ('section-' + (idx + 1));
}
let spec = `# Conversion spec — ${url}\n`;
mapping.pages.forEach((pg) => {
  spec += `\n## Page: ${pg.slug}${pg.front_page ? ' (home)' : ''} — ${pg.sections.length} section(s)\n`;
  pg.sections.forEach((sc, i) => {
    spec += `\n### Section ${i + 1} — \`${sc.sectionClass || '(no class)'}\`  ·  id: \`${specSlug(sc.sectionClass, i)}\`\n`;
    const look = Object.keys(sc.computed || {}).map((k) => `${k}: ${sc.computed[k]}`).join('; ');
    if (look) spec += `- **Look:** ${look}\n`;
    if ((sc.assets || []).length) spec += `- **Assets (${sc.assets.length}):** ${sc.assets.slice(0, 12).join(', ')}${sc.assets.length > 12 ? ', …' : ''}\n`;
    spec += `- **Elements (${(sc.blocks || []).length}):**\n`;
    (sc.blocks || []).forEach((b) => {
      const label = b.t === 'row'
        ? `row — ${(b.cols || []).length} columns [${(b.cols || []).map((c) => c.width).join(', ')}]`
        : (b.tag ? `<${b.tag}> ` : '') + (b.text || b.label || (b.html || '').replace(/\s+/g, ' ')).slice(0, 80);
      spec += `  - \`${b.t}\` ${label}\n`;
    });
    if (sc.css) spec += `- **Matched CSS:** ${Math.round((sc.css.length / 1024) * 10) / 10} KB\n`;
  });
});
writeFileSync(`${outdir}/spec.md`, spec);
writeFileSync(`${outdir}/design-config.json`, JSON.stringify(config, null, 2));
writeFileSync(`${outdir}/pages.json`, JSON.stringify(pages, null, 2));
writeFileSync(`${outdir}/styleguide.json`, JSON.stringify(styleguide, null, 2));
writeFileSync(`${outdir}/media.json`, JSON.stringify(media, null, 2));
writeFileSync(`${outdir}/presets.json`, JSON.stringify(presets, null, 2));

const bundleZip = makeZip([
  { name: 'bundle.json', data: JSON.stringify({ name: config.theme.name, source: url, generated: 'design-capture', pages: builderPages.length }, null, 2) },
  { name: 'media.json', data: JSON.stringify(media, null, 2) },
  { name: 'theme-design.json', data: JSON.stringify(config, null, 2) },
  { name: 'styleguide.json', data: JSON.stringify(styleguide, null, 2) },
  { name: 'presets.json', data: JSON.stringify(presets, null, 2) },
  { name: 'mapping.json', data: JSON.stringify(mapping, null, 2) },
  { name: 'pages.json', data: JSON.stringify(pages, null, 2) },
]);
writeFileSync(`${outdir}/convert-bundle.zip`, bundleZip);
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await page.screenshot({ path: `${outdir}/full.png`, fullPage: true }).catch(() => {});

console.log('captured →', outdir);
console.log('  theme:', `heading=${config.fonts.heading || '?'} | body=${config.fonts.body || '?'} | accent=${config.colors.accent || '?'}`);
if (home.chrome) {
  console.log('  raw-chrome:', `header=${home.chrome.header_html ? Math.round(home.chrome.header_html.length / 1024) + 'kb' : 'none'} | css=${Math.round((home.chrome.css || '').length / 1024)}kb | linked=${home.chrome.linked_css.length}`);
}
console.log('  pages:', builderPages.map((p) => `${p.slug}${p.front_page ? '*' : ''}(${p.builder.length})`).join(', '));
console.log('  media:', media.urls.length, 'images');
const tc = (presets.values && presets.values.theme_colors) || [];
console.log('  presets:', `${tc.length} colors | Primary=${(tc.find((c) => c.name === 'Primary') || {}).color} Accent=${(tc.find((c) => c.name === 'Accent') || {}).color}`);
console.log('  bundle: convert-bundle.zip');
await browser.close();
