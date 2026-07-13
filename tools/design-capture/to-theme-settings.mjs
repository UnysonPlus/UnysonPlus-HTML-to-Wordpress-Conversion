// Chrome → parent-theme Theme Settings (`theme-settings.json`) — the URL-path MIRROR of the PHP
// FW_Site_Converter_Stitch::tokens_to_theme_settings_chrome(). The playbook's "chrome = theme,
// not page content" model: emit the source header/footer as native Header/Footer Theme-Settings
// values so the converted site runs on a NEAR-EMPTY child theme (Template: unysonplus-theme, no
// header.php/footer.php) instead of a baked one.
//
// The plugin's FW_Site_Converter_Theme_Settings::import() writes each id via
// fw_set_db_settings_option (overlay). Value shapes mirror the gold reference
// (unysonplus-website/wordpress/demos/anime-header-footer.php) EXACTLY:
//   header_logo   = { site_title, title_weight, color:{predefined,custom}, tagline,
//                     logo_icon:{type,svg-source,svg-id}, logo_icon_position, logo_icon_color }
//   header_main   = { main_left|center|right:[ element_type nodes ] }
//   header_menu   = { menu_link_color, menu_link_hover_color }
//   header_layout = { header_mode, header_behavior, header_glass, bg_color, … }
//   footer_background = background-pro { color:{ value:{predefined,custom} } }   (NOT compact color)
//   copyright_settings = { enabled, yes:{ copyright_columns:{ count:'1', '1':{ copyright_col_1 } } } }
//
// KEEP IN SYNC with the PHP emitter (see CONVERSION-ALGORITHM-SYNC.md).

const hex = (h) => ({ predefined: '', custom: String(h || '') });
const el = (type, settings) => {
  const et = { element: type };
  if (settings && typeof settings === 'object') et[type] = settings;
  return { element_type: et };
};

