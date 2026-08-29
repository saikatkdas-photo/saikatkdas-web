import { renderPicture, lightboxTriggerAttrs, escapeHtml } from './partials.js';

function fracHash(seed) {
  const n = Math.sin(seed) * 43758.5453;
  return n - Math.floor(n);
}

function highlightJitter(index, image) {
  const ratio = image?.rendered?.width && image?.rendered?.height
    ? image.rendered.width / image.rendered.height
    : 1.5;
  const u = Math.abs(fracHash((index + 1) * 12.9898));
  const v = Math.abs(fracHash((index + 1) * 78.233));
  const w = Math.abs(fracHash((index + 1) * 39.346));
  const shape = ratio > 1.2 ? 'land' : ratio < 0.86 ? 'port' : 'sq';
  let wVw;
  let liftVh;
  let align;
  if (shape === 'land') {
    // Short frames: scatter through the leftover vertical band
    wVw = 56 + u * 24;
    const band = Math.floor(w * 3);
    align = band === 0 ? 'start' : band === 1 ? 'center' : 'end';
    liftVh = 5 + v * 16;
  } else if (shape === 'port') {
    wVw = 36 + u * 16;
    align = w > 0.5 ? 'start' : 'center';
    liftVh = 1 + v * 7;
  } else {
    wVw = 46 + u * 16;
    align = w > 0.66 ? 'end' : w > 0.33 ? 'center' : 'start';
    liftVh = 3 + v * 12;
  }
  return { shape, wVw, liftVh, align };
}

function parentKind(collection) {
  if (!collection) return 'Series';
  if (collection.type === 'project') return 'Project';
  if (collection.type === 'untitled') return 'Untitled';
  return 'Series';
}

function renderHighlightItem(highlight, index, stagger) {
  const { image, title, href, collection } = highlight;
  const tagged = (image.tags || []).filter((t) => t !== title.toLowerCase());
  const first = tagged[0] || '';
  const subLabel = first ? first[0].toUpperCase() + first.slice(1) : '';
  const jitter = stagger === 'jitter' ? highlightJitter(index, image) : { shape: 'sq', wVw: 72, liftVh: 0, align: 'end' };
  const ratio = image?.rendered?.width && image?.rendered?.height
    ? image.rendered.width / image.rendered.height
    : 1.5;
  const style = stagger === 'none'
    ? `--hi-i:${index}; --ar:${ratio.toFixed(4)}`
    : `--hi-i:${index}; --hi-w:${jitter.wVw}vw; --hi-lift:${jitter.liftVh}vh; --ar:${ratio.toFixed(4)}`;
  const kind = parentKind(collection);
  const parentHref = image.sheet?.href || collection?.href || href;
  return `<a class="highlight-item" href="${parentHref}" data-shape="${jitter.shape}" data-align="${jitter.align}" style="${style}" data-lightbox-group="highlights" ${lightboxTriggerAttrs(image)}>
    <div class="highlight-media" data-highlight-card>
      <div class="frame">
        ${renderPicture(image, { sizes: '(min-width: 800px) 50vw, 78vw', loading: index === 0 ? 'eager' : 'lazy', fetchpriority: index === 0 ? 'high' : undefined })}
      </div>
    </div>
    <div class="highlight-caption">
      <span>
        <span class="title">${escapeHtml(title)}</span><br>
        <span class="meta">${escapeHtml(subLabel || kind)}</span>
      </span>
    </div>
  </a>`;
}

function renderWorkPreview(collection) {
  const kind = collection.type === 'series' ? 'Series' : 'Project';
  return `<a class="work-preview" href="${collection.href}">
    <div class="work-preview-media">
      ${collection.cover ? renderPicture(collection.cover, { sizes: '100vw', loading: 'lazy' }) : ''}
    </div>
    <span class="work-preview-caption">
      <span class="work-preview-name">${escapeHtml(collection.title)}</span>
      <span class="work-preview-kind">${escapeHtml(kind)}${collection.year ? ' ' + collection.year : ''}</span>
    </span>
  </a>`;
}

