import { renderPicture, escapeHtml } from './partials.js';

export function renderGear(gear) {
  return `
  <section class="hero wrap">
    <div class="hero-top-row">
      <h1 class="hero-heading">Gear</h1>
      <span class="hero-count">(${gear.length})</span>
    </div>
    <p class="hero-sub">What's in the bag — and why it's there.</p>
  </section>
  <section class="section wrap" style="padding-top: 0;">
    <div class="gear-list">
      ${gear.map((item) => `
      <article class="gear-item" id="${item.slug}">
        <div class="gear-photo${item.image ? '' : ' is-placeholder'}">
          ${item.image ? renderPicture(item.image, { sizes: '320px' }) : '<span>Photo pending</span>'}
        </div>
        <div>
          <p class="label label-paren">${escapeHtml(item.category || 'Gear')}${item.since ? ` · since ${escapeHtml(item.since)}` : ''}</p>
          <h2 style="margin-top: 0.75rem; font-size: clamp(1.5rem, 4vw, 2rem);">${escapeHtml(item.title)}</h2>
          <div class="gear-copy" style="margin-top: 1rem;">${item.html}</div>
        </div>
      </article>`).join('\n')}
    </div>
  </section>`;
}
