// MVP round-trip — Full Page builder-template generator (PayForItUK / zippy-praline).
// REBUILT to match the real production export (example-full-page-template-export.json) +
// the contract learnings §0.4 / §0.5:
//   • 10 bands = the source <main> sections (the dark "Staying in control" + footer are
//     theme CHROME, not page content — they live in up_footer / the theme, not here).
//   • Styling rides on GLOBAL CSS. Each SECTION gets a clean namespaced class (pfu-<name>) +
//     a css_id (#hero, #compare-methods, …) for builder identification / anchors; leaves keep
//     well-mapped component classes (section-sub, method-tile, trust-pillar, …). The CSS maps to
//     those (mapping > literal preservation). custom_css is left empty (real export uses it 0×).
//   • Data/interactive bands → code_block PLACEHOLDERS carrying the original markup, marked
//     "replace with [casino_finder] / [reviews_table]" — swap to the real shortcode once the
//     user builds it (contract §0.5). Decorative bands (badges, comparison table) → code_block.
//   • special_heading.title carries inline HTML. Section/column atts mirror the live 2.10.x shape.
//
// Run: node build-template.mjs  → writes full-page-template.json (kind:"full").

import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const uid = () => randomBytes(16).toString('hex');

// ---- shared sub-objects (verbatim from real export) -------------------------
const anim = () => ({ enable: 'no', yes: { effect: 'animate__fadeInUp', speed_preset: '', advanced_tweaks_heading: '', delay: 0, custom_duration: 0, repeat_count: 1, loop_forever: 'no', replay_on_scroll: 'no', easing: '' } });
const color = (predefined = '', custom = '') => ({ predefined, custom });
const spacing = () => ({ margin: { all: '', top: '', right: '', bottom: '', left: '' }, padding: { all: '', top: '', right: '', bottom: '', left: '' }, advanced: [] });
const bgImage = () => ({ type: 'custom', custom: '', predefined: '', data: { icon: '', css: [] } });
const backgroundPro = () => ({ color: { value: color() }, gradient: { data: { type: 'linear', angle: 90, stops: [] } }, image: { src: [], position: 'center center', size: { selected: 'cover', custom: '' }, repeat: 'no-repeat', attachment: 'scroll' }, video: { enabled: 'no', external_url: '', source_mp4: [], source_webm: [], poster: [], fallback: [], loop: 'yes', autoplay: 'yes', mute: 'yes', playsinline: 'yes' }, advanced: [] });
const commonKeys = (css_class = '', css_id = '') => ({ unique_id: uid(), css_id, css_class, custom_css: '', responsive_hide: [], custom_attrs: [], animation: anim() });

// ---- containers (full 2.10.x atts) ------------------------------------------
// Sections take a CLEAN namespaced class (pfu-*) the CSS maps to + a css_id for builder
// identification / anchor links (NOT verbatim source class names — mapping > preservation).
function section(css_class, css_id, items) {
  return { type: 'section', _items: items, atts: {
    variant: '', is_fullwidth: false, background_color: '', background_image: bgImage(), video: '',
    bleed_illustration: '', bleed_layout: { bleed_enabled: 'no', yes: { bleed_bg_color: '', bleed_image: '', bleed_image_position: 'center', bleed_image_side: 'right', bleed_image_ratio: '5-7', bleed_vertical_align: 'align-items-center', bleed_content_padding: '3rem', bleed_mobile_stacking: 'content-first' } },
    bg_color: color(), padding_top: '', padding_bottom: '', gap: '', gap_x: '', gap_y: '',
    min_height: { preset: 'auto', custom: { custom_height: { value: '', unit: 'px' } } }, content_valign: 'top', background: backgroundPro(),
    ...commonKeys(css_class, css_id),
  } };
}
function column(width, items, css_class = '') {
  return { type: 'column', width, _items: items, atts: {
    full_height: 'no', bg_color: color(), spacing: spacing(),
    mobile_order: '', w_phone: 'default', w_tablet: 'default', w_desktop: 'default', offset_phone: 'none', offset_tablet: 'none', offset_desktop: 'none',
    align_self: 'default', content_v: 'default', content_h: 'default', position: '', z_index: '', border_preset: '', inner_class: '',
    ...commonKeys(css_class),
  } };
}

