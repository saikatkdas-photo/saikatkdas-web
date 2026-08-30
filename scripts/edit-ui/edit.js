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
  view: 'file',
  tools: { collections: [], shortcuts: [], browse: null },
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
const toolsBtn = $('tools-btn');

function setStatus(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? ` is-${kind}` : ''}`;
}

function setDirty(value) {
  state.dirty = value;
  saveBtn.disabled = !value || !state.path || state.view === 'tools';
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

function collectionOptions(selected = '') {
  return state.tools.collections.map((item) => {
    const label = `${item.rel}  (${item.images} photo${item.images === 1 ? '' : 's'})`;
    return `<option value="${escapeHtml(item.rel)}"${item.rel === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function renderTools() {
  const collections = collectionOptions();
  const sources = state.tools.collections.map((item) => `
    <label><input type="checkbox" name="merge-source" value="${escapeHtml(item.rel)}"><span>${escapeHtml(item.rel)}</span></label>
  `).join('');
  const shortcuts = (state.tools.shortcuts || []).map((item) => `
    <button type="button" class="ghost" data-browse-to="${escapeHtml(item.path)}">${escapeHtml(item.label)}</button>
  `).join('');
  return `
    <div class="tools">
      <p class="tools-lead">Run the same import, merge, and scaffold scripts from here. Destinations stay inside the repo. Dry run prints a plan without writing.</p>

      <section class="block">
        <h2 class="block-title">Import photos</h2>
        <p class="help">Copy or move a folder of images into a series, project, or Untitled. Writes sidecars and thumbnails.</p>
        <div class="fields">
          <div class="field wide">
            <label for="import-source">Source folder</label>
            <input id="import-source" type="text" placeholder="/path/to/exported/photos" autocomplete="off">
          </div>
          <div class="field wide">
            <div class="tool-actions">${shortcuts}<button type="button" class="ghost" id="browse-source">Browse</button></div>
            <div id="browse-panel"></div>
          </div>
          <div class="field wide">
            <label for="import-dest">Destination</label>
            <select id="import-dest">
              <option value="">Choose a folder</option>
              ${collections}
              <option value="__custom">New folder…</option>
            </select>
          </div>
          <div class="field wide" id="import-dest-custom-wrap" hidden>
            <label for="import-dest-custom">New destination</label>
            <input id="import-dest-custom" type="text" placeholder="series/new-name">
            <p class="help">Must start with series/, projects/, or photos/</p>
          </div>
          <div class="field"><label for="import-place">Place</label><input id="import-place" type="text" placeholder="kolkata"></div>
          <div class="field"><label for="import-tags">Extra tags</label><input id="import-tags" type="text" placeholder="market, night"></div>
          <div class="field wide"><label for="import-link">Highlight link</label><input id="import-link" type="text" placeholder="/series/japan/"></div>
          <div class="field"><label class="toggle"><input type="checkbox" id="import-highlight"><span>Mark as highlights</span></label></div>
          <div class="field"><label for="import-hstart">Highlight start order</label><input id="import-hstart" type="number" step="1"></div>
          <div class="field"><label class="toggle"><input type="checkbox" id="import-keep-names"><span>Keep filenames</span></label></div>
          <div class="field"><label class="toggle"><input type="checkbox" id="import-move"><span>Move instead of copy</span></label></div>
          <div class="field"><label class="toggle"><input type="checkbox" id="import-dry" checked><span>Dry run first</span></label></div>
        </div>
        <div class="tool-actions">
          <button type="button" class="primary" data-run="import">Import</button>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">New series or project</h2>
        <p class="help">Creates a folder and readme.md. Import photos into it after.</p>
        <div class="fields">
          <div class="field">
            <label for="new-type">Type</label>
            <select id="new-type">
              <option value="series">Series</option>
              <option value="project">Project</option>
            </select>
          </div>
          <div class="field"><label for="new-title">Title</label><input id="new-title" type="text"></div>
          <div class="field"><label for="new-slug">Slug</label><input id="new-slug" type="text" placeholder="auto from title"></div>
          <div class="field"><label for="new-year">Year</label><input id="new-year" type="number" value="${new Date().getFullYear()}"></div>
          <div class="field wide"><label for="new-summary">Summary</label><input id="new-summary" type="text"></div>
          <div class="field wide"><label for="new-tags">Tags</label><input id="new-tags" type="text" placeholder="market, street"></div>
          <div class="field wide" id="new-project-fields" hidden>
            <div class="fields">
              <div class="field"><label for="new-client">Client</label><input id="new-client" type="text"></div>
              <div class="field"><label for="new-industry">Industry</label><input id="new-industry" type="text"></div>
              <div class="field wide"><label for="new-services">Services</label><input id="new-services" type="text"></div>
            </div>
          </div>
          <div class="field wide"><label for="new-body">Write-up</label><textarea id="new-body"></textarea></div>
        </div>
        <div class="tool-actions">
          <button type="button" class="primary" data-run="new">Create</button>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Merge folders</h2>
        <p class="help">Combine collection folders. Incoming frames are numbered after what is already in the destination.</p>
        <div class="fields">
          <div class="field wide">
            <label for="merge-dest">Destination</label>
            <select id="merge-dest">
              <option value="">Choose a folder</option>
              ${collections}
              <option value="__custom">New folder…</option>
            </select>
          </div>
          <div class="field wide" id="merge-dest-custom-wrap" hidden>
            <label for="merge-dest-custom">New destination</label>
            <input id="merge-dest-custom" type="text" placeholder="series/markets">
          </div>
          <div class="field wide">
            <span class="help">Sources to merge in</span>
            <div class="checks">${sources || '<p class="help">No collection folders yet.</p>'}</div>
          </div>
          <div class="field"><label class="toggle"><input type="checkbox" id="merge-slug"><span>Slugify dest name</span></label></div>
          <div class="field"><label class="toggle"><input type="checkbox" id="merge-repack"><span>Repack dest numbers</span></label></div>
          <div class="field"><label class="toggle"><input type="checkbox" id="merge-keep-names"><span>Keep incoming names</span></label></div>
          <div class="field"><label class="toggle"><input type="checkbox" id="merge-move"><span>Move instead of copy</span></label></div>
          <div class="field"><label class="toggle"><input type="checkbox" id="merge-dry" checked><span>Dry run first</span></label></div>
        </div>
        <div class="tool-actions">
          <button type="button" class="primary" data-run="merge">Merge</button>
          <button type="button" class="ghost" data-run="scan">Scan for duplicates</button>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">Other</h2>
        <p class="help">Thumbs writes missing 320px siblings. Promote places copies kolkata / bangalore off tags onto place.</p>
        <label class="toggle"><input type="checkbox" id="util-dry"><span>Dry run</span></label>
        <div class="tool-actions">
          <button type="button" class="ghost" data-run="thumbs">Write missing thumbs</button>
          <button type="button" class="ghost" data-run="promote-places">Promote places</button>
        </div>
      </section>

      <pre class="log" id="tool-log" hidden></pre>
    </div>
  `;
}

function renderEditor() {
  document.body.classList.toggle('is-tools', state.view === 'tools');
  toolsBtn.classList.toggle('is-on', state.view === 'tools');
  if (state.view === 'tools') {
    pathEl.textContent = 'Tools';
    workspace.innerHTML = renderTools();
    paintBrowse();
    return;
  }
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

function paintBrowse() {
  const mount = document.getElementById('browse-panel');
  if (!mount) return;
  const browse = state.tools.browse;
  if (!browse) {
    mount.innerHTML = '';
    return;
  }
  mount.innerHTML = `
    <div class="browse">
      <p class="browse-path">${escapeHtml(browse.path)}</p>
      <div class="tool-actions">
        ${browse.parent ? `<button type="button" class="ghost" data-browse-to="${escapeHtml(browse.parent)}">Up</button>` : ''}
        <button type="button" class="ghost" data-use-folder="${escapeHtml(browse.path)}">Use this folder</button>
      </div>
      <div class="browse-list">
        ${(browse.dirs || []).map((dir) => `<button type="button" data-browse-to="${escapeHtml(dir.path)}">${escapeHtml(dir.name)}</button>`).join('') || '<p class="help">No subfolders</p>'}
      </div>
      <p class="browse-meta">${browse.images} image${browse.images === 1 ? '' : 's'} in this folder</p>
    </div>
  `;
}

function showToolLog(text) {
  const log = document.getElementById('tool-log');
  if (!log) return;
  log.hidden = !text;
  log.textContent = text || '';
}

function chosenDest(selectId, customId) {
  const select = document.getElementById(selectId);
  if (!select) return '';
  if (select.value === '__custom') return document.getElementById(customId)?.value.trim() || '';
  return select.value;
}

async function refreshCollections() {
  const meta = await api('/api/tools/meta');
  state.tools.collections = meta.collections || [];
  state.tools.shortcuts = meta.shortcuts || [];
}

async function openTools(force = false) {
  if (!force && state.dirty && !window.confirm('Discard unsaved changes?')) return;
  setDirty(false);
  state.view = 'tools';
  setStatus('');
  await refreshCollections();
  renderTree();
  renderEditor();
  const url = new URL(window.location.href);
  url.searchParams.delete('file');
  url.searchParams.set('view', 'tools');
  history.replaceState(null, '', url);
  sidebar.classList.remove('is-open');
}

async function openFile(relPath, force = false) {
  if (!force && state.dirty && !window.confirm('Discard unsaved changes?')) return;
  state.view = 'file';
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
  url.searchParams.delete('view');
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
  if (state.view === 'tools') return;
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
  if (state.view === 'tools') {
    const destSelects = { 'import-dest': 'import-dest-custom-wrap', 'merge-dest': 'merge-dest-custom-wrap' };
    if (destSelects[event.target.id]) {
      document.getElementById(destSelects[event.target.id]).hidden = event.target.value !== '__custom';
    }
    if (event.target.id === 'new-type') {
      document.getElementById('new-project-fields').hidden = event.target.value !== 'project';
    }
    return;
  }
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
toolsBtn.addEventListener('click', () => openTools());

menuBtn.addEventListener('click', () => sidebar.classList.toggle('is-open'));

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (state.view !== 'tools') save();
  }
});

