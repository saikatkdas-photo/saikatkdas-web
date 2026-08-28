import { controlsToCss, introRuntimeConfig, googleFontsHref, INTRO_FONTS, resolveIntroFont } from '../lib/controls.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const NAV_FLAG_KEYS = {
  home: null,
  about: null,
  projects: 'hasProjects',
  series: 'hasSeries',
  themes: 'hasThemes',
  gear: 'hasGear',
  journal: 'hasJournal',
};

export function visibleNav(nav, flags) {
  return nav.filter((item) => {
    const flagKey = NAV_FLAG_KEYS[item.key];
    return !flagKey || flags[flagKey];
  });
}

/** Render a <picture> for an already-processed image (see build.js `processImage`). */
export function renderPicture(image, { sizes = '100vw', loading = 'lazy', fetchpriority } = {}) {
  if (!image || !image.rendered) {
    return `<div class="img-missing" role="img" aria-label="${escapeHtml(image?.alt || 'Image pending')}"></div>`;
  }
  const { outputs, width, height, publicDir } = image.rendered;
  const webpSrcset = outputs.map((o) => `${publicDir}/${o.webp} ${o.width}w`).join(', ');
  const jpgSrcset = outputs.map((o) => `${publicDir}/${o.jpg} ${o.width}w`).join(', ');
  const fallback = `${publicDir}/${outputs[outputs.length - 1].jpg}`;
  const priorityAttr = fetchpriority ? ` fetchpriority="${fetchpriority}"` : '';
  const ratio = width && height ? `${width} / ${height}` : 'auto';
  return `<picture class="pic" style="aspect-ratio:${ratio};">
    <source type="image/webp" srcset="${webpSrcset}" sizes="${sizes}">
    <img src="${fallback}" srcset="${jpgSrcset}" sizes="${sizes}" width="${width}" height="${height}" alt="${escapeHtml(image.alt)}" loading="${loading}"${priorityAttr} decoding="async">
  </picture>`;
}

export function lightboxTriggerAttrs(image) {
  if (!image?.rendered) return '';
  const largest = image.rendered.outputs[image.rendered.outputs.length - 1];
  const full = `${image.rendered.publicDir}/${largest.jpg}`;
  return [
    `data-lightbox-trigger="${full}"`,
    `data-full="${full}"`,
    `data-alt="${escapeHtml(image.alt)}"`,
    image.caption ? `data-caption="${escapeHtml(image.caption)}"` : '',
    image.camera ? `data-camera="${escapeHtml(image.camera)}"` : '',
    image.lens ? `data-lens="${escapeHtml(image.lens)}"` : '',
    image.aperture ? `data-aperture="${escapeHtml(image.aperture)}"` : '',
    image.shutter ? `data-shutter="${escapeHtml(image.shutter)}"` : '',
    image.iso ? `data-iso="${escapeHtml(image.iso)}"` : '',
    image.focalLength ? `data-focal-length="${escapeHtml(image.focalLength)}"` : '',
    image.takenAt ? `data-taken-at="${escapeHtml(image.takenAt)}"` : '',
  ].filter(Boolean).join(' ');
}

export function renderHeader({ owner, nav, flags, activeKey }) {
  const items = visibleNav(nav, flags);
  return `<header class="site-header">
    <a href="/" class="monogram" data-brand-type>${escapeHtml(owner.monogram)}</a>
    <button type="button" class="menu-toggle" data-nav-toggle aria-expanded="false" aria-controls="nav-overlay">
      <span class="bars" aria-hidden="true"><span></span><span></span><span></span></span>
      Menu
    </button>
  </header>
  <nav id="nav-overlay" class="nav-overlay" data-nav-overlay aria-hidden="true">
    <ul class="nav-overlay-list">
      ${items.map((item, i) => `<li><a class="nav-overlay-item${item.key === activeKey ? ' is-active' : ''}" href="${item.href}"><span class="idx">${String(i + 1).padStart(2, '0')}/</span> ${escapeHtml(item.label)}</a></li>`).join('\n')}
    </ul>
    <div class="nav-overlay-foot">
      <a href="mailto:${owner.email}">${owner.email}</a>
      <a href="${owner.instagram}" target="_blank" rel="me noopener">${escapeHtml(owner.instagramHandle)}</a>
    </div>
  </nav>`;
}

export function renderFooter({ owner }) {
  const year = new Date().getFullYear();
  return `<footer class="site-footer on-dark">
    <div class="wrap footer-grid">
      <div>
        <p class="label label-paren">Let's connect</p>
        <h3 style="margin-top: 0.75rem; font-size: clamp(1.75rem, 5vw, 3rem);">${escapeHtml(owner.name)}</h3>
      </div>
      <div class="footer-links">
        <a href="mailto:${owner.email}">${owner.email}</a>
        <a href="${owner.instagram}" target="_blank" rel="me noopener">Instagram ${escapeHtml(owner.instagramHandle)}</a>
      </div>
    </div>
    <div class="wrap footer-bottom">
      <span>&copy; ${year} ${escapeHtml(owner.name)}</span>
      <span>Built with a hand-rolled static generator.</span>
    </div>
  </footer>`;
}

