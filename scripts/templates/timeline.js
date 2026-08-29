import { renderPicture, lightboxTriggerAttrs, escapeHtml } from './partials.js';
import { renderGalleryItem } from './collectionDetail.js';

export function renderTimeline(years) {
  const total = years.reduce((n, y) => n + y.images.length, 0);
  return `
  <section class="hero wrap">
    <div class="hero-top-row">
      <h1 class="hero-heading">Timeline</h1>
      <span class="hero-count">(${total})</span>
    </div>
    <p class="hero-sub">The work, year by year.</p>
  </section>
  <div class="timeline">
    ${years.map((block, i) => renderYear(block, i)).join('\n')}
  </div>`;
}

function renderYear(block, index) {
  const group = `year-${block.year}`;
  const hero = block.hero;
  return `
  <section class="timeline-year wrap">
    <header class="timeline-year-head">
      <h2 class="timeline-year-num">${escapeHtml(block.label)}</h2>
      <span class="timeline-year-count">${block.images.length}</span>
    </header>
    ${hero ? `
    <figure class="timeline-hero" data-lightbox-group="${group}" role="button" tabindex="0" aria-label="Open ${escapeHtml(block.label)} hero" ${lightboxTriggerAttrs(hero)}>
      ${renderPicture(hero, { sizes: '92vw', loading: index === 0 ? 'eager' : 'lazy', fetchpriority: index === 0 ? 'high' : undefined })}
    </figure>` : ''}
    ${block.rest.length ? `
    <div class="timeline-grid">
      ${block.rest.map((img) => renderGalleryItem(img, group, { includeSheet: true, variant: 'thumb', sizes: '(min-width: 800px) 22vw, 46vw' })).join('\n')}
    </div>` : ''}
  </section>`;
}