// ---- leaves -----------------------------------------------------------------
function specialHeading(o = {}) {
  return { type: 'simple', shortcode: 'special_heading', _items: [], atts: {
    title: o.title || '', overline: o.overline || '', subtitle: o.subtitle || '', heading: o.heading || 'h2',
    alignment: o.alignment || 'left', overline_align: '', title_align: '', subtitle_align: '',
    overline_uppercase: o.overline_uppercase || 'no', overline_marker: o.overline_marker || '', overline_marker_position: 'before', overline_container: o.overline_container || '',
    element_spacing: '', block_max_width: { value: '', unit: 'px' }, display_size: o.display_size || '', subtitle_size: '', subtitle_max_width: { value: '', unit: 'rem' },
    bg_color: color(), overline_color: o.overline_color || color(), title_color: color(), subtitle_color: color(),
    spacing: spacing(), overline_class: '', title_class: '', subtitle_class: '',
    ...commonKeys(o.css_class || ''),
  } };
}
const textBlock = (html, css_class = '') => ({ type: 'simple', shortcode: 'text_block', _items: [], atts: { text: html, text_color: color(), bg_color: color(), font_size_preset: '', spacing: spacing(), ...commonKeys(css_class) } });
const codeBlock = (code, css_class = '') => ({ type: 'simple', shortcode: 'code_block', _items: [], atts: { code, text_color: color(), bg_color: color(), font_size_preset: '', spacing: spacing(), ...commonKeys(css_class) } });
function iconBox(o = {}) {
  return { type: 'simple', shortcode: 'icon_box', _items: [], atts: {
    icon: { type: 'none' }, custom_icon: o.svg || '', title: o.title || '', title_tag: o.title_tag || 'h4', content: o.content || '',
    style: o.style || 'top-title', icon_badge: 'none', icon_align: '', title_align: '', content_align: '', mobile_stack: true,
    box_link: o.box_link || '', link_target: false, link_rel: 'sponsored',
    bg_color: color(), font_size_preset: '', title_color: color(), content_color: color(), icon_color: color(), icon_badge_color: color(),
    spacing: spacing(), ...commonKeys(o.css_class || ''),
  } };
}
const divider = (css_class = '') => ({ type: 'simple', shortcode: 'divider', _items: [], atts: { ...commonKeys(css_class) } });
function accordion(tabs, css_class = '') {
  return { type: 'simple', shortcode: 'accordion', _items: [], atts: {
    tabs: tabs.map((t, i) => ({ tab_title: t.q, tab_content: `<p>${t.a}</p>`, is_open: i === 0 ? 'yes' : 'no' })),
    title_tag: 'h3', icon_style: 'plus-minus', icon_position: 'right', icon_closed_image: '', icon_open_image: '', icon_closed_text: '+', icon_open_text: '−',
    numbering: { style: 'q-prefix', custom: { template: 'Q{n}' } }, numbering_start: '1', item_spacing: '', title_alignment: 'left',
    initially_open: 'first', collapsible: 'yes', multiple_open: 'no', hash_linking: 'yes', show_expand_collapse_all: 'no',
    font_size_preset: '', tab_title_color: color(), title_bg_color: color(), tab_content_color: color(), content_bg_color: color(), icon_closed_color: color(), icon_open_color: color(),
    spacing: spacing(), ...commonKeys(css_class),
  } };
}
// PLACEHOLDER: a code_block standing in for a not-yet-created domain shortcode (contract §0.5).
const placeholder = (tag, attsHint, markup) => codeBlock(
  `<!-- TODO: replace this code_block with the [${tag}] shortcode once created. Suggested atts: ${attsHint}.\n     Markup below is carried from the source so it renders (styled by global.css) until then. -->\n${markup}`,
  `pfu-placeholder pfu-${tag.replace(/_/g, '-')}`
);

