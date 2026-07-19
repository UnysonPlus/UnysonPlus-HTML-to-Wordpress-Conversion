# Sharing conversion reports upstream (opt-in)

The Site Converter gets smarter from real-world failures. Every capture already writes a
**conversion report** (`conversion-report.csv/html`) tracing each source element → the shortcode it
became, flagging `fallback` (code_block catch-alls), `opportunity`, `styling-drop`, and
over-large/under-segmented sections. This page explains how a developer can **optionally** send an
**anonymized** version of that report upstream so the whole community's converter improves.

## What is (and isn't) sent

`--share` sends a single **structural-only** JSON (`share-report.json`). It contains:

- **Kept:** element roles, detected/mapped shortcode, the `fallback`/`opportunity`/`styling-drop`
  flags, source tag names, **class tokens** (e.g. `py-32 grid min-h-screen` — arbitrary bracket
  values that could embed content are redacted to `[…]`), computed-style **property names**
  (border/shadow/…), section counts + heights, and the converter version.
- **Never sent:** the source **URL/host** (only a salted one-way **hash**, so the same site dedupes
  without being revealed), **content text**, **images**, **links/hrefs**, inline style *values*,
  screenshots, or anything resembling PII.

It is **opt-in and per-run**: nothing is built or sent unless you pass a flag.

```
node capture.mjs <url>                     # normal run — NOTHING shared
node capture.mjs <url> --share-preview     # ALSO writes share-report.json so you can INSPECT it (no send)
node capture.mjs <url> --share             # writes it AND submits it upstream (implies --share-preview)
```

Always get the **site owner's consent** before sharing a report for a site you built for a client.

## One-time setup — create the Google Form (maintainer)

The submission target is a normal Google Form backed by a Sheet, so there's **no server to host** and
**submitters need no Google account**.

1. Create a Google Form (e.g. "UnysonPlus Converter Reports"). Add **two** questions, both
   **"Paragraph"** (long answer) type:
   - **Q1 — "payload"** (the JSON). Make it **not required** to avoid validation edge cases.
   - **Q2 — "summary"** (a short human line). Also not required.
2. Link it to a Sheet (**Responses → Link to Sheets**) and turn on
   **Responses → ⋮ → Get email notifications for new responses** so `unysonplus@gmail.com` is pinged.
3. Get the **`responseUrl`** and the two **field entry ids**:
   - **responseUrl:** open the live form, **View source**, find the `<form action="…/formResponse">` —
     that action URL is your `responseUrl` (`https://docs.google.com/forms/d/e/<FORM_ID>/formResponse`;
     a `/u/0/` account-index segment is harmless, keep or drop it).
   - **entry ids (easiest — the pre-filled link, NOT view-source):** in the Form **editor**, top-right
     **⋮ (More) → "Get pre-filled link"**, type a recognizable dummy in each field (e.g. `PAYLOAD_HERE`
     in Q1, `SUMMARY_HERE` in Q2), click **"Get link" → "COPY LINK"**. The copied URL contains
     `…&entry.<number>=PAYLOAD_HERE&entry.<number>=SUMMARY_HERE` — the number before `=PAYLOAD_HERE` is
     the **payload** id, the one before `=SUMMARY_HERE` is **summary**.
4. Copy `share-config.example.json` → **`share-config.json`** (gitignored) and fill it in:

   ```json
   {
     "email": "unysonplus@gmail.com",
     "form": {
       "responseUrl": "https://docs.google.com/forms/d/e/<FORM_ID>/formResponse",
       "fields": { "payload": "entry.<Q1_ID>", "summary": "entry.<Q2_ID>" }
     }
   }
   ```

5. Test: `node capture.mjs <some-url> --share` → the console should print
   **"submitted upstream via Google Form ✓"** and a row should appear in the Sheet.

Distribute `share-config.json` to trusted contributors however you like (it holds only public form
ids, no secrets). Developers without it still get the **mailto:** fallback on `--share`.

## No form yet? The mailto fallback

Until `share-config.json` has a form, `--share` writes `share-report.json` and prints a **mailto:**
draft to `unysonplus@gmail.com`; the developer sends it from their **own** email and attaches the
JSON. (Never embed the Gmail password/app-password in the tool — the inbox only ever **receives**.)

## Future upgrade — a hosted endpoint

When real (PHP/Node) hosting is available, swap the Form for a small endpoint that lands in the same
inbox: point `form.responseUrl` at it (or add an `endpoint` field) — the tool-side change is trivial,
and the sanitizer/consent flow above is unchanged. GitHub Pages can't be it (static, can't receive a
POST).

## Maintainer side — turning reports into fixes (`aggregate-reports.mjs`)

The Sheet is the **append-only source of truth** — never edit or delete rows to "clear" them. Instead,
`aggregate-reports.mjs` reads the responses, **dedupes what it has already processed** (a local
content-fingerprint watermark — deletion-safe, no Sheet writes), and **ranks the systematic failures**
so you know what to fix next:

```
# Get the responses: in the Sheet, File → Download → Comma-separated values (.csv)
node aggregate-reports.mjs --csv responses.csv          # ranks only NEW reports since last --commit (dry run)
node aggregate-reports.mjs --csv responses.csv --all     # ignore the watermark; re-rank everything
node aggregate-reports.mjs --csv responses.csv --commit  # AFTER you've acted on the list: mark these processed
# (or --url "<published-csv-url>" if you File → Share → Publish to web → CSV instead of downloading)
```

It writes **`reports-todo.md`**: a table of recurring `(role · detected · srcTag · class-token)`
patterns that became a `fallback`/`opportunity`, ranked by **how many distinct sites** hit each one —
that ranking IS the converter's to-do. Work top-down; each fix removes a whole class of misses.

The loop: download CSV → `aggregate-reports.mjs` → pick the top pattern(s) → improve the converter
(mirror every change to **both** paths: JS `to-pages.mjs`/`capture-extract.mjs` AND PHP
`class-fw-site-converter-mapper.php`/`-stitch.php`, per the workspace `CLAUDE.md`) → `--commit` to mark
those reports processed so the next run only surfaces newer ones. No row is ever deleted; the watermark
(`.reports-watermark.json`, gitignored) is what advances.
