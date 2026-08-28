import { INTRO_FONTS, quoteFontStack } from '../lib/controls.js';
import { escapeHtml } from './partials.js';

export function renderIntroType(controls) {
  const current = controls?.fonts?.intro_choice || 'barlow-condensed';
  const cards = Object.entries(INTRO_FONTS).map(([key, spec]) => `
    <a class="intro-type-card${key === current ? ' is-current' : ''}" href="/?introFont=${encodeURIComponent(key)}">
      <p class="intro-type-label">${escapeHtml(spec.name)}</p>
      <div class="intro-type-sample" style="font-family:${quoteFontStack(spec.stack)};font-weight:${spec.weight}">
        <p class="intro-type-stagger" aria-label="Staggered SKD">
          <span>S</span>
          <span class="is-k">K</span>
          <span class="is-d">D</span>
        </p>
        <p class="intro-type-lined" aria-label="Lined SKD">
          <span>S</span><span>K</span><span>D</span>
        </p>
      </div>
      <p class="intro-type-note">${escapeHtml(spec.note)}</p>
      <p class="intro-type-cta">${key === current ? 'Current · ' : ''}Play intro ↗</p>
    </a>`).join('');

  return `
  <section class="intro-type wrap">
    <header class="intro-type-head">
      <p class="intro-type-kicker">Intro letters only</p>
      <h1>Pick a gaunt face for SKD</h1>
      <p>Headings and body stay Helvetica. Each card shows the staggered entrance and the lined-up dock. Click to play the intro in that face. To keep one, set <code>fonts.intro_choice</code> in <code>data/controls.yaml</code>.</p>
    </header>
    <div class="intro-type-grid">${cards}</div>
  </section>`;
}
