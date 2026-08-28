import { renderPicture, escapeHtml } from './partials.js';

function renderHighlightItem(highlight, index) {
  const { image, title, href } = highlight;
  const subLabel = (image.tags || []).filter((t) => t !== title.toLowerCase())
    .map((t) => t[0].toUpperCase() + t.slice(1))
    .join(' · ');
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

function renderTeaserCard(collection) {
  return `<a class="card" href="${collection.href}">
    <div class="frame">${collection.cover ? renderPicture(collection.cover, { sizes: '(min-width: 800px) 30vw, 90vw' }) : ''}</div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(collection.title)}</div>
      <div class="card-meta">${escapeHtml(collection.type === 'series' ? 'Series' : 'Project')}${collection.year ? ' · ' + collection.year : ''}</div>
    </div>
  </a>`;
}

export function renderHome(data) {
  const { owner, highlights, series, projects, about, flags, introHero } = data;
  const teaserCollections = [...series, ...projects].slice(0, 6);

  return `
  <section class="hero">
    <div class="hero-lead wrap">
      <div class="hero-top-row">
        <h1 class="hero-heading">Streets, unscripted.</h1>
        <span class="hero-count">(${highlights.length})</span>
      </div>
      <p class="hero-sub">${escapeHtml(owner.tagline)}</p>
      <div class="scroll-hint"><span class="stem"></span> Scroll</div>
    </div>
    ${introHero?.rendered ? `
    <div class="hero-featured wrap">
      <div class="hero-featured-frame">
        ${renderPicture(introHero, { sizes: '(min-width: 900px) 86vw, 94vw', loading: 'eager', fetchpriority: 'high' })}
      </div>
    </div>` : ''}
    <div class="highlight-track">
      ${highlights.map((h, i) => renderHighlightItem(h, i)).join('\n')}
    </div>
  </section>

  <section class="section on-dark">
    <div class="wrap about-layout">
      <div>
        <p class="label label-paren">About</p>
        <h2 style="margin-top: 1rem; font-size: clamp(2rem, 5vw, 3.25rem);">Get to know ${escapeHtml(owner.name.split(' ')[0])}</h2>
        <div class="about-copy" style="margin-top: 1.5rem;">${about.html.split('</p>').filter(Boolean).slice(0, 2).join('</p>') + '</p>'}</div>
        <a class="btn" style="margin-top: 2rem;" href="/about/">Read the full story →</a>
      </div>
      <dl class="about-facts">
        <div class="fact"><dt>Based in</dt><dd>Bangalore, India</dd></div>
        <div class="fact"><dt>Hometown</dt><dd>Kolkata, India</dd></div>
        <div class="fact"><dt>Camera</dt><dd><a class="text-link" href="/gear/">Ricoh GR IIIx</a></dd></div>
      </dl>
    </div>
  </section>

  ${teaserCollections.length ? `
  <section class="section wrap">
    <div class="section-head">
      <h2 style="font-size: clamp(1.75rem, 4vw, 2.5rem);">Explore the work</h2>
      ${flags.hasSeries ? `<a class="text-link" href="/series/">All series →</a>` : ''}
    </div>
    <div class="grid">
      ${teaserCollections.map(renderTeaserCard).join('\n')}
    </div>
  </section>` : ''}
  `;
}