export function renderLightboxMarkup() {
  return `<div class="lightbox" data-lightbox aria-hidden="true">
    <button type="button" class="lightbox-close" data-lightbox-close>Close ✕</button>
    <button type="button" class="lightbox-prev" data-lightbox-prev aria-label="Previous image">‹ Prev</button>
    <figure class="lightbox-figure">
      <img data-lightbox-img src="" alt="">
      <figcaption>
        <p class="lightbox-caption" data-lightbox-caption></p>
        <div class="lightbox-info" data-lightbox-info></div>
      </figcaption>
    </figure>
    <button type="button" class="lightbox-next" data-lightbox-next aria-label="Next image">Next ›</button>
  </div>`;
}

function restWord(text) {
  return `<span class="intro-rest"><span class="intro-rest-inner"><span class="intro-rest-word">${escapeHtml(text)}</span></span></span>`;
}

function renderHomeIntro(owner, introCanvasSrc, introConfig) {
  const configJson = JSON.stringify(introConfig || {}).replace(/</g, '\\u003c');
  return `<div class="intro" data-intro aria-hidden="true">
    <script type="application/json" data-intro-config>${configJson}</script>
    <div class="intro-stage" data-intro-stage>
      <div class="intro-letters" data-intro-letters>
        <div class="intro-letter" data-letter="S" data-from="bottom">
          <span class="intro-clip"><span class="intro-glyph">S</span></span>${restWord('aikat')}
        </div>
        <div class="intro-letter" data-letter="K" data-from="right">
          <span class="intro-clip"><span class="intro-glyph">K</span></span>
        </div>
        <div class="intro-letter" data-letter="D" data-from="top">
          <span class="intro-clip"><span class="intro-glyph">D</span></span>${restWord('as')}
        </div>
      </div>
      <span class="intro-star" data-intro-star>(*)</span>
      <div class="intro-frame" data-intro-frame>
        <div class="intro-frame-inner">
          ${introCanvasSrc ? `<img src="${introCanvasSrc}" alt="" class="intro-photo" width="1800" height="1200" fetchpriority="high">` : ''}
        </div>
      </div>
      <div class="intro-shutter intro-shutter-top" data-intro-shutter-top></div>
      <div class="intro-shutter intro-shutter-bot" data-intro-shutter-bot></div>
    </div>
    <div class="intro-foot"><span>Loading</span><span data-intro-count>000</span></div>
  </div>`;
}

export function renderLayout({ title, description, activeKey, site, owner, nav, flags, controls, bodyClass = '', content, canonicalPath = '/', assetVersion = '', introCanvasSrc = '', noIndex = false, extraGoogleFamilies = [] }) {
  const isHome = activeKey === 'home';
  const showIntro = Boolean(isHome && flags?.hasIntro);
  const v = assetVersion ? `?v=${assetVersion}` : '';
  const tokenCss = controls ? controlsToCss(controls) : '';
  const chosenIntro = controls ? resolveIntroFont(controls).google : '';
  const googleFamilies = extraGoogleFamilies.length
    ? extraGoogleFamilies
    : (showIntro
        ? Object.values(INTRO_FONTS).map((f) => f.google)
        : (chosenIntro ? [chosenIntro] : []));
  const googleHref = controls ? googleFontsHref(controls, googleFamilies) : '';
  const google = googleHref ? `<link rel="stylesheet" href="${googleHref}">` : '';
  const introConfig = controls ? introRuntimeConfig(controls) : {};
  return `<!DOCTYPE html>
<html lang="${site.language || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${noIndex ? '<meta name="robots" content="noindex">' : ''}
  <link rel="canonical" href="${site.url}${canonicalPath}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${site.url}${canonicalPath}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${google}
  <link rel="stylesheet" href="/styles/main.css${v}">
  <style id="site-tokens">${tokenCss}</style>
</head>
<body class="${bodyClass}${showIntro ? ' has-intro' : ''}">
  ${showIntro ? renderHomeIntro(owner, introCanvasSrc, introConfig) : ''}
  <a class="skip-link" href="#main">Skip to content</a>
  ${renderHeader({ owner, nav, flags, activeKey })}
  <main id="main">
    ${content}
  </main>
  ${renderFooter({ owner })}
  ${renderLightboxMarkup()}
  <script src="/scripts/main.js${v}" defer></script>
</body>
</html>`;
}