// ---- icon SVGs (lifted from source) -----------------------------------------
const SV = (inner, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const CHECK = SV('<path d="M20 6L9 17l-5-5"></path>', 3);
const ICON = {
  phone: SV('<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/>'),
  shield: SV('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  clock: SV('<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/>'),
  star: SV('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>'),
  file: SV('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>'),
  heart: SV('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
  apple: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>',
  bank: SV('<path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4"/>', 2.5),
  card: SV('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
  google: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>'),
  play: SV('<polygon points="5 3 19 12 5 21 5 3"/>'),
  wallet: SV('<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'),
  voucher: SV('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h2M12 15h5"/>'),
  arrow: SV('<path d="M5 12h14M12 5l7 7-7 7"/>', 2.5),
  boku: SV('<path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M7 8h10M7 12h10M7 16h6"/>'),
  msg: SV('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
};
const payRow = (svg, bg, fg, name, desc) => `<div class="what-pay-row"><div class="what-pay-left"><div class="what-pay-icon" style="background:${bg};color:${fg}">${svg}</div><div><div class="what-pay-name">${name}</div><div class="what-pay-count">${desc}</div></div></div><div class="what-pay-arrow">→</div></div>`;

// ============================================================================
const tree = [];

// 0) HERO — pfu-hero · 1_2 copy | 1_2 phone (code_block, no inline CSS — global .phone* styles it)
tree.push(section('pfu-hero', 'hero', [
  column('1_2', [
    specialHeading({ heading: 'h1', overline: 'UK casino payments specialists', overline_container: 'pill', overline_color: color('text-blue'), title: 'Find your UK casino, by <em>how you pay.</em>' }),
    textBlock('<p>PayForItUK is the only independent guide that ranks UKGC-licensed casinos by how their cashier actually performs — matched to the way you prefer to deposit and withdraw.</p>', 'hero-sub'),
    textBlock('Tested by <strong>our payments team</strong> · Independent reviews since 2014', 'tested-by'),
  ]),
  column('1_2', [
    codeBlock('<div class="hero-visual"><div class="phone" aria-hidden="true"><div class="phone-screen"><div class="phone-notch"></div><div class="phone-content"><div class="phone-app-header"><div class="phone-app-name">Casino Cashier</div><div class="phone-close">×</div></div><div class="phone-success"><div class="phone-check">' + CHECK + '</div><div class="phone-confirm-text">Deposit confirmed</div><div class="phone-confirm-sub">Funds available instantly</div><div class="phone-receipt"><div class="phone-receipt-row"><span class="phone-receipt-label">Amount</span><span class="phone-receipt-amount">£10.00</span></div><div class="phone-receipt-divider"></div><div class="phone-receipt-row"><span class="phone-receipt-label">To</span><span class="phone-receipt-value">MrQ Casino</span></div><div class="phone-receipt-row"><span class="phone-receipt-label">Method</span><span class="phone-receipt-value">Pay by Mobile</span></div></div></div></div></div></div>'),
  ]),
]));

// 1) MATCH ENGINE — pfu-match-section · placeholder for [casino_finder]
tree.push(section('pfu-match', 'match', [
  column('1_1', [
    textBlock('<div class="match-intro"><div class="match-intro-eyebrow"><span class="match-intro-eyebrow-dot"></span>Find your match</div><p class="match-intro-text">Answer four quick questions about <strong>how you pay</strong> — we’ll match you to the UK casino that fits best, with a clear reason why.</p></div>', 'match-intro-wrap'),
    placeholder('casino_finder', 'heading="Match me to a casino" subheading="Takes 30 seconds. No signup required."',
      '<div class="match-card" style="margin:0 auto"><div class="match-header"><div class="match-title-group"><div class="match-title">Match me to a casino</div><div class="match-sub">Takes 30 seconds. No signup required.</div></div></div><div class="match-questions"><div class="match-q-row"><div class="match-q-label"><div class="match-q-num">1</div><div class="match-q-text">Which payment method?</div></div><div class="match-options"><div class="match-option is-selected">Pay by Mobile</div><div class="match-option">Apple Pay</div><div class="match-option">PayPal</div><div class="match-option">Trustly</div></div></div></div><div class="match-footer"><button class="match-cta">Find my match →</button><span class="match-help">Your answers stay on this device.</span></div></div>'),
  ]),
]));

// 2) WHAT WE DO — pfu-what-section · 1_2 checklist | 1_2 pay-method stack
tree.push(section('pfu-what', 'what-we-do', [
  column('1_2', [
    specialHeading({ overline: 'What we do', title: 'The UK casino guide built around how you pay.' }),
    textBlock('<p>Every other UK casino site lists payment methods as an afterthought. We start there. You tell us how you want to deposit — and we match you to the UKGC-licensed casinos that actually optimise for it.</p>', 'section-sub'),
    iconBox({ svg: CHECK, style: 'stack-left', title: 'Match by payment method', content: '<p>Boku, Apple Pay, PayPal, Trustly and more, with editor-tested casino picks for each.</p>', css_class: 'pfu-what-check' }),
    iconBox({ svg: CHECK, style: 'stack-left', title: 'Tested cashier flows', content: '<p>Real deposits on iPhone and Android, SMS verification timed, withdrawal routes confirmed.</p>', css_class: 'pfu-what-check' }),
    iconBox({ svg: CHECK, style: 'stack-left', title: 'UKGC-licensed only', content: '<p>Every operator has a verified UK Gambling Commission licence. No grey-market sites, ever.</p>', css_class: 'pfu-what-check' }),
    iconBox({ svg: CHECK, style: 'stack-left', title: 'Independent rankings', content: '<p>Operators that fail our tests don’t appear here, regardless of commission.</p>', css_class: 'pfu-what-check' }),
  ]),
  column('1_2', [
    specialHeading({ overline: 'Find a casino by payment method', overline_uppercase: 'yes', title: 'Tap a method to see matched casinos', heading: 'h3' }),
    divider(),
    codeBlock(payRow(ICON.phone, '#185FA5', 'white', 'Pay by Mobile', 'Charge to your phone bill'), ''),
    codeBlock(payRow(ICON.apple, '#000', 'white', 'Apple Pay', 'Touch ID / Face ID deposits'), ''),
    codeBlock(payRow(ICON.apple, '#003087', 'white', 'PayPal', 'Privacy and dispute protection'), ''),
    codeBlock(payRow(ICON.bank, '#0EE06E', '#003319', 'Trustly', 'Instant bank transfers'), ''),
    codeBlock(payRow(ICON.card, '#1A1F36', 'white', 'Debit cards', 'Visa & Mastercard'), ''),
  ]),
]));

// 3) WHY TRUST US — pfu-trust-section · heading + 6× 1_3 icon_box
const pillars = [
  { svg: ICON.phone, title: 'Real deposit testing', content: 'Every operator is deposit-tested on iPhone and Android. SMS verification timed. Withdrawal routes confirmed before publication.' },
  { svg: ICON.shield, title: 'UKGC-licensed only', content: 'Zero offshore or grey-market operators. Every casino features a UKGC licence number, verified against the public register.' },
  { svg: ICON.clock, title: 'Transparent & current', content: 'All affiliate links disclosed. Operator scores re-tested regularly. Last test date shown on every review.' },
  { svg: ICON.star, title: 'Specialist expertise', content: 'Led by Thomas Jones, covering UK casino payments since 2014. Every review signed off by a named editor.' },
  { svg: ICON.file, title: 'Bonus terms verified', content: 'We read the small print. Wagering, minimum deposits, expiry dates and game weighting all checked.' },
  { svg: ICON.heart, title: 'Responsible gambling first', content: 'Every operator meets UKGC responsible-gambling standards. Self-exclusion, deposit limits and reality checks available.' },
];
tree.push(section('pfu-trust', 'why-trust-us', [
  column('1_1', [
    specialHeading({ overline: 'Why trust PayForItUK', title: 'Real testing. Real standards.' }),
    textBlock('<p>Our team deposit-tests every UK casino we feature. Operators that fail our checks don’t appear here.</p>', 'section-sub'),
  ]),
  ...pillars.map(p => column('1_3', [ iconBox({ svg: p.svg, title: p.title, content: `<p>${p.content}</p>`, css_class: 'trust-pillar' }) ])),
]));

// 4) TRUST STRIP — pfu-trust-strip · code_block (brand badge SVGs)
tree.push(section('pfu-trust-strip', 'aligned-with', [
  column('1_1', [ codeBlock('<div class="trust-strip-inner"><div class="trust-strip-label">Aligned with</div><div class="trust-strip-badges"><div class="trust-badge">UKGC Licensed Only</div><div class="trust-badge">Over 18s Only</div><div class="trust-badge">BeGambleAware</div><div class="trust-badge">GamCare</div><div class="trust-badge">GAMSTOP</div></div></div>') ]),
]));

// 5) OPERATOR LISTING — pfu-listing-section · placeholder for [reviews_table]
const opCard = (logoBg, name, headline, stars, on, meta) => `<article class="card-wrap"><div class="card-h">${name}</div><div class="card"><div class="card-row"><div class="card-logo" style="background:${logoBg}"><strong style="color:#fff">${name.split(' — ')[0]}</strong></div><div class="card-mid"><div class="card-headline">${headline}</div><div class="stars">${stars}</div><div class="badges">${on.map(o => `<span class="on">✓ ${o}</span>`).join('')}</div><div class="badges">${meta.map(m => `<span class="meta">${m}</span>`).join('')}</div></div><div class="card-right"><a class="cta" href="#">Claim offer</a><div class="ukgc">UKGC LICENSED</div><a class="review-link" href="#">Read review →</a></div></div></div></article>`;
tree.push(section('pfu-listing', 'editors-picks', [
  column('1_1', [
    specialHeading({ overline: 'Editor’s picks', title: 'Top UKGC-licensed UK casinos.' }),
    textBlock('<p>Tested by our team. Skip ahead with the match engine if you have a specific payment method in mind.</p>', 'section-sub'),
    placeholder('reviews_table', 'title="" category=[casinos] post_count="5"',
      opCard('#002b6b', 'MrQ — 30 free spins on £10 deposit', '30 free spins, no wagering', '★★★★★', ['Pay by Mobile', 'Boku', 'Apple Pay'], ['£10 min', 'Withdraw: bank transfer']) +
      opCard('#c01818', 'Mr Vegas — 11 free spins on first £10', '11 free spins on Big Bass Bonanza', '★★★★☆', ['Pay by Mobile', 'Boku', 'Apple Pay'], ['£10 min', 'Withdraw: debit card']) +
      '<a href="/casinos/" class="listing-more">View all UK casinos →</a>'),
  ]),
]));

// 6) COMPARISON TABLE — pfu-section-grey · code_block (gap G11: [table] shape is opaque)
tree.push(section('pfu-compare', 'compare-methods', [
  column('1_1', [
    specialHeading({ overline: 'Compare methods', title: 'UK casino payment methods, compared.' }),
    textBlock('<p>The trade-offs across the metrics that actually affect your deposit and withdrawal experience.</p>', 'section-sub'),
    codeBlock('<div class="table-wrap"><table class="cmp-table"><thead><tr><th>Method</th><th>Min deposit</th><th>Max deposit</th><th>Withdraw</th><th>Best for</th></tr></thead><tbody><tr><td>Pay by Mobile</td><td>£5</td><td>£30/day</td><td><span class="cmp-no">No</span></td><td>Casual play, spending controls</td></tr><tr><td>Apple / Google Pay</td><td>£10</td><td>Card limit</td><td><span class="cmp-yes">Yes</span></td><td>Quick deposits, biometric security</td></tr><tr><td>PayPal</td><td>£5</td><td>£10,000</td><td><span class="cmp-yes">Yes</span></td><td>Privacy, dispute protection</td></tr><tr><td>Trustly / Pay N Play</td><td>£10</td><td>No limit</td><td><span class="cmp-yes">Yes (instant)</span></td><td>Fast withdrawals, no signup</td></tr></tbody></table></div>'),
  ]),
]));

// 7) METHODS GRID — pfu-methods-section · heading + 12× 1_4 icon_box (.method-tile, linked)
const methods = [
  { svg: ICON.phone, name: 'Payforit', desc: 'Phone-bill deposits', href: '/casino-payments/payforit/' },
  { svg: ICON.boku, name: 'Boku', desc: 'Pay by mobile leader', href: '/casino-payments/boku/' },
  { svg: ICON.apple, name: 'Apple Pay', desc: 'Biometric deposits', href: '/casino-payments/apple-pay/' },
  { svg: ICON.google, name: 'Google Pay', desc: 'Android wallet', href: '/casino-payments/google-pay/' },
  { svg: ICON.apple, name: 'PayPal', desc: 'Private & protected', href: '/casino-payments/paypal/' },
  { svg: ICON.bank, name: 'Trustly', desc: 'Instant bank transfer', href: '/casino-payments/trustly/' },
  { svg: ICON.play, name: 'Pay N Play', desc: 'No-signup casinos', href: '/casino-payments/pay-n-play/' },
  { svg: ICON.wallet, name: 'Skrill', desc: 'E-wallet', href: '/casino-payments/skrill/' },
  { svg: ICON.card, name: 'Visa', desc: 'Debit cards', href: '/casino-payments/visa/' },
  { svg: ICON.card, name: 'Mastercard', desc: 'Debit cards', href: '/casino-payments/mastercard/' },
  { svg: ICON.voucher, name: 'Paysafecard', desc: 'Prepaid voucher', href: '/casino-payments/paysafecard/' },
  { svg: ICON.arrow, name: 'View all', desc: 'All methods', href: '/casino-payments/' },
];
tree.push(section('pfu-methods', 'all-methods', [
  column('1_1', [
    specialHeading({ overline: 'Browse all methods', title: 'Every UK casino payment method, reviewed.' }),
    textBlock('<p>Each method has a dedicated guide, ranked operator list, and tested deposit experience.</p>', 'section-sub'),
  ]),
  ...methods.map(m => column('1_4', [ iconBox({ svg: m.svg, title: m.name, title_tag: 'span', content: `<p>${m.desc}</p>`, style: 'stack-left', box_link: m.href, css_class: 'method-tile' }) ])),
]));

// 8) FAQ — pfu-faq-section · heading + accordion
const faqs = [
  { q: 'How do you choose which casinos to feature?', a: 'Our team deposit-tests every UKGC-licensed UK casino we cover. Operators that fail our payment-experience tests don’t make it onto the site, regardless of commission.' },
  { q: 'What does UKGC-licensed mean?', a: 'The UK Gambling Commission regulates every legal online casino in Britain. We don’t feature casinos without a current UKGC licence.' },
  { q: 'How does PayForItUK make money?', a: 'We earn commission when players sign up through our links — standard affiliate revenue, fully disclosed. Commission has no influence on our editorial.' },
  { q: 'How often do you re-test casinos?', a: 'Every operator gets re-tested regularly, with checks on welcome offers and bonus terms whenever they change. The "last tested" date appears on every review.' },
  { q: 'Why focus on payment methods?', a: 'Most UK casino sites list payment methods as a footnote. We start there — cashier differences matter enormously and nobody else covers them properly.' },
  { q: 'Can I trust your reviews?', a: 'Every review is signed off by our editorial team, led by Thomas Jones (covering UK casino payments since 2014). We follow a published editorial policy and disclose every commercial relationship.' },
];
tree.push(section('pfu-faq', 'faqs', [
  column('1_1', [
    specialHeading({ overline: 'FAQs', title: 'Common questions.' }),
    textBlock('<p>How we work, what we test, and why we do it this way.</p>', 'section-sub'),
    accordion(faqs),
  ]),
]));

// 9) TRUST FOOTER — pfu-trust-footer · 3× 1_3 linked icon_box (.trust-block)
const blocks = [
  { svg: ICON.file, title: 'How we test', content: 'The full methodology — every test we run on every operator before they appear here.', href: '/how-we-rate/' },
  { svg: ICON.file, title: 'Editorial policy', content: 'Independent. UKGC-only. Affiliate-disclosed. The rules we hold ourselves to.', href: '/editorial-policy/' },
  { svg: ICON.star, title: 'Meet the team', content: 'UK casino payments specialists with verified industry credentials.', href: '/authors/' },
];
tree.push(section('pfu-resources', 'resources', blocks.map(b => column('1_3', [ iconBox({ svg: b.svg, title: b.title, content: `<p>${b.content}</p>`, box_link: b.href, css_class: 'trust-block' }) ]))));

// ---- envelope + validate ----------------------------------------------------
const envelope = {
  _fw_template_export: { format_version: 2, kind: 'full', builder_type: 'page-builder', plugin_version: '2.10.24', exported_at: 1749513600 },
  title: 'PayForItUK — Homepage (round-trip)',
  json: JSON.stringify(tree),
  created: 1749513600,
};
const reparsed = JSON.parse(envelope.json);
if (!Array.isArray(reparsed) || reparsed.some(s => s.type !== 'section')) throw new Error('kind:full must decode to an array of section objects');
writeFileSync(new URL('./full-page-template.json', import.meta.url), JSON.stringify(envelope, null, 2));
const counts = {};
(function walk(items){for(const it of items||[]){const k=it.shortcode||it.type;counts[k]=(counts[k]||0)+1;walk(it._items);}})(reparsed);
console.log(`OK — ${reparsed.length} sections. items:`, counts);
