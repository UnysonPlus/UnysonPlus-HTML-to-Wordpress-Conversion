// AI refinement for the Site Converter (the optional "AI companion").
//
// The WordPress plugin deterministically parses an export into a draft MAPPING (sections → elements
// with roles). This module hands that draft + the original markup to Claude and gets back:
//   1. a refined mapping (corrected roles, dropped chrome/decorative blocks), and
//   2. a global `custom_css` that styles the rebuilt shortcode markup to match the original's look.
//
// The plugin then builds the WordPress page from the refined mapping (its own engine produces the
// correct page-builder nodes) and folds the CSS into the generated child theme. So the AI works at the
// MAPPING + CSS level — never hand-writing fragile page-builder JSON.
//
// TWO backends (auto-detected — both run LOCALLY; nothing about your site leaves your machine):
//   • "api"         — calls the Anthropic API with your ANTHROPIC_API_KEY (pay-per-use, billed by the
//                     Anthropic Console — separate from a Claude.ai subscription).
//   • "claude-code" — shells out to your installed **Claude Code** CLI (`claude`), which uses your
//                     Claude SUBSCRIPTION. No API key, no extra billing.
// Pick order: AI_BACKEND env override → ANTHROPIC_API_KEY (api) → `claude` on PATH (claude-code) → off.

import { spawn, spawnSync } from 'node:child_process';

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_HTML = 90000; // cap the markup we send
const IS_WIN = process.platform === 'win32';

const ROLES = ['overline', 'title', 'subtitle', 'heading', 'text', 'button', 'image', 'columns', 'code', 'skip'];

const SYSTEM = `You convert an AI-built landing page into a clean, on-brand UnysonPlus WordPress page.
You are given (a) the original page's HTML and (b) a DRAFT mapping the converter produced: an ordered
tree of pages → sections → blocks, where each block has a "role". Your job is to RETURN AN IMPROVED
mapping plus one stylesheet — nothing else.

Rules for the mapping:
- Keep the same JSON shape: { "pages":[ { "title","slug","front_page","sections":[ { "css_id","omit":false,"blocks":[ { "t","role", ... } ] } ] } ] }.
- Roles you may use: ${ROLES.join(', ')}. Meaning: overline = small eyebrow label; title = the section's main heading (h1/h2); subtitle = a short line under a title; heading = a sub-heading; text = a paragraph (text block); button = a call-to-action; image = a real <img>; columns = a row of cards (keep its "cols"); code = keep verbatim; skip = drop this block.
- Fix mis-detected roles. Drop pure chrome/decorative blocks (nav links, marquees, fake UI mockups, gradient-only divs) by setting their role to "skip" or omitting the section.
- Keep block "text"/"html"/"label"/"cols" values intact — only change "role" (and you MAY set a section's "omit":true, or improve a section's "css_id" to a short semantic slug).
- Do NOT invent new blocks or new sections. Preserve order.

Rules for the CSS (the fidelity win):
- Return a single "custom_css" string that makes the rebuilt page look like the original: the palette,
  type scale, spacing, hero centering, card styling, button look.
- EVERY selector MUST be scoped to "body:not(.wp-admin)" (the stylesheet also loads in wp-admin otherwise).
- Target the rebuilt shortcode markup, NOT the original's Tailwind classes:
  • headings → .special-heading__title / .special-heading__overline / .special-heading__subtitle (and h1–h4)
  • paragraph → .text-block
  • button → .btn
  • feature/bento card → .icon-box / .icon-box__title / .icon-box__content / .icon-box__icon i
  • a row of cards → .fw-row / [class*="fw-col-"]
  • images → img
  • a specific section → its "#<css_id>" (each section renders with id="<css_id>")
- Use real hex colors and px/rem values pulled from the original. Center hero/CTA sections. Keep it clean.

OUTPUT: a single JSON object only, no markdown fences, no commentary:
{ "mapping": { ...the improved mapping... }, "custom_css": "body:not(.wp-admin){...} ..." }`;

/* ---------------------------------------------------------------------- *
 * Backend detection
 * ---------------------------------------------------------------------- */

let _cliChecked = false;
let _cliCmd = false; // false = not found, string = the command to run

/** Is the Claude Code CLI installed? (cached; checked once with `claude --version`.) */
function claudeCliAvailable() {
  if (_cliChecked) return _cliCmd !== false;
  _cliChecked = true;
  const cmd = process.env.CLAUDE_CLI || 'claude';
  try {
    // On Windows `claude` is a .cmd shim, so it needs a shell; pass a quoted command STRING (not an
    // args array) to avoid the Node shell+args deprecation warning. On POSIX, spawn it directly.
    const r = IS_WIN
      ? spawnSync(`"${cmd}" --version`, { shell: true, timeout: 12000, encoding: 'utf8' })
      : spawnSync(cmd, ['--version'], { timeout: 12000, encoding: 'utf8' });
    _cliCmd = r.status === 0 ? cmd : false;
  } catch {
    _cliCmd = false;
  }
  return _cliCmd !== false;
}

/** Which backend will run: 'api' | 'claude-code' | null. */
export function aiBackend() {
  const forced = (process.env.AI_BACKEND || '').toLowerCase().replace(/[_\s]/g, '-');
  if (forced === 'api') return (process.env.ANTHROPIC_API_KEY || '').trim() ? 'api' : null;
  if (forced === 'claude-code' || forced === 'cli') return claudeCliAvailable() ? 'claude-code' : null;
  if ((process.env.ANTHROPIC_API_KEY || '').trim()) return 'api';
  if (claudeCliAvailable()) return 'claude-code';
  return null;
}

