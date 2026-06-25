// Color Presets generator — turns a capture into a `presets.json` (`theme_colors`) so the
// converted site's Component Presets → Color Presets admin matches the captured /style-guide/.
// Without this the plugin's DEFAULT palette (Primary #0d6efd, Accent #fd7e14, …) is left in
// place and the style guide (which shows the real source colors) disagrees with the presets.
//
// Strategy: start from the SAME named palette the plugin ships (so the rich Material set is
// preserved), then OVERRIDE the brand/role entries with the captured values — using the exact
// same role→color mapping the style guide uses (Primary = brand accent, Secondary, the
// Bootstrap roles → their closest named preset). Only overrides where a value was captured.
//
// The plugin's FW_Site_Converter_Presets::import() writes the whole `theme_colors` array to the
// preset store, so emitting the full list (defaults + overrides) keeps every swatch intact.

// The plugin's default palette — keep names/order in sync with
// framework/includes/presets/color-presets.php unysonplus_default_color_presets().
const DEFAULTS = [
  ['Primary', '#0d6efd'], ['Secondary', '#6c757d'], ['Accent', '#fd7e14'], ['Muted', '#adb5bd'],
  ['Black', '#000'], ['White', '#fff'], ['Gray', '#636c72'], ['Light Gray', '#bdbdbd'],
  ['Red', '#dc3545'], ['Pink', '#e91e63'], ['Purple', '#9c27b0'], ['Deep Purple', '#673ab7'],
  ['Indigo', '#3f51b5'], ['Blue', '#286090'], ['Light Blue', '#03a9f4'], ['Cyan', '#00bcd4'],
  ['Teal', '#009688'], ['Green', '#5cb85c'], ['Light Green', '#8bc34a'], ['Lime', '#cddc39'],
  ['Yellow', '#ffeb3b'], ['Amber', '#ffc107'], ['Orange', '#ff9800'], ['Deep Orange', '#ff5722'],
  ['Brown', '#795548'], ['Blue Gray', '#607d8b'],
];

// hsl token like "217 91% 53%" → hsl() string; pass-through hex/rgb; '' → ''. Mirrors the
// `col()` in to-styleguide.mjs so the presets and the style-guide swatches resolve identically.
const col = (v) => {
  v = String(v == null ? '' : v).trim();
  if (v === '') return '';
  if (/^(#|rgb|hsl)/i.test(v)) return v;
  if (/^\d+\s+[\d.]+%\s+[\d.]+%$/.test(v)) return `hsl(${v})`;
  return v;
};

export function toPresets(designConfig, capture) {
  const cfg = designConfig || {};
  const cap = capture || {};
  const colors = cfg.colors || {};
  const vars = (cap.tokens && cap.tokens.vars) || {};

  // Role → named-preset overrides, matching to-styleguide.mjs's roleColors mapping exactly.
  // Primary = the detected brand accent first (to-design-config already corrects Bootstrap's
  // default --primary for sites that brand via the CTA), falling back to the raw --primary var.
  const overrides = {
    'Primary':    colors.accent || vars['--primary'],
    'Secondary':  vars['--secondary'],
    'Accent':     colors.accent,
    'Red':        vars['--danger'],
    'Green':      vars['--success'],
    'Amber':      vars['--warning'],
    'Cyan':       vars['--info'],
    'Black':      vars['--dark'] || colors.ink,
    'White':      vars['--light'],
    'Gray':       vars['--gray'] || vars['--gray-600'] || vars['--gray-700'],
    'Light Gray': vars['--gray-400'] || vars['--gray-300'] || vars['--gray-200'],
  };

  const theme_colors = DEFAULTS.map(([name, def]) => {
    const over = col(overrides[name]);
    return { name, color: over || def };
  });

  return { values: { theme_colors } };
}
