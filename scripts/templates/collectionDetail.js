import { renderPicture, lightboxTriggerAttrs, escapeHtml } from './partials.js';

export function renderGalleryItem(image, groupSlug, opts = {}) {
  const includeSheet = opts.includeSheet === true;
  return `<figure class="gallery-item" data-lightbox-group="${groupSlug}" role="button" tabindex="0" aria-label="Open larger image${image.caption ? ': ' + escapeHtml(image.caption) : ''}" ${lightboxTriggerAttrs(image, { includeSheet })}>
    <div class="frame">${renderPicture(image, { sizes: opts.sizes || '(min-width: 800px) 32vw, 92vw', variant: opts.variant, loading: opts.loading })}</div>
    ${image.caption ? `<figcaption class="gallery-caption">${escapeHtml(image.caption)}</figcaption>` : ''}
  </figure>`;
}

export function renderCollectionDetail(collection, { backHref, backLabel, moreCollections = [] }) {
  const metaFields = [];
  if (collection.client) metaFields.push(['Client', collection.client]);
  if (collection.industry) metaFields.push(['Industry', collection.industry]);
  if (collection.services?.length) metaFields.push(['Service(s)', collection.services.join(', ')]);
  if (collection.year) metaFields.push(['Year', collection.year]);
  if (collection.tags?.length) metaFields.push(['Tags', collection.tags.map((t) => t[0].toUpperCase() + t.slice(1)).join(', ')]);

  return `
  <section class="detail-hero wrap">
    <p class="label label-paren">${escapeHtml(backLabel)}</p>
    <h1 class="detail-title" style="margin-top: 1rem;">${escapeHtml(collection.title)}</h1>

    ${collection.cover ? `<div class="detail-cover">${renderPicture(collection.cover, { sizes: '92vw', loading: 'eager', fetchpriority: 'high' })}</div>` : ''}

    ${metaFields.length ? `<div class="meta-grid">
      ${metaFields.map(([k, v]) => `<div class="fact"><dt class="label">${escapeHtml(k)}</dt><dd style="margin-top: 4px; font-size: 1.05rem;">${escapeHtml(v)}</dd></div>`).join('\n')}
    </div>` : ''}

    ${collection.html ? `<div class="detail-copy">${collection.html}</div>` : ''}

    <div class="gallery">
      ${collection.images.map((img) => renderGalleryItem(img, collection.slug)).join('\n')}
    </div>

    <p style="margin-top: 3rem;"><a class="text-link" href="${backHref}">← ${escapeHtml(backLabel)}</a></p>
  </section>

  ${moreCollections.length ? `
  <section class="section wrap on-dark" style="margin-top: 4rem;">
    <p class="label label-paren">More</p>
    <div class="more-row">
      ${moreCollections.map((c) => `<a class="card" href="${c.href}">
        <div class="frame">${c.cover ? renderPicture(c.cover, { sizes: '220px', variant: 'thumb' }) : ''}</div>
        <div class="card-body"><div class="card-title">${escapeHtml(c.title)}</div></div>
      </a>`).join('\n')}
    </div>
  </section>` : ''}
  `;
}
