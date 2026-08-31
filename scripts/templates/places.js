import { renderPicture, lightboxTriggerAttrs, escapeHtml } from './partials.js';

export function renderPlacesIndex(places) {
  return `
  <section class="hero wrap">
    <div class="hero-top-row">
      <h1 class="hero-heading">Places</h1>
      <span class="hero-count">(${places.length})</span>
    </div>
    <p class="hero-sub">Cities the work keeps returning to.</p>
  </section>
  <section class="section wrap" style="padding-top: 0;">
    <div class="grid">
      ${places.map((place) => `
      <a class="card" href="${place.href}">
        <div class="frame">${place.cover ? renderPicture(place.cover, { sizes: '(min-width: 800px) 30vw, 90vw' }) : renderPicture(place.items[0]?.image, { sizes: '(min-width: 800px) 30vw, 90vw' })}</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(place.title)}</div>
          <div class="card-meta">${place.items.length} photo${place.items.length === 1 ? '' : 's'}</div>
        </div>
      </a>`).join('\n')}
    </div>
  </section>`;
}

export function renderPlaceDetail(place) {
  return `
  <section class="detail-hero wrap">
    <p class="label label-paren">Place</p>
    <h1 class="detail-title" style="margin-top: 1rem;">${escapeHtml(place.title)}</h1>
    <p class="hero-sub">${place.items.length} photo${place.items.length === 1 ? '' : 's'} from ${escapeHtml(place.title)}.</p>

    <div class="gallery">
      ${place.items.map(({ image, collection }) => `
      <figure class="gallery-item" data-lightbox-group="place-${place.slug}" role="button" tabindex="0" aria-label="Open larger image" ${lightboxTriggerAttrs(image)}>
        <div class="frame">${renderPicture(image, { sizes: '(min-width: 800px) 32vw, 92vw' })}</div>
        <figcaption class="gallery-caption">
          ${image.caption ? escapeHtml(image.caption) + ' — ' : ''}<a class="text-link" href="${collection.href}">${escapeHtml(collection.title)}</a>
        </figcaption>
      </figure>`).join('\n')}
    </div>

    <p style="margin-top: 3rem;"><a class="text-link" href="/places/">← All places</a></p>
  </section>`;
}
