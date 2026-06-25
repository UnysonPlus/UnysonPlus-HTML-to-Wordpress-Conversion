# Conversion analysis — Continuum (continuum-daily.lovable.app)

> Step 1 of the AI-site → WordPress conversion (per
> [the conversion contract](../../conversion-contract.md)). Source is a **Lovable
> React SPA**, so this was captured by **rendering it headless** (`source/rendered.html` +
> `screenshot.png`) — the static HTML is just a shell.

## What it is
A calm **habit-tracker landing page** ("Continuum"). Warm neutral palette + a single **amber
accent**, photographic hero, **Plus Jakarta Sans**.

## Design system (→ child-theme CSS / presets)
- **Font:** Plus Jakarta Sans (Google Fonts, 400–700).
- **Tokens:** Tailwind / shadcn — utility classes (`bg-background`, `text-foreground`, `bg-primary`,
  `text-4xl`, `grid`, …) with the theme variables (`--background`, `--foreground`, `--primary` = the
  amber, `--muted`, `--card`, radius) compiled into **`/assets/styles-DxZKUGS-.css`**.
- **Conversion note — this is a *utility-class* site** (unlike PayForItUK's semantic classes). Two
  options (contract §0.4): **(a)** carry the compiled Tailwind CSS into a child theme and keep the
  utility classes on the builder items (high fidelity, heavier), or **(b)** map to UnysonPlus
  primitives + Styling Presets + a small bridge (more editable). For a faithful round-trip, **(a)**
  is the pragmatic path; the section *structure* still maps to primitives below.

## Sections (→ Full Page template, contract §2)
| # | Section | Maps to | Notes |
|---|---|---|---|
| 0 | **Header** | `up_header` / theme menu | "∞ Continuum" + nav (Features / How it works / Reviews — anchor links) + dark "Get started" pill |
| 1 | **Hero** | `section` + background-pro **image** + `special_heading`(white) + `button` | full-bleed photo bg w/ dark overlay; amber "Get started free" CTA |
| 2 | **Features** | `special_heading` + a daily-ritual **card** (`code_block`) + **6× `icon_box`** (2-col) | Streak tracking / Calendar heatmap / Smart insights / Gentle reminders / Dark mode / Cloud sync |
| 3 | **How it works** | `special_heading` + **3× `icon_box`** (numbered steps) | Create your habits / Tap to complete / Watch your growth |
| 4 | **Reviews** | `special_heading` + `testimonials` (or `code_block`) | testimonial cards w/ **avatar images** |
| 5 | **CTA** | `section` (dark/photo) + `special_heading`(white) + `button` | "Ready to build better habits?" |
| 6 | **Footer** | `up_footer` / theme footer | links + copyright |

The eyebrow→heading→subtitle pattern recurs (`FEATURES` → "Everything you need…") → `special_heading`,
exactly as in the PayForItUK round-trip.

## Images (→ Site Converter, the media phase)
**This site uses real photos** (unlike PayForItUK's inline SVG), so the Site Converter extension
does the work here:
- 4 **testimonial avatars** — `trovdwfeqyzlxzrtfbjv.supabase.co/storage/.../avatar-*.jpg` (in `<img>`).
- 1 **OG/social image** — `storage.googleapis.com/.../continuum.webp` (meta tag).
- The **hero photo** + decorative `/assets/shadow-bg-*.jpg` — referenced via the **JS bundle / CSS**,
  not `<img>` — so the Convert tool's **"mine the JS bundle" + embedded-HTML scan** (v1.0.1–1.0.3)
  is exactly what surfaces them. Good validation of that feature.

## Conversion plan (tokens-first, contract §0.3)
1. ✅ **Capture & analyze** (this file) — done.
2. **Images** → Unyson+ → **Convert** → scan `https://continuum-daily.lovable.app/` (deep scan on)
   → preview → import the hero + avatars. *(Our new tool; can run anytime since assets are independent.)*
3. **Design system** → a **`continuum-test`** child theme (carry `/assets/styles-*.css` + enqueue
   Plus Jakarta Sans), scoped to `.entry-content` (contract §0.4 / G12).
4. **Page body** → a `kind:"full"` Full Page template (the sections above), referencing the imported
   images + token classes.
5. **Chrome** → header nav (anchor links to the section `css_id`s) + footer + menus (contract §3.3).
