// Design-capture for the Site Converter.
// Renders source site(s) in the installed Chrome and produces the convert bundle + conversion
// report for each. QUEUE: pass one OR MANY URLs and they're captured sequentially (one at a time)
// in a single Chrome — so you don't re-type the command per site, and two runs never collide.
//
//   node capture.mjs <url> [url2 url3 …] [base-outdir] [--report-only] [--list=urls.txt]
//                     [--skip-header] [--skip-footer] [--skip-sections=0,2] [--only-sections=1,3]
//
// • Multiple URLs run one after another, each into its own capture-out/<site>/ folder.
// • --list=urls.txt reads more URLs from a file (one per line; blank lines / #comments ignored).
// • A non-URL positional arg is the base output dir (default: capture-out).
// • SKIP FLAGS preserve QA'd parts on a re-run: --skip-header / --skip-footer drop the chrome;
//   --skip-sections=<s_index list> drops those body bands; --only-sections=<list> keeps ONLY those.
//   (s_index = the section number shown in conversion-report.csv.) Re-importing then leaves the
//   parts you already accepted untouched.
// • If a site fails (e.g. a flaky network), it writes <site>/error.txt and the queue CONTINUES.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { toDesignConfig } from './to-design-config.mjs';
import { toPages } from './to-pages.mjs';
import { toStyleGuide } from './to-styleguide.mjs';
import { toPresets } from './to-presets.mjs';
import { toThemeSettings } from './to-theme-settings.mjs';
import { makeZip } from './minimal-zip.mjs';
import { extractDesign } from './capture-extract.mjs';
import { toReport } from './to-report.mjs';
import { toStyleReport } from './to-style-report.mjs';
import { sanitizeReport, postToForm, buildMailto, loadShareConfig } from './to-share.mjs';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const PKG_VERSION = (() => { try { return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version || ''; } catch { return ''; } })();

