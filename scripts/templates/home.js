import { renderPicture, escapeHtml } from './partials.js';

function renderHighlightItem(highlight, index) {
  const { image, title, href } = highlight;
  const tagged = (image.tags || []).filter((t) => t !== title.toLowerCase());
  const first = tagged[0] || '';
  const subLabel = first ? first[0].toUpperCase() + first.slice(1) : '';
  return `<a class="highlight-item" href="${href}" style="--hi-i:${index}">
    <div class="frame">
      ${renderPicture(image, { sizes: '(min-width: 800px) 50vw, 92vw', loading: index === 0 ? 'eager' : 'lazy', fetchpriority: index === 0 ? 'high' : undefined })}
    </div>
    <div class="highlight-caption">
      <span>
        <span class="title">${escapeHtml(title)}</span><br>
        <span class="meta">${escapeHtml(subLabel || 'Series')}</span>
      </span>
      <span class="arrow" aria-hidden="true">↗</span>
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

export function renderHome(data) {
  const { owner, highlights, series, projects, about, introHero } = data;
  const workCollections = [...series, ...projects];

  return `
  <section class="hero">
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
  </section>

  <section class="selected" data-selected>
    <div class="selected-sticky" data-selected-sticky>
      <div class="selected-head wrap">
        <h2 class="selected-title">Selected</h2>
        <span class="selected-count">(${highlights.length})</span>
      </div>
      <div class="highlight-track" data-highlight-track>
        ${highlights.map((h, i) => renderHighlightItem(h, i)).join('\n')}
      </div>
    </div>
  </section>

  ${workCollections.length ? `
  <section class="work-previews">
    ${workCollections.map(renderWorkPreview).join('\n')}
  </section>` : ''}

  <section class="section on-dark">
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
  </section>
  `;
}
