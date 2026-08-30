import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { CONTROL_DEFAULTS, INTRO_FONTS } from './controls.js';

const SKIP_NAMES = new Set(['README.md']);
const CONTENT_DIRS = ['series', 'projects', 'photos', 'gear', 'journal'];

const KIND_FIELDS = {
  about: ['title', 'portrait'],
  collection: ['title', 'summary', 'year', 'tags', 'order', 'cover'],
  project: ['title', 'summary', 'client', 'industry', 'services', 'year', 'tags', 'order', 'cover'],
  sidecar: [
    'alt', 'caption', 'title', 'story', 'tags', 'place', 'highlight', 'cover',
    'order', 'link', 'camera', 'lens', 'aperture', 'shutter', 'focalLength',
    'iso', 'takenAt', 'location',
  ],
  gear: ['title', 'category', 'since', 'image', 'current', 'order'],
  generic: [],
};

export const FIELD_META = {
  about: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'portrait', label: 'Portrait filename', type: 'text', help: 'Image in about/ or repo root, e.g. portrait.jpg' },
  ],
  collection: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'summary', label: 'Summary', type: 'text', help: 'One line on listing cards' },
    { key: 'year', label: 'Year', type: 'number' },
    { key: 'tags', label: 'Tags', type: 'tags', help: 'Cascade to every image in this folder' },
    { key: 'order', label: 'Order', type: 'number', help: 'Listing sort. Lower first.' },
    { key: 'cover', label: 'Cover file', type: 'text', help: 'Optional filename, e.g. 06.jpg' },
  ],
  project: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'summary', label: 'Summary', type: 'text' },
    { key: 'client', label: 'Client', type: 'text' },
    { key: 'industry', label: 'Industry', type: 'text' },
    { key: 'services', label: 'Services', type: 'tags' },
    { key: 'year', label: 'Year', type: 'number' },
    { key: 'tags', label: 'Tags', type: 'tags' },
    { key: 'order', label: 'Order', type: 'number' },
    { key: 'cover', label: 'Cover file', type: 'text', help: 'Optional filename, e.g. 04.jpg' },
  ],
  sidecar: [
    { key: 'alt', label: 'Alt text', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'story', label: 'Story', type: 'textarea', help: 'Shown under EXIF. If empty, the markdown body is used.' },
    { key: 'tags', label: 'Tags', type: 'tags' },
    { key: 'place', label: 'Place', type: 'text', help: 'Slug for /places/, e.g. kolkata' },
    { key: 'highlight', label: 'Homepage highlight', type: 'boolean' },
    { key: 'cover', label: 'Collection cover', type: 'boolean' },
    { key: 'order', label: 'Order', type: 'number' },
    { key: 'link', label: 'Highlight link', type: 'text' },
    { key: 'camera', label: 'Camera', type: 'text' },
    { key: 'lens', label: 'Lens', type: 'text' },
    { key: 'aperture', label: 'Aperture', type: 'text' },
    { key: 'shutter', label: 'Shutter', type: 'text' },
    { key: 'focalLength', label: 'Focal length', type: 'text' },
    { key: 'iso', label: 'ISO', type: 'number' },
    { key: 'takenAt', label: 'Taken at', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
  ],
  gear: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'since', label: 'Since', type: 'number' },
    { key: 'image', label: 'Image filename', type: 'text' },
    { key: 'current', label: 'Current kit', type: 'boolean' },
    { key: 'order', label: 'Order', type: 'number' },
  ],
  generic: [],
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function merge(base, overlay) {
  if (!overlay) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (isPlainObject(value) && isPlainObject(base[key])) out[key] = merge(base[key], value);
    else if (value !== undefined) out[key] = value;
  }
  return out;
}

export function toPosix(rel) {
  return String(rel || '').split(path.sep).join('/');
}

