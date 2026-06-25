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
// Auth: the user's own Anthropic API key in ANTHROPIC_API_KEY (held here in the LOCAL companion, never
// in WordPress). No SDK dependency — a plain fetch to the Messages API. Model: ANTHROPIC_MODEL or a
// sensible default.

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_HTML = 90000; // cap the markup we send

/** Is the AI companion configured (an API key is present)? */
export function aiReady() {
  return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

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

/**
 * Refine a draft mapping with Claude.
 * @param {{ html:string, mapping:object, source?:string }} input
 * @returns {Promise<{ mapping:object, custom_css:string, model:string }>}
 */
export async function refineMapping({ html, mapping, source }) {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set — the AI companion is off.');
  if (!mapping || !Array.isArray(mapping.pages)) throw new Error('No draft mapping to refine.');

  const model = DEFAULT_MODEL;
  const markup = String(html || '').slice(0, MAX_HTML);
  const user =
    `Source builder: ${source || 'unknown'}\n\n` +
    `=== ORIGINAL HTML (truncated) ===\n${markup}\n\n` +
    `=== DRAFT MAPPING (JSON) ===\n${JSON.stringify(mapping)}\n\n` +
    `Return the improved { "mapping", "custom_css" } JSON object now.`;

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Anthropic API ${resp.status}: ${t.slice(0, 400)}`);
  }
  const data = await resp.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();

  const parsed = extractJson(text);
  if (!parsed || !parsed.mapping || !Array.isArray(parsed.mapping.pages)) {
    throw new Error('The AI response did not contain a valid mapping.');
  }
  return {
    mapping: parsed.mapping,
    custom_css: typeof parsed.custom_css === 'string' ? parsed.custom_css : '',
    model,
  };
}

/** Pull the first balanced JSON object out of a model response (tolerates stray prose / fences). */
function extractJson(text) {
  if (!text) return null;
  let s = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
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
