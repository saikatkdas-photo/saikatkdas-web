import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export const CONTROL_DEFAULTS = {
  intro: {
    enabled: true,
    play_on: 'reload',
    timings: {
      letters_in: 80,
      letters_dock: 1300,
      canvas_open: 2300,
      photo_in: 3100,
      photo_zoom: 3800,
      shutter: 6400,
      name_expand: 7400,
      name_out: 9400,
      total: 11200,
    },
    photo_zoom_start: 1.72,
    photo_zoom_end: 1,
    photo_fit_landscape: 'contain',
  },
  fonts: {
    display: 'Helvetica Neue, Helvetica, IBM Plex Sans, Arial, sans-serif',
    body: 'Helvetica Neue, Helvetica, IBM Plex Sans, Arial, sans-serif',
    mono: 'IBM Plex Mono, ui-monospace, monospace',
    display_weight: 700,
    google: 'IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500',
    intro: 'Barlow Condensed, Arial-BoldMT,Arial-Regular, Arial, sans-serif',
    intro_weight: 800,
    intro_google: 'Barlow+Condensed:wght@500;600;700;800',
    intro_choice: 'barlow-condensed',
  },
  colors: {
    bg: '#ECEAE4',
    bg_raised: '#E2DFD6',
    ink: '#17160F',
    ink_soft: '#55534A',
    ink_faint: '#8B8A7E',
    line: 'rgba(23, 22, 15, 0.14)',
    line_strong: 'rgba(23, 22, 15, 0.28)',
    accent: '#B4491F',
    accent_ink: '#FCEFE6',
    surface_dark: '#17160F',
    surface_dark_raised: '#211F16',
    on_dark: '#ECEAE4',
    on_dark_soft: '#B3B1A5',
    on_dark_line: 'rgba(236, 234, 228, 0.16)',
  },
  sections: {
    intro: true,
    hero: true,
    selected: true,
    selected_strip: true,
    work_previews: true,
    about: true,
    projects: true,
    series: true,
    untitled: true,
    timeline: true,
    places: true,
    themes: true,
    gear: true,
    journal: true,
  },
  selected_strip: {
    enabled: true,
    items: ['series', 'places', 'themes', 'about'],
  },
  motion: {
    honor_reduced: true,
    highlight_stagger: 'jitter',
  },
  layout: {
    highlight_track_min_height: '52dvh',
    selected_min_height: '100dvh',
  },
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function merge(base, overlay) {
  if (!overlay) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      out[key] = merge(base[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export async function loadControls(rootDir) {
  const filePath = path.join(rootDir, 'data', 'controls.yaml');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const wrapped = raw.trimStart().startsWith('---') ? raw : `---\n${raw}\n`;
    const { data } = matter(wrapped);
    return merge(CONTROL_DEFAULTS, data);
  } catch (err) {
    if (err.code === 'ENOENT') return { ...CONTROL_DEFAULTS };
    throw err;
  }
}

export const INTRO_FONTS = {
  oswald: {
    name: 'Oswald',
    note: 'Condensed gothic. Narrow, slightly industrial, very gaunt at display size.',
    stack: 'Oswald, Helvetica Neue, sans-serif',
    google: 'Oswald:wght@500;600;700',
    weight: 500,
  },
  'barlow-condensed': {
    name: 'Barlow Condensed',
    note: 'Helvetica’s lean cousin. Clean grotesk, condensed without going poster.',
    stack: 'Barlow Condensed, Helvetica Neue, sans-serif',
    google: 'Barlow+Condensed:wght@500;600;700',
    weight: 600,
  },
  'alumni-sans': {
    name: 'Alumni Sans',
    note: 'Taller than it is wide. Soft grotesk with a starved, editorial silhouette.',
    stack: 'Alumni Sans, Helvetica Neue, sans-serif',
    google: 'Alumni+Sans:wght@500;600;700',
    weight: 600,
  },
  'sofia-sans-condensed': {
    name: 'Sofia Sans Condensed',
    note: 'Neo-grotesk condensed. Neutral, straight, a bit more gaunt than Helvetica.',
    stack: 'Sofia Sans Condensed, Helvetica Neue, sans-serif',
    google: 'Sofia+Sans+Condensed:wght@500;600;700',
    weight: 600,
  },
  'big-shoulders-display': {
    name: 'Big Shoulders Display',
    note: 'Fashion-tall. The gauntest of the five — extra condensed, high-contrast stems.',
    stack: 'Big Shoulders Display, Helvetica Neue, sans-serif',
    google: 'Big+Shoulders+Display:wght@500;600;700',
    weight: 600,
  },
};

export function resolveIntroFont(controls) {
  const f = controls?.fonts || {};
  const key = f.intro_choice || 'barlow-condensed';
  const catalog = INTRO_FONTS[key] || INTRO_FONTS['barlow-condensed'];
  const stack = (typeof f.intro === 'string' && f.intro.trim()) ? f.intro : catalog.stack;
  const weight = f.intro_weight != null ? Number(f.intro_weight) : catalog.weight;
  const google = (typeof f.intro_google === 'string' && f.intro_google.trim()) ? f.intro_google : catalog.google;
  const matched = Object.entries(INTRO_FONTS).find(([, spec]) => spec.stack === stack);
  return {
    key: matched ? matched[0] : (f.intro ? 'custom' : key),
    name: stack.split(',')[0].trim(),
    note: catalog.note,
    stack,
    weight: Number.isFinite(weight) ? weight : 600,
    google,
  };
}

export function googleFontsHref(controls, extraFamilies = []) {
  const parts = [];
  if (controls?.fonts?.google) parts.push(controls.fonts.google);
  const introGoogle = resolveIntroFont(controls).google;
  const extras = [...(introGoogle ? [introGoogle] : []), ...extraFamilies];
  for (const fam of extras) {
    const id = String(fam).split(':')[0];
    if (fam && !parts.some((part) => part.includes(id))) parts.push(fam);
  }
  if (!parts.length) return '';
  const [first, ...rest] = parts;
  const query = rest.length ? `${first}&family=${rest.join('&family=')}` : first;
  return `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
}

export function quoteFontStack(stack) {
  return String(stack)
    .split(',')
    .map((part) => {
      const name = part.trim();
      if (!name) return '';
      if (/['"]/.test(name) || /^(serif|sans-serif|monospace|system-ui|ui-monospace)$/i.test(name)) return name;
      if (/\s/.test(name)) return `'${name}'`;
      return name;
    })
    .filter(Boolean)
    .join(', ');
}

export function controlsToCss(controls) {
  const c = controls.colors;
  const f = controls.fonts;
  const intro = controls.intro;
  const layout = controls.layout;
  const introFont = resolveIntroFont(controls);
  return `:root {
  --bg: ${c.bg};
  --bg-raised: ${c.bg_raised};
  --ink: ${c.ink};
  --ink-soft: ${c.ink_soft};
  --ink-faint: ${c.ink_faint};
  --line: ${c.line};
  --line-strong: ${c.line_strong};
  --accent: ${c.accent};
  --accent-ink: ${c.accent_ink};
  --surface-dark: ${c.surface_dark};
  --surface-dark-raised: ${c.surface_dark_raised};
  --on-dark: ${c.on_dark};
  --on-dark-soft: ${c.on_dark_soft};
  --on-dark-line: ${c.on_dark_line};
  --font-display: ${quoteFontStack(f.display)};
  --font-body: ${quoteFontStack(f.body)};
  --font-mono: ${quoteFontStack(f.mono)};
  --font-display-weight: ${Number(f.display_weight) || 700};
  --font-intro: ${quoteFontStack(introFont.stack)};
  --font-intro-weight: ${Number(introFont.weight) || 600};
  --intro-zoom-start: ${intro.photo_zoom_start};
  --intro-zoom-end: ${intro.photo_zoom_end};
  --highlight-track-min-h: ${layout.highlight_track_min_height};
  --selected-min-h: ${layout.selected_min_height};
}`;
}

export function introRuntimeConfig(controls) {
  const introFont = resolveIntroFont(controls);
  return {
    enabled: controls.intro.enabled && controls.sections.intro !== false,
    playOn: controls.intro.play_on,
    timings: controls.intro.timings,
    honorReduced: controls.motion.honor_reduced !== false,
    photoFitLandscape: controls.intro.photo_fit_landscape,
    introFont: { key: introFont.key, family: quoteFontStack(introFont.stack), weight: introFont.weight },
    introFonts: Object.fromEntries(
      Object.entries(INTRO_FONTS).map(([key, spec]) => [key, { family: quoteFontStack(spec.stack), weight: spec.weight }])
    ),
  };
}
