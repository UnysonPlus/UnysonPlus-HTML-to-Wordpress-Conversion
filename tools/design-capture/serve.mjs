#!/usr/bin/env node
// Local capture service for the Site Converter's "Site Analyzer".
//
// Renders a URL in headless Chrome (by running capture.mjs) and returns a ready
// Convert bundle .zip, so the WordPress admin page can convert a site by URL in one
// click. The WP admin page runs in YOUR browser on YOUR machine, so it can reach this
// localhost service even though the (remote) WP server cannot — no hosting needed.
//
//   npm install         # once (playwright-core)
//   node serve.mjs      # listens on http://localhost:8787
//   PORT=9000 node serve.mjs
//
// Endpoints (CORS-open + Private-Network-Access friendly, so an https WP admin page
// can fetch from http://localhost):
//   GET  /health             → { ok, service, version, aiReady }
//   GET  /capture?url=<url>   → convert-bundle.zip (application/zip)
//   POST /ai-convert          → { ok, mapping, custom_css }  (refine a draft mapping with Claude)
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiReady, aiBackend, refineMapping } from './to-ai.mjs';

const PORT = Number(process.env.PORT) || 8787;
const SELF_DIR = fileURLToPath(new URL('.', import.meta.url));
const CAPTURE = fileURLToPath(new URL('./capture.mjs', import.meta.url));
const IS_WIN = process.platform === 'win32';
// Version = the single source of truth in package.json (no hard-coded duplicate to drift).
const VERSION = (() => { try { return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; } })();

/* ----------------------------------------------------------------------------
 * Update check — compare this copy against the package.json on GitHub.
 * Offline-safe: any failure leaves `latestVersion` null and is ignored, so a
 * localhost/offline user is never blocked. (Notify only — does NOT auto-update
 * unless AUTO_UPDATE=1; see maybeAutoUpdate.)
 * -------------------------------------------------------------------------- */
const RAW_PKG = 'https://raw.githubusercontent.com/UnysonPlus/UnysonPlus-HTML-to-Wordpress-Conversion/master/tools/design-capture/package.json';
let latestVersion = null;          // newest version seen on GitHub (null = unknown/offline)
let lastChecked = 0;
const CHECK_TTL = 60 * 60 * 1000;  // re-check at most hourly

function semverGt(a, b) {
  const pa = String(a || '').split('.').map(Number), pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y; }
  return false;
}
function updateAvailable() { return latestVersion ? semverGt(latestVersion, VERSION) : false; }
async function checkLatest(force) {
  if (!force && Date.now() - lastChecked < CHECK_TTL) return latestVersion;
  lastChecked = Date.now();
  try {
    const signal = AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined;
    const r = await fetch(RAW_PKG, { signal, headers: { 'cache-control': 'no-cache' } });
    if (r.ok) { const j = await r.json(); if (j && j.version) { latestVersion = j.version; } }
  } catch { /* offline / blocked — keep the last known value */ }
  return latestVersion;
}

/* Opt-in self-update: AUTO_UPDATE=1 → `git pull --ff-only` + `npm install`, then re-exec a fresh
 * process. Skips silently if there's no git, no internet, or it isn't a clone. Default = OFF (notify). */
function maybeAutoUpdate() {
  if (!/^(1|true|yes|on)$/i.test(process.env.AUTO_UPDATE || '')) return false;
  try {
    const pull = spawnSync('git', ['pull', '--ff-only'], { cwd: SELF_DIR, encoding: 'utf8', timeout: 30000 });
    const out = (pull.stdout || '') + (pull.stderr || '');
    if (pull.status === 0 && /Fast-forward|Updating /.test(out)) {
      console.log('[update] new version pulled — reinstalling deps + restarting…');
      spawnSync(IS_WIN ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: SELF_DIR, stdio: 'inherit', timeout: 180000 });
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, AUTO_UPDATE: '0' } });
      child.on('exit', (c) => process.exit(c == null ? 0 : c));
      return true; // re-exec'd into a fresh process
    }
  } catch { /* no git / offline / not a clone — skip */ }
  return false;
}

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true'); // Chrome PNA preflight
};

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

