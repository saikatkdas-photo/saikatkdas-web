import { renderGalleryItem } from './collectionDetail.js';

export function renderUntitled(untitled) {
  const count = untitled.images.length;
  return `
  <section class="hero wrap">
    <div class="hero-top-row">
      <h1 class="hero-heading">Untitled</h1>
      <span class="hero-count">(${count})</span>
    </div>
    <p class="hero-sub">Standalone frames, outside of a series.</p>
  </section>
  <section class="section wrap" style="padding-top: 0;">
    <div class="gallery">
      ${untitled.images.map((img) => renderGalleryItem(img, 'untitled')).join('\n')}
    </div>
  </section>`;
}