// A social URL host → Lucide icon id (mirror of the PHP social_lucide()). '' if not a known network.
function socialLucide(url) {
  let host = '';
  try { host = new URL(url).host.toLowerCase(); } catch { host = ''; }
  const map = {
    twitter: 'lucide/twitter', 'x.com': 'lucide/twitter', facebook: 'lucide/facebook',
    instagram: 'lucide/instagram', linkedin: 'lucide/linkedin', youtube: 'lucide/youtube',
    github: 'lucide/github', discord: 'lucide/message-circle', dribbble: 'lucide/dribbble',
    twitch: 'lucide/twitch', tiktok: 'lucide/music', pinterest: 'lucide/image',
    telegram: 'lucide/send', 't.me': 'lucide/send', whatsapp: 'lucide/message-circle',
    slack: 'lucide/slack', mastodon: 'lucide/at-sign',
  };
  for (const needle in map) { if (host && host.includes(needle)) return map[needle]; }
  return '';
}
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Is a CSS color string a dark fill? (hex or rgb/rgba). Conservative: unknown → false.
function isDark(c) {
  c = String(c || '').trim();
  let r, g, b;
  let m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) { r = parseInt(m[1][0] + m[1][0], 16); g = parseInt(m[1][1] + m[1][1], 16); b = parseInt(m[1][2] + m[1][2], 16); }
  else if ((m = c.match(/^#([0-9a-f]{6})$/i))) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
  else if ((m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i))) { r = +m[1]; g = +m[2]; b = +m[3]; }
  else return false;
  // Relative luminance; < 0.4 reads as dark.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.4;
}

/**
 * @param {object} config the toDesignConfig() output (header/footer/colors)
 * @param {object} home   the home capture (home.header.logo.text/.icon, home.footer.copyright)
 * @returns {{values: object}} the theme-settings.json payload
 */
export function toThemeSettings(config, home) {
  const colors = config.colors || {};
  const header = config.header || {};
  const footer = config.footer || {};
  const homeLogo = (home && home.header && home.header.logo) || {};

  const headerDark = isDark(colors.header_bg) || isDark(colors.bg);
  const ink = colors.ink || '#111111';
  const accent = colors.accent || '';
  const title = (homeLogo.text && String(homeLogo.text).trim())
    || (config.theme && config.theme.name) || 'Site';

  const values = {};

  /* --- header_logo (wordmark + optional icon) --- */
  const hl = {
    site_title: title,
    title_weight: '600',
    color: hex(headerDark ? '#ffffff' : ink),
    tagline: ' d-none',
  };
  if (homeLogo.icon && /^lucide\//.test(homeLogo.icon)) {
    hl.logo_icon = { type: 'svg', 'svg-source': 'library', 'svg-id': homeLogo.icon };
    hl.logo_icon_position = 'before';
    hl.logo_icon_color = accent ? { predefined: 'text-primary', custom: '' } : hex(ink);
  }
  values.header_logo = hl;

  /* --- header_main: logo · menu · CTA --- */
  const right = [];
  if (header.cta && header.cta.enabled && header.cta.label) {
    right.push(el('cta_button', {
      cta_text: header.cta.label,
      cta_link: header.cta.href || '#',
      cta_style: 'btn-primary',
      cta_size: 'btn-md',
    }));
  }
  values.header_main = {
    main_left: [el('logo')],
    main_center: [el('menu_area', { menu_location: 'primary' })],
    main_right: right,
  };

  /* --- header_menu --- */
  const navColor = (home && home.chrome && home.chrome.nav_style && home.chrome.nav_style.color) || '';
  values.header_menu = {
    menu_link_color: hex(navColor || (headerDark ? '#cbd5e1' : ink)),
    menu_link_hover_color: hex(headerDark ? '#ffffff' : (accent || ink)),
  };

  /* --- header_layout --- */
  values.header_layout = {
    header_mode: { mode: 'top', top: { header_design: { design: 'classic' } } },
    header_behavior: header.sticky ? 'sticky' : 'default',
    header_glass: 'no',
    header_shadow: 'no',
    header_border: 'no',
    header_uppercase_nav: 'no',
    bg_color: hex(colors.header_bg && /^#|rgb/.test(colors.header_bg) ? colors.header_bg : (headerDark ? '#111111' : '#ffffff')),
  };

  /* --- footer colors (background-pro shape for the fill) --- */
  const footerBg = colors.footer_bg || '#141414';
  const footerText = colors.footer_text || '#94a3b8';
  values.footer_background = { color: { value: { predefined: '', custom: footerBg } } };
  values.footer_text_color = hex(footerText);
  values.footer_link_color = hex(footerText);

  /* --- social_profiles (footer social links → Lucide) --- */
  const socialSeen = {};
  const social = [];
  (footer.social || []).forEach((s) => {
    const icon = socialLucide(s.url);
    if (!icon || socialSeen[icon]) return;
    socialSeen[icon] = true;
    let host = ''; try { host = new URL(s.url).host.replace(/^www\./, ''); } catch { host = ''; }
    const wm = host.match(/([a-z0-9-]+)\.[a-z.]+$/i);
    let word = (s.label || '').trim() || (wm ? wm[1] : icon.replace('lucide/', ''));
    if (word.toLowerCase() === 'x') word = 'Twitter';
    social.push({ name: word.charAt(0).toUpperCase() + word.slice(1), link: s.url, new_tab: 'yes',
      icon: { type: 'svg', 'svg-source': 'library', 'svg-id': icon } });
  });
  if (social.length) values.social_profiles = social.slice(0, 6);

  /* --- main_footer_columns: brand column + link columns (source footer grid) --- */
  // footer.menu = top-level groups { label, url:'#', children:[{label,url}] } (link columns).
  const groups = (footer.menu || []).filter((g) => Array.isArray(g.children) && g.children.length >= 2).slice(0, 4);
  if (groups.length) {
    const brandCol = [el('logo')];
    const fdesc = (footer.copyright || '').trim();
    if (fdesc) brandCol.push({ element_type: { element: 'text', text: { text_content: `<p>${escHtml(fdesc)}</p>` } } });
    if (social.length) brandCol.push(el('social_icons'));

    const cols = [brandCol];
    groups.forEach((g) => {
      let h = `<h4>${escHtml(g.label)}</h4><ul>`;
      g.children.forEach((l) => { h += `<li><a href="${escHtml(l.url || '#')}">${escHtml(l.label)}</a></li>`; });
      h += '</ul>';
      cols.push([{ element_type: { element: 'text', text: { text_content: h } } }]);
    });
    const trimmed = cols.slice(0, 5);
    const n = trimmed.length;
    const mfc = {};
    trimmed.forEach((c, i) => { mfc[`main_footer_col_${i + 1}`] = c; });
    // 4 columns whose brand column is wider → the fifths "2/5+1/5+1/5+1/5" layout.
    let countKey = String(n);
    if (n === 4) { mfc.main_footer_layout = 'f5-2-1-1-1'; countKey = '5'; }
    values.main_footer_columns = { count: countKey, [countKey]: mfc };
  }

  /* --- copyright bar --- */
  let copy = (home && home.footer && String(home.footer.copyright || '').trim()) || '';
  if (copy) { copy = copy.replace(/\b(19|20)\d{2}\b/, '{{current_year}}'); }
  else { copy = `&copy; {{current_year}} ${title}. All rights reserved.`; }
  values.copyright_settings = {
    enabled: 'yes',
    yes: {
      copyright_columns: {
        count: '1',
        1: { copyright_col_1: [{ element_type: { element: 'text', text: { text_content: copy } } }] },
      },
    },
  };

  return { values };
}
