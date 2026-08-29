import { renderPicture, lightboxTriggerAttrs, escapeHtml } from './partials.js';

function whenLabel(item) {
  if (item.month && item.year) return `${item.month} ${item.year}`;
  if (item.year) return item.year;
  return 'Undated';
}

function cardShape(image) {
  const w = image?.rendered?.width || 3;
  const h = image?.rendered?.height || 2;
  const ratio = w / Math.max(h, 1);
  const shape = ratio > 1.15 ? 'land' : ratio < 0.88 ? 'port' : 'sq';
  return { ratio, shape };
}

function renderYearMark(item) {
  return `<div class="timeline-mark" aria-hidden="true">
    <span class="timeline-mark-spacer"></span>
    <span class="timeline-mark-body">
      <span class="timeline-mark-year">${escapeHtml(item.label)}</span>
      <span class="timeline-mark-stem"></span>
      <span class="timeline-mark-dot"></span>
    </span>
  </div>`;
}

function renderCard(item, index) {
  const image = item.image;
  const { ratio, shape } = cardShape(image);
  const series = item.series || '';
  const when = whenLabel(item);
  const highlight = item.highlight;
  const labelBits = [series, when].filter(Boolean);
  const aria = `Open ${labelBits.join(', ') || 'image'}`;
  const loading = index < 3 ? 'eager' : 'lazy';
  const fetchpriority = index === 0 ? 'high' : undefined;

  return `<figure
    class="timeline-slot${highlight ? ' is-highlight' : ''}"
    data-timeline-slot
    data-shape="${shape}"
    style="--ar:${ratio.toFixed(4)}"
    data-lightbox-group="timeline"
    role="button"
    tabindex="0"
    aria-label="${escapeHtml(aria)}"
    ${lightboxTriggerAttrs(image, { includeSheet: true })}
  >
    <div class="timeline-card" data-timeline-card>
      <figcaption class="timeline-card-title">
        <span class="timeline-card-when">${escapeHtml(when)}</span>
        ${series ? `<span class="timeline-card-series">${escapeHtml(series)}</span>` : ''}
      </figcaption>
      <div class="timeline-card-media">
        ${highlight ? '<span class="timeline-star" aria-hidden="true">(*)</span>' : ''}
        <div class="frame">${renderPicture(image, { sizes: '(min-width: 800px) 42vw, 78vw', loading, fetchpriority })}</div>
      </div>
    </div>
  </figure>`;
}

export function renderTimeline(sequence = []) {
  const images = sequence.filter((item) => item.type === 'image');
  const total = images.length;
  let imageIndex = 0;

  return `
  <div class="timeline" data-timeline>
    <div class="timeline-sticky" data-timeline-sticky>
      <header class="timeline-head">
        <h1 class="timeline-title">Timeline</h1>
        <span class="timeline-count">(${total})</span>
      </header>
      <div class="timeline-track" data-timeline-track tabindex="-1" aria-label="Photo timeline, newest first">
        <div class="timeline-spacer" aria-hidden="true"></div>
        ${sequence.map((item) => {
          if (item.type === 'year') return renderYearMark(item);
          const html = renderCard(item, imageIndex);
          imageIndex += 1;
          return html;
        }).join('\n')}
        <div class="timeline-spacer" aria-hidden="true"></div>
      </div>
    </div>
  </div>`;
}