// --- Args -------------------------------------------------------------------
const _args = process.argv.slice(2);
const _flags = _args.filter((a) => a.startsWith('--'));
const _pos = _args.filter((a) => !a.startsWith('--'));
const isUrl = (s) => /^(https?|file):\/\//i.test(s); // accept local file:// sources too
const REPORT_ONLY = _flags.includes('--report-only') || process.env.REPORT_ONLY === '1';
// --fidelity: prefer VERBATIM mirroring for every section (max design fidelity, less granular
// editing) instead of decomposing into shortcodes — for design-heavy / Tailwind / SPA sources.
const FIDELITY = _flags.includes('--fidelity') || process.env.FIDELITY === '1';
// Opt-in report sharing (default OFF). `--share-preview` builds the anonymized share-report.json so you
// can inspect exactly what WOULD be sent; `--share` also submits it (Google Form → Sheet → the project
// inbox), an explicit per-run consent. See docs/report-sharing.md. `--share` implies building the preview.
const SHARE = _flags.includes('--share') || process.env.UPW_SHARE === '1';
const SHARE_PREVIEW = SHARE || _flags.includes('--share-preview') || process.env.UPW_SHARE_PREVIEW === '1';
// Preserve QA'd parts on a RE-RUN: skip the header/footer chrome, or keep/drop specific body sections
// (by the s_index shown in the conversion report). e.g. `--skip-header --skip-sections=0,2` or
// `--only-sections=1,3` — so a re-convert only touches the parts you still want reconverted.
const SKIP_HEADER = _flags.includes('--skip-header') || process.env.UPW_SKIP_HEADER === '1';
const SKIP_FOOTER = _flags.includes('--skip-footer') || process.env.UPW_SKIP_FOOTER === '1';
const _intList = (name) => { const f = _flags.find((x) => x.startsWith(name + '=')); return f ? f.slice(name.length + 1).split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !Number.isNaN(n)) : null; };
const SKIP_SECTIONS = _intList('--skip-sections'); // drop these s_index sections
const ONLY_SECTIONS = _intList('--only-sections'); // keep ONLY these s_index sections
const baseOutdir = _pos.find((p) => !isUrl(p)) || 'capture-out';
let urls = _pos.filter(isUrl);
const listFlag = _flags.find((f) => f.startsWith('--list='));
if (listFlag) {
  const file = listFlag.slice('--list='.length);
  try {
    urls = urls.concat(readFileSync(file, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#')));
  } catch (e) { console.error('could not read --list file:', file, '-', e.message); }
}
// de-dupe, preserve order
urls = [...new Set(urls)];
if (!urls.length) {
  console.error('usage: node capture.mjs <url> [url2 …] [base-outdir] [--report-only] [--fidelity] [--list=urls.txt] [--share-preview] [--share] [--skip-header] [--skip-footer] [--skip-sections=0,2] [--only-sections=1]');
  process.exit(1);
}

const MULTIPAGE = false; // TEMP: home-only while we perfect the homepage. Flip to true to crawl the nav.
const MAX_PAGES = 10;    // home + up to 9 nav pages (keeps the capture within a sane time budget)

// --- Per-capture mutable state (set by captureOne, used by the helpers below) ---
let origin = '';
let outdir = '';
let page = null;
let _t0 = 0;
const step = (m) => console.log(`  [${((Date.now() - _t0) / 1000).toFixed(1)}s] ${m}`);

// A report folder name from the site URL: host (minus leading "www."), dots/punct → "_".
// e.g. https://www.mintlify.com → "mintlify_com", https://docs.stripe.com/x → "docs_stripe_com_x".
function siteSlug(u) {
  try {
    const url = new URL(u);
    let s = url.hostname.replace(/^www\./i, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
    const path = url.pathname.replace(/^\/+|\/+$/g, '');
    if (path) s += '_' + path.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
    return s || 'site';
  } catch { return 'site'; }
}

// A WP-friendly slug from a URL path's last segment (drops extension). '' / index → home.
function slugFromUrl(u) {
  try {
    const path = new URL(u, origin).pathname.replace(/\/+$/, '');
    let seg = (path.split('/').filter(Boolean).pop() || 'home').replace(/\.(html?|php|aspx?)$/i, '');
    seg = seg.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return seg === '' || seg === 'index' ? 'home' : seg;
  } catch { return 'home'; }
}

// Run a page.evaluate, retrying if a late client re-render destroys the execution context.
async function evalSafe(p, fn, arg) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await p.evaluate(fn, arg); }
    catch (e) {
      lastErr = e;
      if (!/context was destroyed|Execution context|navigation/i.test(String(e && e.message))) { throw e; }
      await p.waitForTimeout(700);
    }
  }
  throw lastErr;
}