/** Read + JSON-parse a request body (capped). */
const readJson = (req, cap = 8 * 1024 * 1024) => new Promise((resolve, reject) => {
  let buf = '', n = 0;
  req.on('data', (c) => { n += c.length; if (n > cap) { reject(new Error('Body too large.')); req.destroy(); return; } buf += c; });
  req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(new Error('Invalid JSON body.')); } });
  req.on('error', reject);
});

if (maybeAutoUpdate()) {
  // Updated and re-exec'd into a fresh process — leave this one idle until the child exits.
} else {
createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (u.pathname === '/health') {
    checkLatest(false); // background refresh (cached, hourly); never blocks the response
    json(res, 200, { ok: true, service: 'unysonplus-design-capture', version: VERSION, latest: latestVersion, updateAvailable: updateAvailable(), aiReady: aiReady(), aiBackend: aiBackend() });
    return;
  }

  // POST /ai-convert — refine a draft mapping with Claude (returns a better mapping + custom CSS).
  if (u.pathname === '/ai-convert') {
    if (req.method !== 'POST') { json(res, 405, { error: 'POST only.' }); return; }
    if (!aiReady()) { json(res, 503, { error: 'AI is off — set ANTHROPIC_API_KEY, or install Claude Code (claude) and sign in, then restart.' }); return; }
    readJson(req)
      .then((body) => refineMapping({ html: body.html, mapping: body.mapping, source: body.source }))
      .then((out) => { console.log('[ai-convert] refined via', out.model); json(res, 200, { ok: true, mapping: out.mapping, custom_css: out.custom_css, model: out.model }); })
      .catch((e) => { console.error('[ai-convert]', e.message); json(res, 500, { error: e.message }); });
    return;
  }

  if (u.pathname === '/capture') {
    const target = (u.searchParams.get('url') || '').trim();
    if (!/^https?:\/\//i.test(target)) { json(res, 400, { error: 'Provide a valid http(s) URL.' }); return; }

    const out = mkdtempSync(join(tmpdir(), 'sc-capture-'));
    console.log('[capture]', target);
    const child = spawn(process.execPath, [CAPTURE, target, out], { stdio: 'inherit' });

    child.on('error', (e) => { json(res, 500, { error: e.message }); rmSync(out, { recursive: true, force: true }); });
    child.on('exit', () => {
      const zipPath = join(out, 'convert-bundle.zip');
      if (existsSync(zipPath)) {
        const zip = readFileSync(zipPath);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="convert-bundle.zip"',
          'Content-Length': zip.length,
        });
        res.end(zip);
      } else {
        json(res, 500, { error: 'Capture produced no bundle (the page may have failed to render).' });
      }
      rmSync(out, { recursive: true, force: true });
    });
    return;
  }

  json(res, 404, { error: 'not found' });
}).listen(PORT, () => {
  console.log(`UnysonPlus capture service v${VERSION} → http://localhost:${PORT}`);
  console.log('  GET  /health');
  console.log('  GET  /capture?url=https://example.com  → convert-bundle.zip');
  const be = aiBackend();
  console.log('  POST /ai-convert  → AI refine  (' + ( be === 'api' ? 'AI ON — Anthropic API key' : be === 'claude-code' ? 'AI ON — Claude Code subscription' : 'AI OFF — set ANTHROPIC_API_KEY, or install + sign in to Claude Code' ) + ')');
  // One-time update check on startup (offline-safe); print a hint if a newer version is on GitHub.
  checkLatest(true).then(() => {
    if (updateAvailable()) { console.log(`  ⬆ Update available: v${latestVersion} (you have v${VERSION}). Run:  git pull && npm install`); }
  });
});
}
