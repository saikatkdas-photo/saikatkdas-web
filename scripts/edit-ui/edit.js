const $ = (id) => document.getElementById(id);

const state = {
  groups: [],
  meta: { fields: {}, introFonts: {}, navKeys: [], defaults: {} },
  path: '',
  kind: '',
  data: {},
  content: '',
  raw: '',
  preview: '',
  mode: 'form',
  dirty: false,
  query: '',
  highlightsOnly: false,
  closed: new Set(),
};

const treeEl = $('tree');
const workspace = $('workspace');
const pathEl = $('file-path');
const statusEl = $('status');
const saveBtn = $('save-btn');
const rebuildBtn = $('rebuild-btn');
const searchEl = $('search');
const highlightsEl = $('highlights-only');
const sidebar = $('sidebar');
const menuBtn = $('menu-btn');

function setStatus(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? ` is-${kind}` : ''}`;
}

function setDirty(value) {
  state.dirty = value;
  saveBtn.disabled = !value || !state.path;
  document.title = value ? 'Content editor *' : 'Content editor';
}

async function api(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function hexColor(value) {
  const text = String(value || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : '#000000';
}

function applyTheme(colors) {
  if (!colors) return;
  const map = {
    bg: '--bg',
    bg_raised: '--bg-raised',
    ink: '--ink',
    ink_soft: '--ink-soft',
    ink_faint: '--ink-faint',
    line: '--line',
    line_strong: '--line-strong',
    accent: '--accent',
    accent_ink: '--accent-ink',
  };
  for (const [key, css] of Object.entries(map)) {
    if (colors[key]) document.documentElement.style.setProperty(css, colors[key]);
  }
}

function fileMatches(file) {
  if (state.highlightsOnly && !file.highlight && file.kind === 'sidecar') return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return file.path.toLowerCase().includes(q) || file.label.toLowerCase().includes(q);
}

function renderTree() {
  const parts = [];
  let lastSection = '';
  for (const group of state.groups) {
    const files = group.files.filter(fileMatches);
    if (!files.length) continue;
    if (group.section !== lastSection) {
      parts.push(`<p class="section-label">${escapeHtml(group.section)}</p>`);
      lastSection = group.section;
    }
    const closed = state.closed.has(group.id) && !state.query;
    const showToggle = Boolean(group.folder);
    parts.push(`<div class="group${closed ? ' is-closed' : ''}" data-group="${escapeHtml(group.id)}">`);
    if (showToggle) {
      parts.push(`<button type="button" class="group-btn" data-toggle="${escapeHtml(group.id)}"><span>${escapeHtml(group.label)}</span><span>${files.length}</span></button>`);
    }
    parts.push('<div class="files">');
    for (const file of files) {
      const on = file.path === state.path ? ' is-on' : '';
      const mark = file.highlight ? '<span class="mark" title="Highlight"></span>' : '';
      const name = file.path.endsWith('/readme.md') ? file.label : (group.folder ? file.path.split('/').pop().replace(/\.md$/, '') : file.label);
      parts.push(`<button type="button" class="file-btn${on}" data-path="${escapeHtml(file.path)}">${mark}<span class="name">${escapeHtml(name)}</span></button>`);
    }
    parts.push('</div></div>');
  }
  treeEl.innerHTML = parts.join('') || '<p class="empty" style="padding:1rem">No matching files.</p>';
}

function fieldValue(field, data) {
  const value = data[field.key];
  if (field.type === 'tags') return asList(value).join(', ');
  if (field.type === 'boolean') return Boolean(value);
  if (value == null) return '';
  return value;
}

function renderField(field, data) {
  const id = `f-${field.key}`;
  const value = fieldValue(field, data);
  const help = field.help ? `<p class="help">${escapeHtml(field.help)}</p>` : '';
  const wide = field.type === 'textarea' || field.type === 'tags' || field.key === 'alt' || field.key === 'caption' || field.key === 'summary';
  if (field.type === 'boolean') {
    return `<div class="field${wide ? ' wide' : ''}"><label class="toggle"><input type="checkbox" id="${id}" data-key="${field.key}" data-type="boolean"${value ? ' checked' : ''}><span>${escapeHtml(field.label)}</span></label>${help}</div>`;
  }
  if (field.type === 'textarea') {
    return `<div class="field wide"><label for="${id}">${escapeHtml(field.label)}</label><textarea id="${id}" data-key="${field.key}">${escapeHtml(value)}</textarea>${help}</div>`;
  }
  const type = field.type === 'number' ? 'number' : 'text';
  const step = field.key.includes('zoom') || field.key.includes('speed') ? '0.01' : '1';
  return `<div class="field${wide ? ' wide' : ''}"><label for="${id}">${escapeHtml(field.label)}</label><input id="${id}" type="${type}"${type === 'number' ? ` step="${step}"` : ''} data-key="${field.key}" value="${escapeHtml(value)}">${help}</div>`;
}

function renderMarkdownForm() {
  const fields = state.meta.fields[state.kind] || [];
  const bodyHelp = state.kind === 'sidecar'
    ? 'Optional write-up. Used as the story if the story field is empty.'
    : 'Markdown body shown on the page.';
  const preview = state.preview
    ? `<aside class="preview"><img src="/api/asset?path=${encodeURIComponent(state.preview)}" alt=""></aside>`
    : '';
  return `
    <div class="editor${state.preview ? ' has-preview' : ''}">
      <div>
        <div class="fields">${fields.map((field) => renderField(field, state.data)).join('')}</div>
        <div class="field wide" style="margin-top:1rem">
          <label for="body">Markdown body</label>
          <textarea id="body" class="body">${escapeHtml(state.content)}</textarea>
          <p class="help">${bodyHelp}</p>
        </div>
      </div>
      ${preview}
    </div>
  `;
}

function colorField(key, value) {
  const hex = hexColor(value);
  return `<div class="field">
    <label for="c-${key}">${escapeHtml(key)}</label>
    <div class="color-row">
      <input type="color" value="${hex}" data-color-for="${key}" ${/^#/.test(String(value || '')) ? '' : 'disabled'}>
      <input id="c-${key}" type="text" data-ctrl="colors.${key}" value="${escapeHtml(value || '')}">
    </div>
  </div>`;
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function renderControlsForm() {
  const c = state.data;
  const fonts = Object.entries(state.meta.introFonts || {});
  const nav = state.meta.navKeys || [];
  const timings = c.intro?.timings || {};
  const timingHelp = {
    letters_in: 'SKD enters',
    letters_dock: 'SKD docks left',
    canvas_open: 'Frame fills viewport',
    photo_in: 'Photo fades in',
    photo_zoom: 'Zoom-out starts',
    shutter: 'Shutters wipe',
    name_expand: 'Name expands',
    name_out: 'Name leaves',
    total: 'Counter length',
  };
  const sections = c.sections || {};
  const colors = c.colors || {};
  const items = new Set(c.selected_strip?.items || []);

  return `
    <div class="editor">
      <section class="block">
        <h2 class="block-title">Intro</h2>
        <div class="fields">
          <div class="field"><label class="toggle"><input type="checkbox" data-ctrl="intro.enabled"${c.intro?.enabled ? ' checked' : ''}><span>Enabled</span></label></div>
          <div class="field">
            <label for="play_on">Play on</label>
            <select id="play_on" data-ctrl="intro.play_on">
              <option value="reload"${c.intro?.play_on === 'reload' ? ' selected' : ''}>Every reload</option>
              <option value="once"${c.intro?.play_on === 'once' ? ' selected' : ''}>Once per visitor</option>
            </select>
          </div>
          <div class="field">
            <label for="zoom_start">Photo zoom start</label>
            <input id="zoom_start" type="number" step="0.01" data-ctrl="intro.photo_zoom_start" value="${escapeHtml(c.intro?.photo_zoom_start)}">
          </div>
          <div class="field">
            <label for="zoom_end">Photo zoom end</label>
            <input id="zoom_end" type="number" step="0.01" data-ctrl="intro.photo_zoom_end" value="${escapeHtml(c.intro?.photo_zoom_end)}">
          </div>
          <div class="field">
            <label for="fit">Landscape fit</label>
            <select id="fit" data-ctrl="intro.photo_fit_landscape">
              <option value="contain"${c.intro?.photo_fit_landscape === 'contain' ? ' selected' : ''}>contain</option>
              <option value="cover"${c.intro?.photo_fit_landscape === 'cover' ? ' selected' : ''}>cover</option>
            </select>
          </div>
        </div>
        <div class="fields" style="margin-top:0.6rem">
          ${Object.entries(timings).map(([key, value]) => `
            <div class="field">
              <label for="t-${key}">${escapeHtml(key)}</label>
              <input id="t-${key}" type="number" data-ctrl="intro.timings.${key}" value="${escapeHtml(value)}">
              <p class="help">${escapeHtml(timingHelp[key] || 'Milliseconds from page load')}</p>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Fonts</h2>
        <div class="fields">
          <div class="field wide">
            <label for="intro_choice">Intro face</label>
            <select id="intro_choice" data-ctrl="fonts.intro_choice">
              ${fonts.map(([key, spec]) => `<option value="${escapeHtml(key)}"${c.fonts?.intro_choice === key ? ' selected' : ''}>${escapeHtml(spec.name)}</option>`).join('')}
            </select>
            <p class="help">Fills intro stack, weight, and Google query from the catalog.</p>
          </div>
          <div class="field wide"><label for="f-display">Display</label><input id="f-display" data-ctrl="fonts.display" value="${escapeHtml(c.fonts?.display || '')}"></div>
          <div class="field wide"><label for="f-body">Body</label><input id="f-body" data-ctrl="fonts.body" value="${escapeHtml(c.fonts?.body || '')}"></div>
          <div class="field wide"><label for="f-mono">Mono</label><input id="f-mono" data-ctrl="fonts.mono" value="${escapeHtml(c.fonts?.mono || '')}"></div>
          <div class="field"><label for="f-dw">Display weight</label><input id="f-dw" type="number" data-ctrl="fonts.display_weight" value="${escapeHtml(c.fonts?.display_weight)}"></div>
          <div class="field"><label for="f-iw">Intro weight</label><input id="f-iw" type="number" data-ctrl="fonts.intro_weight" value="${escapeHtml(c.fonts?.intro_weight)}"></div>
          <div class="field wide"><label for="f-intro">Intro stack</label><input id="f-intro" data-ctrl="fonts.intro" value="${escapeHtml(c.fonts?.intro || '')}"></div>
          <div class="field wide"><label for="f-ig">Intro Google</label><input id="f-ig" data-ctrl="fonts.intro_google" value="${escapeHtml(c.fonts?.intro_google || '')}"></div>
          <div class="field wide"><label for="f-g">Body Google</label><input id="f-g" data-ctrl="fonts.google" value="${escapeHtml(c.fonts?.google || '')}"></div>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Colors</h2>
        <div class="swatches" id="swatches">${Object.entries(colors).map(([key, value]) => `<span class="swatch" title="${escapeHtml(key)}" style="background:${escapeHtml(value)}"></span>`).join('')}</div>
        <div class="fields">${Object.entries(colors).map(([key, value]) => colorField(key, value)).join('')}</div>
      </section>

      <section class="block">
        <h2 class="block-title">Sections</h2>
        <div class="checks">
          ${Object.entries(sections).map(([key, value]) => `
            <label><input type="checkbox" data-ctrl="sections.${key}"${value ? ' checked' : ''}><span>${escapeHtml(key)}</span></label>
          `).join('')}
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Selected strip</h2>
        <label class="toggle"><input type="checkbox" data-ctrl="selected_strip.enabled"${c.selected_strip?.enabled ? ' checked' : ''}><span>Enabled</span></label>
        <div class="checks" id="strip-items">
          ${nav.map((key) => `
            <label><input type="checkbox" data-strip="${escapeHtml(key)}"${items.has(key) ? ' checked' : ''}><span>${escapeHtml(key)}</span></label>
          `).join('')}
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Motion</h2>
        <div class="fields">
          <div class="field"><label class="toggle"><input type="checkbox" data-ctrl="motion.honor_reduced"${c.motion?.honor_reduced ? ' checked' : ''}><span>Honor reduced motion</span></label></div>
          <div class="field">
            <label for="stagger">Highlight stagger</label>
            <select id="stagger" data-ctrl="motion.highlight_stagger">
              ${['jitter', 'linear', 'none'].map((opt) => `<option value="${opt}"${c.motion?.highlight_stagger === opt ? ' selected' : ''}>${opt}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label for="speed">Scroll speed</label><input id="speed" type="number" step="0.05" data-ctrl="motion.scroll_speed" value="${escapeHtml(c.motion?.scroll_speed)}"></div>
          <div class="field"><label for="sspeed">Selected speed</label><input id="sspeed" type="number" step="0.05" data-ctrl="motion.selected_scroll_speed" value="${escapeHtml(c.motion?.selected_scroll_speed)}"></div>
          <div class="field"><label for="tspeed">Timeline speed</label><input id="tspeed" type="number" step="0.05" data-ctrl="motion.timeline_scroll_speed" value="${escapeHtml(c.motion?.timeline_scroll_speed)}"></div>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Layout</h2>
        <div class="fields">
          <div class="field"><label for="hh">Highlight track min height</label><input id="hh" data-ctrl="layout.highlight_track_min_height" value="${escapeHtml(c.layout?.highlight_track_min_height || '')}"></div>
          <div class="field"><label for="sh">Selected min height</label><input id="sh" data-ctrl="layout.selected_min_height" value="${escapeHtml(c.layout?.selected_min_height || '')}"></div>
        </div>
      </section>
    </div>
  `;
}

function renderEditor() {
  pathEl.textContent = state.path || 'Pick a file';
  if (!state.path) {
    workspace.innerHTML = '<p class="empty">Choose a markdown file or site controls from the left.</p>';
    return;
  }
  if (state.mode === 'source') {
    workspace.innerHTML = `<textarea class="source" id="source">${escapeHtml(state.raw)}</textarea>`;
    return;
  }
  workspace.innerHTML = state.kind === 'controls' ? renderControlsForm() : renderMarkdownForm();
  if (state.kind === 'controls') applyTheme(state.data.colors);
}

function readMarkdownForm() {
  const fields = state.meta.fields[state.kind] || [];
  const next = { ...state.data };
  for (const field of fields) {
    const el = document.getElementById(`f-${field.key}`);
    if (!el) continue;
    if (field.type === 'boolean') next[field.key] = el.checked;
    else if (field.type === 'tags') next[field.key] = asList(el.value);
    else if (field.type === 'number') next[field.key] = el.value === '' ? '' : Number(el.value);
    else next[field.key] = el.value;
  }
  const body = document.getElementById('body');
  return { data: next, content: body ? body.value : state.content };
}

function readControlsForm() {
  const next = structuredClone(state.data);
  for (const el of workspace.querySelectorAll('[data-ctrl]')) {
    let value;
    if (el.type === 'checkbox') value = el.checked;
    else if (el.type === 'number') value = el.value === '' ? '' : Number(el.value);
    else value = el.value;
    setPath(next, el.dataset.ctrl, value);
  }
  const items = [...workspace.querySelectorAll('[data-strip]:checked')].map((el) => el.dataset.strip);
  if (!next.selected_strip) next.selected_strip = {};
  next.selected_strip.items = items;
  return next;
}

function syncFormToState() {
  if (!state.path || state.mode !== 'form') return;
  if (state.kind === 'controls') state.data = readControlsForm();
  else {
    const next = readMarkdownForm();
    state.data = next.data;
    state.content = next.content;
  }
}

async function syncSourceFromForm() {
  syncFormToState();
  const payload = state.kind === 'controls'
    ? { path: state.path, controls: state.data }
    : { path: state.path, data: state.data, content: state.content };
  const { raw } = await api('/api/serialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  state.raw = raw;
}

function captureSource() {
  const source = document.getElementById('source');
  if (source) state.raw = source.value;
}

async function openFile(relPath, force = false) {
  if (!force && state.dirty && !window.confirm('Discard unsaved changes?')) return;
  const file = await api(`/api/file?path=${encodeURIComponent(relPath)}`);
  state.path = file.path;
  state.kind = file.kind;
  state.data = file.data;
  state.content = file.content || '';
  state.raw = file.raw;
  state.preview = file.preview;
  const group = state.groups.find((item) => item.files.some((entry) => entry.path === relPath));
  if (group) state.closed.delete(group.id);
  setDirty(false);
  setStatus('');
  renderTree();
  renderEditor();
  const url = new URL(window.location.href);
  url.searchParams.set('file', relPath);
  history.replaceState(null, '', url);
  sidebar.classList.remove('is-open');
}

async function save() {
  if (!state.path) return;
  try {
    setStatus('Saving…');
    let payload;
    if (state.mode === 'source') {
      captureSource();
      payload = { path: state.path, raw: state.raw, mode: 'source' };
    } else {
      syncFormToState();
      payload = state.kind === 'controls'
        ? { path: state.path, controls: state.data }
        : { path: state.path, data: state.data, content: state.content };
    }
    const file = await writeAndRefresh(payload);
    state.path = file.path;
    state.kind = file.kind;
    state.data = file.data;
    state.content = file.content || '';
    state.raw = file.raw;
    state.preview = file.preview;
    setDirty(false);
    setStatus('Saved', 'ok');
    if (state.kind === 'controls') applyTheme(state.data.colors);
    const groups = await api('/api/tree');
    state.groups = groups.groups;
    renderTree();
  } catch (err) {
    setStatus(err.message, 'err');
  }
}

async function writeAndRefresh(payload) {
  return api('/api/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function rebuild() {
  try {
    rebuildBtn.disabled = true;
    setStatus('Rebuilding site…');
    const result = await api('/api/rebuild', { method: 'POST' });
    let log = document.getElementById('build-log');
    if (!log) {
      log = document.createElement('pre');
      log.id = 'build-log';
      log.className = 'log';
      workspace.appendChild(log);
    }
    log.textContent = result.output || 'Build finished.';
    setStatus(result.ok ? 'Rebuild done' : 'Rebuild failed', result.ok ? 'ok' : 'err');
  } catch (err) {
    setStatus(err.message, 'err');
  } finally {
    rebuildBtn.disabled = false;
  }
}

async function switchMode(mode) {
  if (mode === state.mode) return;
  try {
    if (state.path && state.mode === 'form' && mode === 'source') await syncSourceFromForm();
    if (state.path && state.mode === 'source' && mode === 'form') {
      captureSource();
      const file = await api('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: state.path, raw: state.raw }),
      });
      state.data = file.data;
      state.content = file.content || '';
      state.raw = file.raw;
    }
    state.mode = mode;
    $('mode-form').classList.toggle('is-on', mode === 'form');
    $('mode-source').classList.toggle('is-on', mode === 'source');
    renderEditor();
  } catch (err) {
    setStatus(err.message, 'err');
  }
}

treeEl.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle]');
  if (toggle) {
    const id = toggle.dataset.toggle;
    if (state.closed.has(id)) state.closed.delete(id);
    else state.closed.add(id);
    renderTree();
    return;
  }
  const file = event.target.closest('[data-path]');
  if (file) openFile(file.dataset.path);
});

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  renderTree();
});

highlightsEl.addEventListener('change', () => {
  state.highlightsOnly = highlightsEl.checked;
  renderTree();
});

workspace.addEventListener('input', (event) => {
  const target = event.target;
  if (target.dataset.colorFor) return;
  if (target.matches('input, textarea, select')) setDirty(true);
  if (target.dataset.ctrl?.startsWith('colors.')) {
    syncFormToState();
    applyTheme(state.data.colors);
    const swatches = document.getElementById('swatches');
    if (swatches) {
      swatches.innerHTML = Object.entries(state.data.colors || {})
        .map(([key, value]) => `<span class="swatch" title="${escapeHtml(key)}" style="background:${escapeHtml(value)}"></span>`)
        .join('');
    }
  }
});

workspace.addEventListener('change', (event) => {
  const target = event.target;
  if (target.dataset.colorFor) {
    const key = target.dataset.colorFor;
    const input = document.getElementById(`c-${key}`);
    if (input) input.value = target.value;
    setDirty(true);
    syncFormToState();
    applyTheme(state.data.colors);
    return;
  }
  if (target.dataset.ctrl === 'fonts.intro_choice') {
    const spec = state.meta.introFonts[target.value];
    if (spec) {
      const map = {
        'fonts.intro': spec.stack,
        'fonts.intro_weight': spec.weight,
        'fonts.intro_google': spec.google,
      };
      for (const [ctrl, value] of Object.entries(map)) {
        const el = workspace.querySelector(`[data-ctrl="${ctrl}"]`);
        if (el) el.value = value;
      }
    }
  }
  if (target.matches('input, textarea, select')) setDirty(true);
});

saveBtn.addEventListener('click', save);
rebuildBtn.addEventListener('click', rebuild);
$('mode-form').addEventListener('click', () => switchMode('form'));
$('mode-source').addEventListener('click', () => switchMode('source'));

menuBtn.addEventListener('click', () => sidebar.classList.toggle('is-open'));

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

async function boot() {
  try {
    const [tree, meta] = await Promise.all([api('/api/tree'), api('/api/meta')]);
    state.groups = tree.groups;
    state.meta = meta;
    for (const group of state.groups) {
      if (group.folder) state.closed.add(group.id);
    }
    renderTree();
    const wanted = new URL(window.location.href).searchParams.get('file');
    if (wanted) await openFile(wanted, true);
  } catch (err) {
    setStatus(err.message, 'err');
  }
}

boot();