function renderSelectedStrip(nav, flags, controls) {
  if (!flags.hasSelectedStrip) return '';
  const keys = controls.selected_strip?.items || ['series', 'themes', 'about'];
  const items = keys
    .map((key) => nav.find((item) => item.key === key))
    .filter((item) => {
      if (!item) return false;
      if (item.key === 'about') return true;
      const flagKey = `has${item.key[0].toUpperCase()}${item.key.slice(1)}`;
      return flags[flagKey];
    });
  if (!items.length) return '';
  return `<nav class="selected-strip" aria-label="Sections">
    ${items.map((item, i) => `${i ? '<span class="selected-strip-star" aria-hidden="true">*</span>' : ''}<a href="${item.href}">${escapeHtml(item.label.toLowerCase())}</a>`).join('')}
  </nav>`;
}

export function renderHome(data) {
  const { owner, highlights, series, projects, about, introHero, flags, controls, nav } = data;
  const workCollections = [...series, ...projects];
  const stagger = controls?.motion?.highlight_stagger || 'jitter';

  return `
  ${flags.hasHero ? `<section class="hero">
    <div class="hero-lead wrap">
      <div class="hero-top-row">
        <h1 class="hero-heading">Streets, unscripted.</h1>
        <span class="hero-count">(${highlights.length})</span>
      </div>
      <p class="hero-sub">${escapeHtml(owner.tagline)}</p>
    </div>
    ${introHero?.rendered ? `
    <div class="hero-featured wrap">
      <div class="hero-featured-frame">
        ${renderPicture(introHero, { sizes: '(min-width: 900px) 86vw, 94vw', loading: 'eager', fetchpriority: 'high' })}
      </div>
    </div>` : ''}
  </section>` : ''}

  ${flags.hasSelected ? `<section class="selected" data-selected>
    <div class="selected-sticky" data-selected-sticky>
      <div class="selected-head wrap">
        <h2 class="selected-title">Selected</h2>
        <span class="selected-count">(${highlights.length})</span>
      </div>
      <div class="highlight-track" data-highlight-track data-stagger="${stagger}" tabindex="-1" aria-label="Selected photographs">
        <div class="highlight-rail" data-highlight-rail>
          <div class="highlight-spacer" aria-hidden="true"></div>
          ${highlights.map((h, i) => renderHighlightItem(h, i, stagger)).join('\n')}
          <div class="highlight-spacer" aria-hidden="true"></div>
        </div>
      </div>
      ${renderSelectedStrip(nav, flags, controls)}
    </div>
  </section>` : ''}

  ${flags.hasWorkPreviews && workCollections.length ? `
  <section class="work-previews">
    ${workCollections.map(renderWorkPreview).join('\n')}
  </section>` : ''}

  ${flags.hasAboutTeaser ? `<section class="section on-dark">
    <div class="wrap about-layout">
      <div>
        <h2 style="margin-top: 0; font-size: clamp(2rem, 5vw, 3.25rem);">Get to know ${escapeHtml(owner.name.split(' ')[0])}</h2>
        <div class="about-copy" style="margin-top: 1.5rem;">${about.html.split('</p>').filter(Boolean).slice(0, 2).join('</p>') + '</p>'}</div>
        <a class="btn" style="margin-top: 2rem;" href="/about/">Read the full story</a>
      </div>
      <dl class="about-facts">
        <div class="fact"><dt>Based in</dt><dd>Bangalore, India</dd></div>
        <div class="fact"><dt>Hometown</dt><dd>Kolkata, India</dd></div>
        <div class="fact"><dt>Camera</dt><dd><a class="text-link" href="/gear/">Ricoh GR IIIx</a></dd></div>
      </dl>
    </div>
  </section>` : ''}
  `;
}