export function detectKind(relPath) {
  const rel = toPosix(relPath);
  if (rel === 'data/controls.yaml') return 'controls';
  if (rel === 'about.md') return 'about';
  if (rel.startsWith('gear/')) return 'gear';
  if (/^projects\/.+\/readme\.md$/i.test(rel)) return 'project';
  if (/^(series|journal)\/.+\/readme\.md$/i.test(rel)) return 'collection';
  if (/^(series|projects|photos|journal)\//.test(rel)) return 'sidecar';
  return 'generic';
}

export function isEditablePath(relPath) {
  const rel = toPosix(relPath);
  if (!rel || rel.includes('..') || rel.startsWith('/')) return false;
  const base = path.posix.basename(rel);
  if (SKIP_NAMES.has(base)) return false;
  if (rel === 'data/controls.yaml' || rel === 'about.md') return true;
  if (!rel.endsWith('.md')) return false;
  return CONTENT_DIRS.some((dir) => rel.startsWith(`${dir}/`));
}

export function isAssetPath(relPath) {
  const rel = toPosix(relPath);
  if (!rel || rel.includes('..') || rel.startsWith('/')) return false;
  const ext = path.posix.extname(rel).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return false;
  if (rel === 'about.md') return false;
  if (rel.startsWith('about/')) return true;
  return CONTENT_DIRS.some((dir) => rel.startsWith(`${dir}/`));
}

export function resolveUnderRoot(rootDir, relPath) {
  const rel = toPosix(relPath).replace(/^\/+/, '');
  const full = path.resolve(rootDir, rel);
  const root = path.resolve(rootDir);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return { rel, full };
}

function wrapYaml(raw) {
  return raw.trimStart().startsWith('---') ? raw : `---\n${raw}\n`;
}

function yamlScalar(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const str = String(value);
  if (/^(true|false|null|yes|no|[0-9]+)$/i.test(str) || /[:#{}[\],&*?|<>=!%@`'\n]/.test(str) || /\s/.test(str)) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

function yamlField(key, value) {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return `${key}: [${items.map((item) => yamlScalar(item)).join(', ')}]`;
  }
  const formatted = yamlScalar(value);
  return formatted === '' ? `${key}:` : `${key}: ${formatted}`;
}

function normalizeData(kind, data) {
  const src = data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : {};
  if (kind === 'sidecar') {
    src.highlight = Boolean(src.highlight);
    src.cover = src.cover === true || src.cover === 'true' || src.cover === 'yes' || src.cover === 1;
    if (src.tags != null && !Array.isArray(src.tags)) src.tags = [src.tags];
  }
  if (kind === 'collection' || kind === 'project' || kind === 'gear') {
    if (src.tags != null && !Array.isArray(src.tags)) src.tags = [src.tags];
    if (src.services != null && !Array.isArray(src.services)) src.services = [src.services];
  }
  if (kind === 'gear') src.current = src.current !== false;
  return src;
}

function extraKeys(kind, data) {
  const known = new Set(KIND_FIELDS[kind] || []);
  return Object.keys(data).filter((key) => !known.has(key));
}

function keepYamlField(kind, key, value) {
  if (kind === 'sidecar' && (key === 'highlight' || key === 'cover')) return true;
  if (kind === 'gear' && key === 'current') return true;
  if (value === true || value === false) return true;
  if (typeof value === 'number' && Number.isFinite(value)) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (value == null) return false;
  return String(value).trim() !== '';
}

export function serializeMarkdown(kind, data, content) {
  const normalized = normalizeData(kind, data);
  const order = KIND_FIELDS[kind] || Object.keys(normalized);
  const keys = [...new Set([...order, ...extraKeys(kind, normalized)])];
  const lines = ['---'];
  for (const key of keys) {
    if (!keepYamlField(kind, key, normalized[key])) continue;
    lines.push(yamlField(key, normalized[key]));
  }
  lines.push('---', '');
  const body = String(content || '').replace(/^\n+/, '').replace(/\s+$/, '');
  return body ? `${lines.join('\n')}${body}\n` : `${lines.join('\n')}`;
}

export function parseEditable(relPath, raw) {
  const kind = detectKind(relPath);
  if (kind === 'controls') {
    return { path: relPath, kind, raw, data: parseControlsRaw(raw), content: '' };
  }
  const parsed = matter(raw);
  return {
    path: relPath,
    kind,
    raw,
    data: normalizeData(kind, parsed.data || {}),
    content: parsed.content || '',
  };
}

export function serializeControls(input) {
  const c = merge(CONTROL_DEFAULTS, input || {});
  const intro = c.intro || CONTROL_DEFAULTS.intro;
  const fonts = c.fonts || CONTROL_DEFAULTS.fonts;
  const colors = c.colors || CONTROL_DEFAULTS.colors;
  const sections = c.sections || CONTROL_DEFAULTS.sections;
  const strip = c.selected_strip || CONTROL_DEFAULTS.selected_strip;
  const motion = c.motion || CONTROL_DEFAULTS.motion;
  const layout = c.layout || CONTROL_DEFAULTS.layout;
  const sharedSpeed = motion.scroll_speed;
  const selectedOverride = motion.selected_scroll_speed != null && Number(motion.selected_scroll_speed) !== Number(sharedSpeed);
  const timelineOverride = motion.timeline_scroll_speed != null && Number(motion.timeline_scroll_speed) !== Number(sharedSpeed);

  const timingNotes = {
    letters_in: 'ms: staggered SKD enters in the right-half center',
    letters_dock: 'ms: SKD travels left and lines up',
    canvas_open: 'ms: photo frame fills the viewport',
    photo_in: 'ms: photo fades in (still zoomed in)',
    photo_zoom: 'ms: zoom-out toward a device fit',
    shutter: 'ms: shutters wipe the photo (SKD stays)',
    name_expand: 'ms: SKD extends to Saikat K Das',
    name_out: 'ms: name leaves, homepage shows',
    total: 'ms: loading counter duration',
  };

  const timingLines = Object.entries(intro.timings || {}).map(([key, value]) => {
    const note = timingNotes[key] ? `          # ${timingNotes[key]}` : '';
    return `    ${key}: ${yamlScalar(value)}${note}`;
  });

  const sectionLines = Object.entries(sections).map(([key, value]) => `  ${key}: ${yamlScalar(value)}`);
  const colorLines = Object.entries(colors).map(([key, value]) => `  ${key}: ${yamlScalar(value)}`);

  const motionLines = [
    `  honor_reduced: ${yamlScalar(motion.honor_reduced)}`,
    `  highlight_stagger: ${yamlScalar(motion.highlight_stagger)}    # jitter | linear | none`,
    `  scroll_speed: ${yamlScalar(motion.scroll_speed)}    # 1 = current feel. Clamped to 0.25-4.`,
  ];
  if (selectedOverride) motionLines.push(`  selected_scroll_speed: ${yamlScalar(motion.selected_scroll_speed)}`);
  if (timelineOverride) motionLines.push(`  timeline_scroll_speed: ${yamlScalar(motion.timeline_scroll_speed)}`);

  return [
    '---',
    '# Site control knobs. Edit this file, then run `npm run build`.',
    '# Missing keys fall back to the defaults in scripts/lib/controls.js.',
    '',
    'intro:',
    `  enabled: ${yamlScalar(intro.enabled)}`,
    '  # reload = play on every homepage load; once = skip after first visit',
    `  play_on: ${yamlScalar(intro.play_on)}`,
    '  timings:',
    ...timingLines,
    `  photo_zoom_start: ${yamlScalar(intro.photo_zoom_start)}    # scale at fade-in`,
    `  photo_zoom_end: ${yamlScalar(intro.photo_zoom_end)}    # scale after zoom-out`,
    '  # On short landscape viewports, zoom-out uses contain so the frame fits',
    `  photo_fit_landscape: ${yamlScalar(intro.photo_fit_landscape)}`,
    '',
    'fonts:',
    `  display: ${yamlScalar(fonts.display)}`,
    `  body: ${yamlScalar(fonts.body)}`,
    `  mono: ${yamlScalar(fonts.mono)}`,
    `  display_weight: ${yamlScalar(fonts.display_weight)}`,
    '  # SKD intro letters + header logo. Headings/body stay on `display`.',
    `  intro: ${yamlScalar(fonts.intro)}`,
    `  intro_weight: ${yamlScalar(fonts.intro_weight)}`,
    `  intro_google: ${yamlScalar(fonts.intro_google)}`,
    `  intro_choice: ${yamlScalar(fonts.intro_choice)}`,
    `  google: ${yamlScalar(fonts.google)}`,
    '',
    'colors:',
    ...colorLines,
    '',
    'sections:',
    ...sectionLines,
    '',
    'selected_strip:',
    `  enabled: ${yamlScalar(strip.enabled)}`,
    '  # Keys from data/site.json nav. Empty folders / false section flags drop out.',
    `  items: [${(strip.items || []).map((item) => yamlScalar(item)).join(', ')}]`,
    '',
    'motion:',
    ...motionLines,
    '',
    'layout:',
    `  highlight_track_min_height: ${yamlScalar(layout.highlight_track_min_height)}`,
    `  selected_min_height: ${yamlScalar(layout.selected_min_height)}`,
    '',
  ].join('\n');
}

export function parseControlsRaw(raw) {
  const { data } = matter(wrapYaml(raw));
  return merge(CONTROL_DEFAULTS, data);
}

function labelFromData(kind, rel, data) {
  if (kind === 'controls') return 'Site controls';
  if (kind === 'about') return data.title || 'About';
  if (kind === 'collection' || kind === 'project') return data.title || path.posix.basename(path.posix.dirname(rel));
  if (kind === 'gear') return data.title || path.posix.basename(rel, '.md');
  if (kind === 'sidecar') return data.alt || data.title || path.posix.basename(rel, '.md');
  return path.posix.basename(rel);
}

function groupInfo(rel) {
  if (rel === 'data/controls.yaml') return { section: 'Controls', folder: '', id: 'controls' };
  if (rel === 'about.md') return { section: 'About', folder: '', id: 'about' };
  const parts = rel.split('/');
  const top = parts[0];
  if (top === 'photos') return { section: 'Untitled', folder: '', id: 'untitled' };
  if (top === 'gear') return { section: 'Gear', folder: '', id: 'gear' };
  if ((top === 'series' || top === 'projects' || top === 'journal') && parts[1]) {
    const folder = parts[1];
    const section = top === 'series' ? 'Series' : top === 'projects' ? 'Projects' : 'Journal';
    return { section, folder, id: `${top}:${folder}` };
  }
  return { section: 'Other', folder: '', id: 'other' };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdown(rootDir, dir, relBase, acc) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const rel = toPosix(path.join(relBase, entry.name));
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(rootDir, full, rel, acc);
    } else if (isEditablePath(rel)) {
      const raw = await fs.readFile(full, 'utf8');
      const parsed = rel.endsWith('.yaml') ? matter(wrapYaml(raw)) : matter(raw);
      const kind = detectKind(rel);
      const data = normalizeData(kind, parsed.data || {});
      acc.push({
        path: rel,
        kind,
        label: labelFromData(kind, rel, data),
        highlight: Boolean(data.highlight),
        ...groupInfo(rel),
      });
    }
  }
}

const SECTION_ORDER = ['Controls', 'About', 'Series', 'Projects', 'Untitled', 'Gear', 'Journal', 'Other'];

export async function listEditableFiles(rootDir) {
  const files = [
    {
      path: 'data/controls.yaml',
      kind: 'controls',
      label: 'Site controls',
      highlight: false,
      ...groupInfo('data/controls.yaml'),
    },
  ];
  if (await pathExists(path.join(rootDir, 'about.md'))) {
    const raw = await fs.readFile(path.join(rootDir, 'about.md'), 'utf8');
    const { data } = matter(raw);
    files.push({
      path: 'about.md',
      kind: 'about',
      label: labelFromData('about', 'about.md', data || {}),
      highlight: false,
      ...groupInfo('about.md'),
    });
  }
  for (const dir of CONTENT_DIRS) {
    await walkMarkdown(rootDir, path.join(rootDir, dir), dir, files);
  }

  const groups = new Map();
  for (const file of files) {
    if (!groups.has(file.id)) {
      groups.set(file.id, {
        id: file.id,
        section: file.section,
        folder: file.folder,
        label: file.folder || file.section,
        files: [],
      });
    }
    groups.get(file.id).files.push(file);
  }

  for (const group of groups.values()) {
    group.files.sort((a, b) => {
      const aReadme = a.path.endsWith('/readme.md') ? 0 : 1;
      const bReadme = b.path.endsWith('/readme.md') ? 0 : 1;
      if (aReadme !== bReadme) return aReadme - bReadme;
      return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
    });
    const readme = group.files.find((file) => file.path.endsWith('/readme.md'));
    if (readme) group.label = readme.label;
  }

  return [...groups.values()].sort((a, b) => {
    const section = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
    if (section !== 0) return section;
    return (a.label || '').localeCompare(b.label || '', undefined, { numeric: true, sensitivity: 'base' });
  });
}

export async function findPreviewRel(rootDir, relPath, data = {}) {
  const rel = toPosix(relPath);
  const dir = path.posix.dirname(rel);
  const base = path.posix.basename(rel, path.posix.extname(rel));
  const kind = detectKind(rel);

  const candidates = [];
  if (kind === 'sidecar') {
    for (const name of [`${base}.thumb.webp`, `${base}.thumb.jpg`, `${base}.jpg`, `${base}.jpeg`, `${base}.png`, `${base}.webp`]) {
      candidates.push(dir === '.' ? name : `${dir}/${name}`);
    }
  }
  if ((kind === 'collection' || kind === 'project') && typeof data.cover === 'string' && data.cover.trim()) {
    const cover = data.cover.trim();
    const coverBase = cover.replace(/\.[^.]+$/, '');
    const folder = dir === '.' ? '' : `${dir}/`;
    candidates.push(`${folder}${coverBase}.thumb.webp`, `${folder}${coverBase}.thumb.jpg`, `${folder}${cover}`);
  }
  if (kind === 'gear' && data.image) {
    const folder = dir === '.' ? '' : `${dir}/`;
    candidates.push(`${folder}${data.image}`);
  }
  if (kind === 'about' && data.portrait) {
    const portrait = String(data.portrait).replace(/^\/+/, '');
    candidates.push(portrait.startsWith('about/') ? portrait : `about/${portrait}`, portrait);
  }

  for (const candidate of candidates) {
    if (!isAssetPath(candidate) && !candidate.startsWith('about/')) continue;
    if (await pathExists(path.join(rootDir, candidate))) return candidate;
  }
  return null;
}

export async function readEditable(rootDir, relPath) {
  const resolved = resolveUnderRoot(rootDir, relPath);
  if (!resolved || !isEditablePath(resolved.rel)) {
    const err = new Error('File is not editable');
    err.status = 400;
    throw err;
  }
  const raw = await fs.readFile(resolved.full, 'utf8');
  const kind = detectKind(resolved.rel);
  if (kind === 'controls') {
    const controls = parseControlsRaw(raw);
    return {
      path: resolved.rel,
      kind,
      raw,
      data: controls,
      content: '',
      preview: null,
    };
  }
  const parsed = matter(raw);
  const data = normalizeData(kind, parsed.data || {});
  return {
    path: resolved.rel,
    kind,
    raw,
    data,
    content: parsed.content || '',
    preview: await findPreviewRel(rootDir, resolved.rel, data),
  };
}

export async function writeEditable(rootDir, payload) {
  const resolved = resolveUnderRoot(rootDir, payload.path);
  if (!resolved || !isEditablePath(resolved.rel)) {
    const err = new Error('File is not editable');
    err.status = 400;
    throw err;
  }
  const kind = detectKind(resolved.rel);
  let text;
  if (typeof payload.raw === 'string' && payload.mode === 'source') {
    text = payload.raw;
    if (kind === 'controls') parseControlsRaw(text);
    else matter(text);
  } else if (kind === 'controls') {
    text = serializeControls(payload.controls || payload.data || {});
  } else {
    text = serializeMarkdown(kind, payload.data || {}, payload.content || '');
  }
  if (!text.endsWith('\n')) text += '\n';
  await fs.writeFile(resolved.full, text, 'utf8');
  return readEditable(rootDir, resolved.rel);
}

export function editorMeta(site) {
  return {
    fields: FIELD_META,
    introFonts: Object.fromEntries(
      Object.entries(INTRO_FONTS).map(([key, spec]) => [key, { name: spec.name, note: spec.note, stack: spec.stack, google: spec.google, weight: spec.weight }])
    ),
    navKeys: (site?.nav || []).map((item) => item.key).filter(Boolean),
    defaults: CONTROL_DEFAULTS,
  };
}