// Render a URL: navigate, let late CDN runtimes settle, scroll to trigger lazy assets, extract.
async function renderPage(p, target) {
  step(`navigating ${target} … (can take up to ~60s on heavy SPAs)`);
  await p.goto(target, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await p.waitForLoadState('load').catch(() => {});
  await p.waitForFunction(() => {
    let rules = 0;
    for (const s of Array.from(document.styleSheets)) {
      try { rules += (s.cssRules || []).length; } catch { /* cross-origin */ }
    }
    const ff = getComputedStyle(document.body).fontFamily || '';
    return rules >= 40 || ff.toLowerCase().includes('inter');
  }, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  step('rendered — scrolling to trigger lazy assets…');
  await evalSafe(p, async () => {
    await new Promise((res) => {
      let y = 0; const stepY = 600;
      const t = setInterval(() => {
        window.scrollBy(0, stepY); y += stepY;
        if (y >= document.body.scrollHeight) { clearInterval(t); res(); }
      }, 100);
    });
  });
  await p.waitForTimeout(900);
  await evalSafe(p, () => window.scrollTo(0, 0));
  await p.waitForTimeout(250);
  const data = await evalSafe(p, extractDesign);
  step(`extracted ${(data.sections || []).length} sections`);
  // Stamp each meaningful element's RESOLVED computed styles onto a `data-sc-cs` attribute so the
  // deterministic PHP engine can reproduce the look of ANY site. Kept in a data-attr (not `style`).
  await evalSafe(p, () => {
    const PROPS = ['background-color','background-image','color','font-family','font-size','font-weight','line-height','letter-spacing','text-align','text-transform','text-decoration-line','padding','margin','border-top-width','border-top-style','border-top-color','border-radius','box-shadow','max-width','display','gap','justify-content','align-items','flex-direction'];
    const skip = { 'background-color':v=>v==='rgba(0, 0, 0, 0)'||v==='transparent', 'background-image':v=>v==='none', 'box-shadow':v=>v==='none', 'max-width':v=>v==='none', 'text-decoration-line':v=>v==='none', 'text-transform':v=>v==='none', 'gap':v=>v==='normal'||v==='0px', 'padding':v=>v==='0px', 'margin':v=>v==='0px', 'border-top-width':v=>v==='0px', 'letter-spacing':v=>v==='normal' };
    const els = document.querySelectorAll('body *');
    for (let i = 0; i < els.length; i++) {
      const el = els[i], tag = el.tagName.toLowerCase();
      if (['script','style','noscript','svg','path','br','head','link','meta'].includes(tag)) continue;
      const cs = getComputedStyle(el), add = [];
      for (const pr of PROPS) {
        const v = cs.getPropertyValue(pr);
        if (!v || (skip[pr] && skip[pr](v))) continue;
        add.push(pr + ':' + v);
      }
      if (add.length) el.setAttribute('data-sc-cs', add.join(';'));
    }
  });
  const renderedHtml = await p.content().catch(() => '');
  return { url: target, renderedHtml, ...data };
}

// Responsive column widths — re-measure each tagged grid cell at tablet + phone viewports.
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

// Internal page URLs from the home nav (same-origin, real paths).
function navPageUrls(homeCapture, srcUrl) {
  const nav = (homeCapture.header && homeCapture.header.nav) || [];
  const homeSlug = slugFromUrl(srcUrl);
  const seen = new Set([homeSlug, 'home', 'index']);
  const out = [];
  for (const item of nav) {
    const href = (item.href || '').trim();
    if (!href) continue;
    let abs;
    try { abs = new URL(href, origin); } catch { continue; }
    if (!/^https?:$/.test(abs.protocol) || abs.origin !== origin) continue;
    abs.hash = '';
    const path = abs.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '') continue;
    const slug = slugFromUrl(abs.href);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(abs.href);
    if (out.length >= MAX_PAGES - 1) break;
  }
  return out;
}

// Rewrite internal links to the converted site's root-relative WP path.
function relinkInternal(html, pageMap) {
  if (!html) return html;
  for (const { abs, local } of pageMap) {
    for (const form of [abs, abs.replace(/\/$/, ''), abs.endsWith('/') ? abs : abs + '/']) {
      html = html.split(`href="${form}"`).join(`href="${local}"`);
    }
  }
  if (origin) {
    ['', '/', '/index.html', '/index.htm', '/index.php', '/home'].forEach((suf) => {
      html = html.split(`href="${origin}${suf}"`).join('href="/"');
    });
  }
  return html;
}

// --- Capture ONE site (returns report stats; throws on fatal error) ---------
async function captureOne(browser, srcUrl, baseDir, reportOnly) {
  origin = (() => { try { return new URL(srcUrl).origin; } catch { return ''; } })();
  outdir = `${baseDir}/${siteSlug(srcUrl)}`;
  mkdirSync(outdir, { recursive: true });
  _t0 = Date.now();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    // 1) Home.
    const home = await renderPage(page, srcUrl);

    // 1b) Responsive column widths (tablet + phone).
    step('measuring responsive column widths (tablet + phone)…');
    const wTablet = await measureColWidths(768);
    const wPhone = await measureColWidths(375);
    await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
    (home.sections || []).forEach((s) => {
      (s.mapBlocks || []).forEach((b) => {
        (b.cols || []).forEach((c) => {
          if (!c || !c.colId) return;
          c.wResp = { phone: wPhone[c.colId] || c.cw || 12, tablet: wTablet[c.colId] || c.cw || 12, desktop: c.cw || 12 };
        });
      });
    });

    // 2) Optional nav crawl (disabled).
    const extraUrls = MULTIPAGE ? navPageUrls(home, srcUrl) : [];
    const captures = [{ capture: home, slug: 'home', front: true }];
    for (const u of extraUrls) {
      try { captures.push({ capture: await renderPage(page, u), slug: slugFromUrl(u), front: false }); }
      catch (e) { console.log('  ! skipped', u, '-', e.message); }
    }

    // 3) Link map + relink chrome + bodies.
    const pageMap = captures.map((c) => ({ abs: c.capture.url, local: c.front ? '/' : '/' + c.slug + '/' }));
    if (home.chrome) {
      home.chrome.header_html = relinkInternal(home.chrome.header_html, pageMap);
      home.chrome.footer_html = relinkInternal(home.chrome.footer_html, pageMap);
      const relinkTree = (items) => (Array.isArray(items) ? items.map((it) => ({
        ...it, href: typeof it.href === 'string' ? relinkInternal(it.href, pageMap) : it.href, children: relinkTree(it.children),
      })) : []);
      if (Array.isArray(home.chrome.nav_tree)) { home.chrome.nav_tree = relinkTree(home.chrome.nav_tree); }
      if (Array.isArray(home.chrome.footer_cols)) { home.chrome.footer_cols = home.chrome.footer_cols.map((h) => relinkInternal(h, pageMap)); }
      if (typeof home.chrome.footer_copyright === 'string') { home.chrome.footer_copyright = relinkInternal(home.chrome.footer_copyright, pageMap); }
    }
    captures.forEach((c) => { (c.capture.sections || []).forEach((s) => { if (s.rawHtml) s.rawHtml = relinkInternal(s.rawHtml, pageMap); }); });

    // 3b) SKIP FLAGS — preserve QA'd parts on a re-run. Drop skipped body sections (by s_index) and
    // blank skipped header/footer chrome, so the emitted bundle + report carry only what you asked to
    // reconvert. (Re-import then leaves the parts you already accepted untouched.)
    if (SKIP_SECTIONS || ONLY_SECTIONS || SKIP_HEADER || SKIP_FOOTER) {
      captures.forEach((c) => {
        c.capture.sections = (c.capture.sections || []).filter((_, i) =>
          ONLY_SECTIONS ? ONLY_SECTIONS.includes(i) : (SKIP_SECTIONS ? !SKIP_SECTIONS.includes(i) : true));
      });
      if (home.chrome && SKIP_HEADER) { home.chrome.header_html = ''; home.chrome.nav_tree = []; home.chrome.logo = null; home.chrome.header_skipped = true; }
      if (home.chrome && SKIP_FOOTER) { home.chrome.footer_html = ''; home.chrome.footer_cols = []; home.chrome.footer_copyright = ''; home.chrome.footer_skipped = true; }
      const parts = [];
      if (ONLY_SECTIONS) parts.push('only sections ' + ONLY_SECTIONS.join(','));
      else if (SKIP_SECTIONS) parts.push('skip sections ' + SKIP_SECTIONS.join(','));
      if (SKIP_HEADER) parts.push('skip header');
      if (SKIP_FOOTER) parts.push('skip footer');
      step('skip flags → ' + parts.join(' · '));
    }

    // 4) Theme + style guide + builder pages.
    step('building theme, pages & conversion report…');
    const config = toDesignConfig(home);
    if (home.chrome) config.raw_chrome = home.chrome;
    // CHROME → parent-theme Theme Settings (playbook: chrome = theme, not page content). Emit the
    // header/footer as native Header/Footer Theme-Settings values + flag the theme-generator to
    // ship a NEAR-EMPTY child theme (no header.php/footer.php) so the parent renders this chrome.
    // MIRROR of the PHP tokens_to_theme_settings_chrome() + chrome_via_settings flag.
    const themeSettings = toThemeSettings(config, home);
    if (themeSettings && themeSettings.values && Object.keys(themeSettings.values).length) {
      config.chrome_via_settings = true;
    }
    const titleFor = (cap, slug) => {
      const t = (cap.title || '').split(/\s+[|–—·-]\s+/)[0].trim();
      return t || slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    };
    const reportPages = [];
    const builderPages = captures.map((c) => {
      const trace = [];
      const pg = toPages(c.capture, { trace, fidelity: FIDELITY }).pages[0];
      pg.title = titleFor(c.capture, c.slug);
      pg.slug = c.slug; pg.status = 'publish'; pg.front_page = c.front;
      reportPages.push({ slug: c.slug, front: c.front, trace });
      return pg;
    });
    const pages = { pages: builderPages };
    const report = toReport({ url: srcUrl, generated: 'design-capture', pages: reportPages });
    // Style-coverage report (CSS-fidelity): which source styles the carried CSS reproduces vs drops.
    const styleReport = toStyleReport({
      url: srcUrl,
      pages: captures.map((c) => ({
        slug: c.slug,
        sections: (c.capture.sections || []).map((s, i) => ({ index: i, sectionClass: s.sectionClass || '', css: s.css || '', styleCensus: s.styleCensus || {} })),
      })),
    });

    // 5) Media + style guide + presets + mapping.
    const mediaSet = new Set();
    captures.forEach((c) => (c.capture.assets.images || []).forEach((u) => mediaSet.add(u)));
    const media = { urls: [...mediaSet] };
    const styleguide = { pages: [toStyleGuide(home, config)] };
    const presets = toPresets(config, home);
    const mapping = {
      pages: captures.map((c) => ({
        slug: c.slug, front_page: c.front,
        sections: (c.capture.sections || []).map((s, i) => ({
          index: i, sectionClass: s.sectionClass || '', colClass: s.colClass || '', innerWrapClass: s.innerWrapClass || '',
          css: s.css || '', computed: s.computed || {}, assets: s.assets || [],
          raw: s.rawInner || s.rawHtml || '', blocks: s.mapBlocks || [],
        })),
      })),
    };

    // Report (always written first).
    writeFileSync(`${outdir}/conversion-report.csv`, report.csv);
    writeFileSync(`${outdir}/conversion-report.html`, report.html);
    writeFileSync(`${outdir}/style-coverage.csv`, styleReport.csv);
    writeFileSync(`${outdir}/style-coverage.html`, styleReport.html);
    step('reports → conversion-report + style-coverage (csv/html)');

    // Opt-in, anonymized report sharing (structural only — no URL/content/PII). Default OFF: nothing is
    // built or sent unless the developer explicitly passes --share-preview / --share.
    if (SHARE_PREVIEW) {
      const sanitized = sanitizeReport({ input: { url: srcUrl, pages: reportPages }, stats: report.stats, converterVersion: PKG_VERSION });
      writeFileSync(`${outdir}/share-report.json`, JSON.stringify(sanitized, null, 2));
      step('share: wrote anonymized share-report.json (structural only — no URLs/content) — inspect before sending');
      if (SHARE) {
        const cfg = loadShareConfig(SCRIPT_DIR);
        if (cfg.form && cfg.form.responseUrl) {
          try {
            const r = await postToForm(sanitized, cfg);
            step(r.ok ? 'share: submitted upstream via Google Form ✓ — thank you' : `share: Form POST failed (status ${r.status}); use the mailto draft instead:`);
            if (!r.ok) console.log('   ', buildMailto(sanitized, cfg));
          } catch (e) {
            step('share: could not reach the Google Form (' + e.message + '); use the mailto draft instead:');
            console.log('   ', buildMailto(sanitized, cfg));
          }
        } else {
          step('share: no Google Form configured yet (copy share-config.example.json → share-config.json). Email it instead:');
          console.log('   ', buildMailto(sanitized, cfg));
        }
      }
    }

    if (reportOnly) {
      step('--report-only: skipped bundle, intermediate JSONs & screenshot');
    } else {
      step('writing files & bundle…');
      writeFileSync(`${outdir}/design-capture.json`, JSON.stringify(home, null, 2));
      if (home.renderedHtml) { writeFileSync(`${outdir}/rendered.html`, home.renderedHtml); }
      writeFileSync(`${outdir}/mapping.json`, JSON.stringify(mapping, null, 2));
      const specSlug = (cls, idx) => {
        const first = (cls || '').split(/\s+/).find((c) => c && !/^(sc-mirror|section|wrapper|block|area|inner|content|main|elementor|d-|align-|justify-|text-|p[xytrbl]?-|m[xytrbl]?-|g-|container|row|col|w-|h-|bg-|position-|overflow-|order-)/.test(c));
        return ((first || ('section-' + (idx + 1))).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || ('section-' + (idx + 1));
      };
      let spec = `# Conversion spec — ${srcUrl}\n`;
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
      writeFileSync(`${outdir}/theme-settings.json`, JSON.stringify(themeSettings, null, 2));
      const bundleZip = makeZip([
        { name: 'bundle.json', data: JSON.stringify({ name: config.theme.name, source: srcUrl, generated: 'design-capture', pages: builderPages.length }, null, 2) },
        { name: 'media.json', data: JSON.stringify(media, null, 2) },
        { name: 'theme-design.json', data: JSON.stringify(config, null, 2) },
        { name: 'theme-settings.json', data: JSON.stringify(themeSettings, null, 2) },
        { name: 'styleguide.json', data: JSON.stringify(styleguide, null, 2) },
        { name: 'presets.json', data: JSON.stringify(presets, null, 2) },
        { name: 'mapping.json', data: JSON.stringify(mapping, null, 2) },
        { name: 'pages.json', data: JSON.stringify(pages, null, 2) },
        { name: 'conversion-report.csv', data: report.csv },
        { name: 'conversion-report.html', data: report.html },
        { name: 'style-coverage.csv', data: styleReport.csv },
        { name: 'style-coverage.html', data: styleReport.html },
      ]);
      writeFileSync(`${outdir}/convert-bundle.zip`, bundleZip);
      step('saving full-page screenshot…');
      await page.goto(srcUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.screenshot({ path: `${outdir}/full.png`, fullPage: true }).catch(() => {});
    }

    console.log('  captured →', outdir);
    console.log('  ', `theme: heading=${config.fonts.heading || '?'} | body=${config.fonts.body || '?'} | accent=${config.colors.accent || '?'}`);
    console.log('  ', `report: ${report.stats.elements} elements | ${report.stats.fallbacks} code_block fallbacks | ${report.stats.opportunities} opportunities | ${report.stats.stylingDrops} styling-drops | ${report.stats.overLargeSections} over-large`);
    console.log('  ', `style-coverage: ${styleReport.stats.fidelityScore}% (carried/used across ${styleReport.stats.sections} sections)`);
    return report.stats;
  } finally {
    await page.close().catch(() => {});
  }
}

// --- Queue: run each URL sequentially in one Chrome -------------------------
console.log(`▶ capturing ${urls.length} site(s) → ${baseOutdir}/${REPORT_ONLY ? '  (--report-only)' : ''}`);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
for (let i = 0; i < urls.length; i++) {
  const u = urls[i];
  console.log(`\n========== [${i + 1}/${urls.length}] ${u} ==========`);
  try {
    const stats = await captureOne(browser, u, baseOutdir, REPORT_ONLY);
    results.push({ url: u, ok: true, stats });
  } catch (e) {
    const od = `${baseOutdir}/${siteSlug(u)}`;
    try { mkdirSync(od, { recursive: true }); writeFileSync(`${od}/error.txt`, `Capture failed for ${u}\n\n${(e && e.stack) || e}\n`); } catch { /* ignore */ }
    console.error(`  ✖ FAILED: ${(e && e.message) || e}  → wrote ${od}/error.txt`);
    results.push({ url: u, ok: false, err: (e && e.message) || String(e) });
  }
}
await browser.close();

const okCount = results.filter((r) => r.ok).length;
console.log(`\n========== queue done: ${okCount}/${results.length} ok ==========`);
for (const r of results) {
  console.log(r.ok
    ? `  ✓ ${r.url}  (${r.stats.elements} el, ${r.stats.fallbacks} fb, ${r.stats.opportunities} opp)`
    : `  ✖ ${r.url}  — ${r.err}`);
}
if (okCount < results.length) { process.exitCode = 1; }
