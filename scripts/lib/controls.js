import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export const CONTROL_DEFAULTS = {
  intro: {
    enabled: true,
    play_on: 'reload',
    timings: {
      letters_in: 80,
      canvas_open: 1200,
      photo_in: 2100,
      photo_zoom: 2800,
      shutter: 5600,
      name_expand: 6600,
      name_out: 8600,
      total: 10400,
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
    themes: true,
    gear: true,
    journal: true,
  },
  selected_strip: {
    enabled: true,
    items: ['series', 'themes', 'about'],
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

function quoteFontStack(stack) {
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
  --intro-zoom-start: ${intro.photo_zoom_start};
  --intro-zoom-end: ${intro.photo_zoom_end};
  --highlight-track-min-h: ${layout.highlight_track_min_height};
  --selected-min-h: ${layout.selected_min_height};
}`;
}

export function introRuntimeConfig(controls) {
  return {
    enabled: controls.intro.enabled && controls.sections.intro !== false,
    playOn: controls.intro.play_on,
    timings: controls.intro.timings,
    honorReduced: controls.motion.honor_reduced !== false,
    photoFitLandscape: controls.intro.photo_fit_landscape,
  };
}