async function loadBrowse(dirPath) {
  state.tools.browse = await api(`/api/tools/browse?path=${encodeURIComponent(dirPath || '')}`);
  paintBrowse();
}

async function postTool(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !body.output) throw new Error(body.error || res.statusText);
  return body;
}

async function runTool(name) {
  const buttons = [...workspace.querySelectorAll('[data-run]')];
  buttons.forEach((btn) => { btn.disabled = true; });
  try {
    let output = '';
    let ok = true;
    if (name === 'import') {
      setStatus('Importing…');
      const result = await postTool('/api/tools/import', {
        source: document.getElementById('import-source').value.trim(),
        dest: chosenDest('import-dest', 'import-dest-custom'),
        place: document.getElementById('import-place').value.trim(),
        tags: document.getElementById('import-tags').value.trim(),
        link: document.getElementById('import-link').value.trim(),
        highlight: document.getElementById('import-highlight').checked,
        highlightStart: document.getElementById('import-hstart').value,
        keepNames: document.getElementById('import-keep-names').checked,
        move: document.getElementById('import-move').checked,
        dryRun: document.getElementById('import-dry').checked,
      });
      output = result.output || '';
      ok = result.ok !== false;
      setStatus(ok ? (document.getElementById('import-dry').checked ? 'Dry run done' : 'Imported') : 'Import failed', ok ? 'ok' : 'err');
    } else if (name === 'new') {
      setStatus('Creating…');
      const created = await api('/api/tools/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: document.getElementById('new-type').value,
          title: document.getElementById('new-title').value,
          slug: document.getElementById('new-slug').value,
          year: document.getElementById('new-year').value,
          summary: document.getElementById('new-summary').value,
          tags: document.getElementById('new-tags').value,
          client: document.getElementById('new-client')?.value || '',
          industry: document.getElementById('new-industry')?.value || '',
          services: document.getElementById('new-services')?.value || '',
          body: document.getElementById('new-body').value,
        }),
      });
      output = `Created ${created.path}`;
      setStatus('Created', 'ok');
    } else if (name === 'merge') {
      setStatus('Merging…');
      const sources = [...document.querySelectorAll('input[name="merge-source"]:checked')].map((el) => el.value);
      const result = await postTool('/api/tools/merge', {
        dest: chosenDest('merge-dest', 'merge-dest-custom'),
        sources,
        slug: document.getElementById('merge-slug').checked,
        repack: document.getElementById('merge-repack').checked,
        keepNames: document.getElementById('merge-keep-names').checked,
        move: document.getElementById('merge-move').checked,
        dryRun: document.getElementById('merge-dry').checked,
      });
      output = result.output || '';
      ok = result.ok !== false;
      setStatus(ok ? (document.getElementById('merge-dry').checked ? 'Dry run done' : 'Merged') : 'Merge failed', ok ? 'ok' : 'err');
    } else if (name === 'scan') {
      setStatus('Scanning…');
      const result = await postTool('/api/tools/scan');
      output = result.output || '';
      ok = result.ok !== false;
      setStatus(ok ? 'Scan done' : 'Scan failed', ok ? 'ok' : 'err');
    } else if (name === 'thumbs' || name === 'promote-places') {
      setStatus(name === 'thumbs' ? 'Writing thumbs…' : 'Promoting places…');
      const result = await postTool(`/api/tools/${name}`, { dryRun: document.getElementById('util-dry').checked });
      output = result.output || '';
      ok = result.ok !== false;
      setStatus(ok ? 'Done' : 'Failed', ok ? 'ok' : 'err');
    }
    const groups = await api('/api/tree');
    state.groups = groups.groups;
    await refreshCollections();
    renderTree();
    if (name === 'new' || name === 'merge') renderEditor();
    showToolLog(output);
  } catch (err) {
    showToolLog(err.message);
    setStatus(err.message, 'err');
  } finally {
    buttons.forEach((btn) => { btn.disabled = false; });
  }
}

workspace.addEventListener('click', (event) => {
  if (state.view !== 'tools') return;
  const run = event.target.closest('[data-run]');
  if (run) {
    runTool(run.dataset.run);
    return;
  }
  if (event.target.id === 'browse-source') {
    const current = document.getElementById('import-source').value.trim();
    loadBrowse(current).catch((err) => setStatus(err.message, 'err'));
    return;
  }
  const jump = event.target.closest('[data-browse-to]');
  if (jump) {
    loadBrowse(jump.dataset.browseTo).catch((err) => setStatus(err.message, 'err'));
    return;
  }
  const use = event.target.closest('[data-use-folder]');
  if (use) {
    document.getElementById('import-source').value = use.dataset.useFolder;
    setStatus(`Source set to ${use.dataset.useFolder}`);
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
    const params = new URL(window.location.href).searchParams;
    if (params.get('view') === 'tools') await openTools(true);
    else if (params.get('file')) await openFile(params.get('file'), true);
  } catch (err) {
    setStatus(err.message, 'err');
  }
}

boot();
