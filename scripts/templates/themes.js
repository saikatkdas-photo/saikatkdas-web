import { renderPicture, lightboxTriggerAttrs, escapeHtml } from './partials.js';

export function renderThemesIndex(themes) {
  return `
  <section class="hero wrap">
    <div class="hero-top-row">
      <h1 class="hero-heading">Themes</h1>
      <span class="hero-count">(${themes.length})</span>
    </div>
    <p class="hero-sub">Cross-cutting threads pulled from image tags — colour treatment, subjects, and whatever else the work naturally sorts itself into.</p>
  </section>
  <section class="section wrap" style="padding-top: 0;">
    <div class="grid">
      ${themes.map((theme) => `
      <a class="card" href="${theme.href}">
        <div class="frame">${theme.cover ? renderPicture(theme.cover, { sizes: '(min-width: 800px) 30vw, 90vw' }) : renderPicture(theme.items[0]?.image, { sizes: '(min-width: 800px) 30vw, 90vw' })}</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(theme.title)}</div>
          <div class="card-meta">${theme.items.length} photo${theme.items.length === 1 ? '' : 's'}</div>
        </div>
      </a>`).join('\n')}
    </div>
  </section>`;
}

export function renderThemeDetail(theme) {
  return `
  <section class="detail-hero wrap">
    <p class="label label-paren">Theme</p>
    <h1 class="detail-title" style="margin-top: 1rem;">${escapeHtml(theme.title)}</h1>
    <p class="hero-sub">${theme.items.length} photo${theme.items.length === 1 ? '' : 's'} tagged “${escapeHtml(theme.tag)}”.</p>

    <div class="gallery">
      ${theme.items.map(({ image, collection }) => `
      <figure class="gallery-item" data-lightbox-group="theme-${theme.slug}" role="button" tabindex="0" aria-label="Open larger image" ${lightboxTriggerAttrs(image)}>
        <div class="frame">${renderPicture(image, { sizes: '(min-width: 800px) 32vw, 92vw' })}</div>
        <figcaption class="gallery-caption">
          ${image.caption ? escapeHtml(image.caption) + ' — ' : ''}<a class="text-link" href="${collection.href}">${escapeHtml(collection.title)}</a>
        </figcaption>
      </figure>`).join('\n')}
    </div>

    <p style="margin-top: 3rem;"><a class="text-link" href="/themes/">← All themes</a></p>
  </section>`;
}
