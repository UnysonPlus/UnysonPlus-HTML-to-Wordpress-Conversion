#!/usr/bin/env python
"""Build smartroute-bundle/pages.json from proven atom templates + SmartRoute content.

Clones the exact atom shapes captured from a real export (_atom-templates.json) so
the page-builder import never breaks on a shape mismatch; only content fields are
swapped. Output: { "pages": [ { title, slug, front_page, builder:[sections] } ] }.
"""
import json, copy, hashlib, os

ROOT = os.path.dirname(os.path.abspath(__file__))
TPL = json.load(open(os.path.join(ROOT, "smartroute-bundle", "_atom-templates.json"), encoding="utf-8"))

_uid_n = 0
def uid():
    global _uid_n
    _uid_n += 1
    return hashlib.md5(f"smartroute-atom-{_uid_n}".encode()).hexdigest()  # 32 hex, stable + unique

def atom(kind, **atts):
    node = copy.deepcopy(TPL[kind])
    node["_items"] = []
    node.setdefault("atts", {})
    for k, v in atts.items():
        node["atts"][k] = v
    node["atts"]["unique_id"] = uid()
    node["atts"]["css_class"] = atts.get("css_class", "")
    return node

def section(items, css_class="", **atts):
    n = atom("section", css_class=css_class, **atts)
    n["_items"] = items
    return n

def column(items, width="1_1", css_class=""):
    n = copy.deepcopy(TPL["column"])
    n["width"] = width
    n["atts"]["unique_id"] = uid()
    n["atts"]["css_class"] = css_class
    n["_items"] = items
    return n

def heading(title, overline="", subtitle="", tag="h2", alignment="left", css_class=""):
    return atom("special_heading", title=title, overline=overline, subtitle=subtitle,
                heading=tag, alignment=alignment, css_class=css_class)

def text(html, css_class=""):
    return atom("text_block", text=html, css_class=css_class)

def iconbox(title, content, svg, css_class=""):
    return atom("icon_box", title=title, content=f"<p>{content}</p>", custom_icon=svg,
                icon={"type": "none"}, title_tag="h3", style="stack-left", css_class=css_class)

# Inline button styles survive content sanitization (class-based did not).
_BTN_P = "display:inline-block;padding:.7rem 1.45rem;border-radius:999px;background:#994920;color:#fff;font-weight:600;text-decoration:none;font-size:.95rem"
_BTN_G = "display:inline-block;padding:.7rem 1.45rem;border-radius:999px;background:transparent;color:#34251f;border:1px solid #d2cdc5;font-weight:600;text-decoration:none;font-size:.95rem;margin-left:.5rem"

# --- simple inline icons (Feather-ish) ---
IC = {
 "route":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h6a4 4 0 0 0 4-4V9"/></svg>',
 "check":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
 "edit":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
 "chart":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/></svg>',
 "clock":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
}

CTA = (f'<p style="margin-top:1.6rem">'
       f'<a style="{_BTN_P}" href="#get-started">Explore the studio</a> '
       f'<a style="{_BTN_G}" href="#studio">Our story</a></p>')

builder = [
    # 1. Hero
    section([column([
        heading("Routing with a <em>Pulse.</em>", overline="Human-centric logic", tag="h1", css_class="sr-hero-h"),
        text("<p>Beyond scattered emails lies a heartbeat. We&rsquo;ve designed an operations studio that values "
             "every team member&rsquo;s time as much as the request&rsquo;s resolution.</p>", css_class="sr-lead"),
        text(CTA),
    ], width="1_1")], css_class="sr-hero"),

    # 2. Features intro
    section([column([
        heading("Everything your team needs", overline="SmartRoute studio", tag="h2", alignment="center", css_class="sr-center"),
        text("<p>From submission to resolution, SmartRoute replaces scattered emails and rigid spreadsheets with a "
             "calm, connected workflow.</p>", css_class="sr-lead sr-center"),
    ], width="1_1")], css_class="sr-features-intro"),

    # 3. Feature cards (5) — card styling lives on the column wrapper (.sr-card)
    section([
        column([iconbox("Smart routing", "Requests find the right approver automatically based on type, urgency, department, and workload &mdash; no manual triage needed.", IC["route"])], width="1_3", css_class="sr-card"),
        column([iconbox("Approval workflows", "Multi-stage approvals with conditions, delegation, and out-of-office coverage &mdash; nothing falls through the cracks.", IC["check"])], width="1_3", css_class="sr-card"),
        column([iconbox("Custom forms", "Dynamic fields adapt to each request type &mdash; no rigid templates, just the right questions.", IC["edit"])], width="1_3", css_class="sr-card"),
        column([iconbox("Real-time dashboard", "Live views of queue health, bottlenecks, and SLA countdowns across every department.", IC["chart"])], width="1_3", css_class="sr-card"),
        column([iconbox("Audit trail", "Every action timestamped and attributed &mdash; full transparency for compliance and review.", IC["clock"])], width="1_3", css_class="sr-card"),
    ], css_class="sr-cards"),

    # 4. Stats
    section([
        column([heading("4.2h", subtitle="Avg resolution time", tag="h2", alignment="center", css_class="sr-stat")], width="1_3"),
        column([heading("96%", subtitle="SLA compliance", tag="h2", alignment="center", css_class="sr-stat")], width="1_3"),
        column([heading("500+", subtitle="Teams onboarded", tag="h2", alignment="center", css_class="sr-stat")], width="1_3"),
    ], css_class="sr-stats"),

    # 5. Studio / CTA
    section([column([
        heading("Where precision meets artisan design.", overline="The studio", tag="h2", alignment="center", css_class="sr-center"),
        text('<p class="sr-center">SmartRoute is built like a workshop, not a dashboard &mdash; calm surfaces, warm '
             'detail, and logic you can feel.</p>', css_class="sr-lead sr-center"),
        text(f'<p style="text-align:center;margin-top:1.6rem"><a style="{_BTN_P}" href="#get-started">Get started</a></p>'),
    ], width="1_1")], css_class="sr-studio"),
]

out = {
    "pages": [{
        "title": "SmartRoute",
        "slug": "smartroute",
        "status": "publish",
        "front_page": True,
        "builder": builder,
    }]
}
open(os.path.join(ROOT, "smartroute-bundle", "pages.json"), "w", encoding="utf-8").write(json.dumps(out, indent=1))
print("wrote smartroute-bundle/pages.json:", len(builder), "sections,", _uid_n, "atoms")
