import { renderPicture, escapeHtml } from './partials.js';

export function renderAbout({ about, owner, portraitImage, flags }) {
  return `
  <section class="hero wrap">
    <h1 class="hero-heading">About</h1>
  </section>
  <section class="section wrap" style="padding-top: 0;">
    <div class="about-layout">
      <div class="about-copy">${about.html}</div>
      <div>
        ${portraitImage ? `<div class="frame" style="aspect-ratio: 4/5; border-radius: var(--radius); overflow: hidden;">${renderPicture(portraitImage, { sizes: '(min-width: 900px) 40vw, 90vw' })}</div>` : ''}
        <dl class="about-facts" style="margin-top: ${portraitImage ? '1.5rem' : '0'};">
          <div class="fact"><dt class="label">Based in</dt><dd style="margin-top:4px; font-size:1.05rem;">Bangalore, India</dd></div>
          <div class="fact"><dt class="label">Hometown</dt><dd style="margin-top:4px; font-size:1.05rem;">Kolkata, India</dd></div>
          <div class="fact"><dt class="label">Shooting since</dt><dd style="margin-top:4px; font-size:1.05rem;">2016</dd></div>
          ${flags.hasGear ? `<div class="fact"><dt class="label">Camera</dt><dd style="margin-top:4px; font-size:1.05rem;"><a class="text-link" href="/gear/">Ricoh GR IIIx →</a></dd></div>` : ''}
        </dl>
      </div>
    </div>

    <div style="margin-top: 3rem; display:flex; gap: 1rem; flex-wrap: wrap;">
      <a class="btn" href="mailto:${owner.email}">${owner.email}</a>
      <a class="btn" href="${owner.instagram}" target="_blank" rel="me noopener">Instagram — ${escapeHtml(owner.instagramHandle)}</a>
    </div>
  </section>`;
}
