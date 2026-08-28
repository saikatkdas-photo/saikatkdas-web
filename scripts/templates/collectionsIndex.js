import { renderPicture, escapeHtml } from './partials.js';

export function renderCollectionsIndex({ title, description, collections, kindLabel }) {
  return `
  <section class="hero wrap">
    <div class="hero-top-row">
      <h1 class="hero-heading">${escapeHtml(title)}</h1>
      <span class="hero-count">(${collections.length})</span>
    </div>
    <p class="hero-sub">${escapeHtml(description)}</p>
  </section>
  <section class="section wrap" style="padding-top: 0;">
    <div class="grid">
      ${collections.map((c) => `
      <a class="card" href="${c.href}">
        <div class="frame">${c.cover ? renderPicture(c.cover, { sizes: '(min-width: 800px) 30vw, 90vw' }) : ''}</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(c.title)}</div>
          <div class="card-meta">${escapeHtml(kindLabel)}${c.year ? ' · ' + c.year : ''}${c.services?.length ? ' · ' + c.services.map(escapeHtml).join(', ') : ''}</div>
        </div>
      </a>`).join('\n')}
    </div>
  </section>`;
}
