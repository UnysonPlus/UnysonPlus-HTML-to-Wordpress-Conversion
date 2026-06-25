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
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiReady, refineMapping } from './to-ai.mjs';

const PORT = Number(process.env.PORT) || 8787;
const CAPTURE = fileURLToPath(new URL('./capture.mjs', import.meta.url));
const VERSION = '1.1.0';

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

createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (u.pathname === '/health') {
    json(res, 200, { ok: true, service: 'unysonplus-design-capture', version: VERSION, aiReady: aiReady() });
    return;
  }

  // POST /ai-convert — refine a draft mapping with Claude (returns a better mapping + custom CSS).
  if (u.pathname === '/ai-convert') {
    if (req.method !== 'POST') { json(res, 405, { error: 'POST only.' }); return; }
    if (!aiReady()) { json(res, 503, { error: 'AI is off — set ANTHROPIC_API_KEY before starting the service.' }); return; }
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
  console.log(`UnysonPlus capture service → http://localhost:${PORT}`);
  console.log('  GET  /health');
  console.log('  GET  /capture?url=https://example.com  → convert-bundle.zip');
  console.log(`  POST /ai-convert  → AI refine  (AI ${aiReady() ? 'ON' : 'OFF — set ANTHROPIC_API_KEY to enable'})`);
});
