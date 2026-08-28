import { renderPicture, escapeHtml } from './partials.js';

export function renderJournalIndex(posts) {
  return `
  <section class="hero wrap">
    <div class="hero-top-row">
      <h1 class="hero-heading">Journal</h1>
      <span class="hero-count">(${posts.length})</span>
    </div>
    <p class="hero-sub">Notes, stories, and behind-the-frame thoughts.</p>
  </section>
  <section class="section wrap" style="padding-top: 0;">
    <div class="journal-list">
      ${posts.map((post) => `
      <a class="journal-item" href="${post.href}">
        <span class="journal-date">${escapeHtml(post.year || '')}</span>
        <div>
          <div class="card-title" style="font-size: 1.4rem;">${escapeHtml(post.title)}</div>
          ${post.summary ? `<p class="ink-soft" style="margin-top: 0.5rem;">${escapeHtml(post.summary)}</p>` : ''}
        </div>
      </a>`).join('\n')}
    </div>
  </section>`;
}

export function renderJournalDetail(post) {
  return `
  <section class="detail-hero wrap">
    <p class="label label-paren">Journal</p>
    <h1 class="detail-title" style="margin-top: 1rem;">${escapeHtml(post.title)}</h1>
    ${post.cover ? `<div class="detail-cover">${renderPicture(post.cover, { sizes: '92vw' })}</div>` : ''}
    <div class="detail-copy">${post.html}</div>
    <p style="margin-top: 3rem;"><a class="text-link" href="/journal/">← All journal entries</a></p>
  </section>`;
}
