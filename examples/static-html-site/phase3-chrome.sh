#!/usr/bin/env bash
# Phase 3 — global chrome (header nav + footer links) for the PayForItUK round-trip.
#
# The theme renders its header from the `header_layout` theme setting (default = logo +
# the `primary` menu location, in #masthead) and its footer copyright bar from the `footer`
# menu location (#colophon). So the cleanest, lowest-risk way to make the chrome match the
# AI site is to populate those two WordPress menus + the site title — NOT to hand-author the
# opaque header_layout/up_header builder shapes (which need a reference export to do safely).
#
# Run on the target site (WP Engine supports WP-CLI):  bash phase3-chrome.sh
# Or do the same by hand in Appearance → Menus (assign to "Primary menu" / "Footer menu").
# The header/footer VISUAL match (sticky blurred topbar, footer type) is handled by the
# chrome bridge in theme-settings-design.json (#masthead / .primary-menu / #colophon).

set -e
WP="wp"   # adjust if wp-cli needs a path / --path=...

echo "→ Site title"
$WP option update blogname "PayForItUK"
$WP option update blogdescription "Find UK Casinos by Payment Method"

echo "→ Primary menu (header nav)"
$WP menu create "Primary" 2>/dev/null || true
$WP menu item add-custom Primary "Casinos"          "/casinos/"
$WP menu item add-custom Primary "Payment methods"  "/casino-payments/"
$WP menu item add-custom Primary "Reviews"          "/reviews/"
$WP menu item add-custom Primary "Guides"           "/guides/"
$WP menu location assign Primary primary

echo "→ Footer menu (footer links)"
$WP menu create "Footer" 2>/dev/null || true
$WP menu item add-custom Footer "About"                 "/about/"
$WP menu item add-custom Footer "Editorial policy"      "/editorial-policy/"
$WP menu item add-custom Footer "Authors"               "/authors/"
$WP menu item add-custom Footer "Affiliate disclosure"  "/affiliate-disclosure/"
$WP menu item add-custom Footer "Responsible gambling"  "/responsible-gambling/"
$WP menu item add-custom Footer "Privacy"               "/privacy/"
$WP menu item add-custom Footer "Cookies"               "/cookies/"
$WP menu item add-custom Footer "Terms"                 "/terms/"
$WP menu item add-custom Footer "Contact"               "/contact/"
$WP menu location assign Footer footer

echo "✓ Chrome populated. Set copyright text in Theme Settings → Footer if desired:"
echo "  © 2026 PayForItUK. 18+. Gambling can be addictive — please play responsibly."