/** Is any AI backend available? */
export function aiReady() {
  return aiBackend() !== null;
}

/* ---------------------------------------------------------------------- *
 * Refinement
 * ---------------------------------------------------------------------- */

/** Build the user-turn content (shared by both backends). */
function buildUser({ html, mapping, source }) {
  const markup = String(html || '').slice(0, MAX_HTML);
  return (
    `Source builder: ${source || 'unknown'}\n\n` +
    `=== ORIGINAL HTML (truncated) ===\n${markup}\n\n` +
    `=== DRAFT MAPPING (JSON) ===\n${JSON.stringify(mapping)}\n\n` +
    `Return the improved { "mapping", "custom_css" } JSON object now.`
  );
}

/**
 * Refine a draft mapping with whichever backend is available.
 * @param {{ html:string, mapping:object, source?:string }} input
 * @returns {Promise<{ mapping:object, custom_css:string, model:string, backend:string }>}
 */
export async function refineMapping(input) {
  if (!input || !input.mapping || !Array.isArray(input.mapping.pages)) {
    throw new Error('No draft mapping to refine.');
  }
  const backend = aiBackend();
  if (backend === 'api') return refineViaApi(input);
  if (backend === 'claude-code') return refineViaClaudeCode(input);
  throw new Error('AI is off — set ANTHROPIC_API_KEY, or install Claude Code (`claude`) and sign in.');
}

/** Backend 1: the Anthropic API (pay-per-use). */
async function refineViaApi({ html, mapping, source }) {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  const model = DEFAULT_MODEL;
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 16000, system: SYSTEM, messages: [{ role: 'user', content: buildUser({ html, mapping, source }) }] }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Anthropic API ${resp.status}: ${t.slice(0, 400)}`);
  }
  const data = await resp.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();
  return finishParse(text, model, 'api');
}

/**
 * Backend 2: the Claude Code CLI (uses the user's subscription). Runs `claude -p --output-format json`
 * with the full prompt on stdin; the CLI must be installed and signed in (`claude` once, interactively).
 */
async function refineViaClaudeCode({ html, mapping, source }) {
  const cmd = process.env.CLAUDE_CLI || 'claude';
  const prompt = SYSTEM + '\n\n' + buildUser({ html, mapping, source });
  const args = ['-p', '--output-format', 'json', '--max-turns', '1'];
  const model = (process.env.ANTHROPIC_MODEL || '').replace(/[^a-zA-Z0-9._-]/g, ''); // sanitize (shell arg)
  if (model) { args.push('--model', model); }

  const stdout = await runClaude(cmd, args, prompt);
  // `--output-format json` wraps the answer: { type, subtype, result, is_error, ... }. Pull `.result`.
  let text = stdout.trim();
  try {
    const j = JSON.parse(stdout);
    if (j && j.is_error) { throw new Error('Claude Code reported an error: ' + String(j.result || j.subtype || '').slice(0, 300)); }
    if (j && typeof j.result === 'string') { text = j.result; }
  } catch (e) {
    if (e.message && e.message.startsWith('Claude Code reported')) throw e; // real error, not a parse miss
    // else: not JSON-wrapped (older CLI / text mode) — use stdout as-is.
  }
  return finishParse(text, process.env.ANTHROPIC_MODEL || 'claude-code', 'claude-code');
}

/** Spawn the Claude Code CLI, feed the prompt on stdin, resolve its stdout. */
function runClaude(cmd, args, input) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      // Windows: quoted command STRING under a shell (resolves the .cmd shim, no deprecation warning).
      // POSIX: spawn the binary directly with the args array.
      child = IS_WIN
        ? spawn(`"${cmd}" ${args.join(' ')}`, { shell: true })
        : spawn(cmd, args, { shell: false });
    } catch (e) {
      reject(new Error('Could not run Claude Code (`claude`): ' + e.message));
      return;
    }
    let out = '';
    let err = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {} reject(new Error('Claude Code timed out (over 3 minutes).')); }, 180000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error('Could not run Claude Code (`claude`): ' + e.message + ' — is it installed and on PATH?')); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) { resolve(out); }
      else { reject(new Error('Claude Code exited (' + code + '). ' + (err || out).slice(0, 400) + ' — make sure you have run `claude` once to sign in.')); }
    });
    try { child.stdin.write(input); child.stdin.end(); } catch (e) { /* close handler reports */ }
  });
}

/** Parse the model's text into the { mapping, custom_css } result. */
function finishParse(text, model, backend) {
  const parsed = extractJson(text);
  if (!parsed || !parsed.mapping || !Array.isArray(parsed.mapping.pages)) {
    throw new Error('The AI response did not contain a valid mapping.');
  }
  return {
    mapping: parsed.mapping,
    custom_css: typeof parsed.custom_css === 'string' ? parsed.custom_css : '',
    model,
    backend,
  };
}

/** Pull the first balanced JSON object out of a model response (tolerates stray prose / fences). */
function extractJson(text) {
  if (!text) return null;
  let s = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (ch === '\\') { esc = true; }
      else if (ch === '"') { inStr = false; }
      continue;
    }
    if (ch === '"') { inStr = true; }
    else if (ch === '{') { depth++; }
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}
