/**
 * Cover selection for every section, computed at build time.
 *
 * Priority (highest first):
 *   1. cover: true on the image sidecar
 *   2. highlight: true
 *   3. longest story
 *   4. non-empty caption
 *   5. latest frame (takenAt, then filename)
 *
 * Uniqueness: once an image is used as a cover/hero, later sections prefer
 * something else. If a section has no unused frames left, it may reuse any
 * image at random (seeded, so a given corpus stays stable).
 *
 * TBD: series covers should become a dynamic montage of the latest 2 and
 * earliest 2 frames in the collection.
 */

function naturalCompare(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

export function imageKey(image) {
  return image?.sourcePath || image?.src || '';
}

export function recencyValue(image) {
  const parsed = Date.parse(image?.takenAt);
  if (Number.isFinite(parsed)) return parsed;
  if (Number.isFinite(image?.order)) return image.order;
  return 0;
}

/** Highlight frames first (latest among them), then latest others. If none are highlights, latest only. */
export function pickPreviewImages(images, limit = 5) {
  if (!images?.length) return [];
  const highlights = images.filter((img) => img.highlight);
  if (highlights.length) {
    const rest = images.filter((img) => !img.highlight).sort(compareLatest);
    return [...highlights.sort(compareLatest), ...rest].slice(0, limit);
  }
  return [...images].sort(compareLatest).slice(0, limit);
}

/** Latest first. */
export function compareLatest(a, b) {
  const d = recencyValue(b) - recencyValue(a);
  if (d !== 0) return d;
  return naturalCompare(b.file || b.slug, a.file || a.slug);
}

export function storyLength(image) {
  return String(image?.story || '').trim().length;
}

function hasCaption(image) {
  return Boolean(String(image?.caption || '').trim());
}

function seededIndex(seed, length) {
  if (length <= 0) return 0;
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % length;
}

function rankPool(pool) {
  const flagged = pool.filter((img) => img.cover);
  if (flagged.length) return [...flagged].sort(compareLatest);

  const highlights = pool.filter((img) => img.highlight);
  if (highlights.length) return [...highlights].sort(compareLatest);

  const withStory = pool.filter((img) => storyLength(img) > 0);
  if (withStory.length) {
    return [...withStory].sort((a, b) => {
      const d = storyLength(b) - storyLength(a);
      return d !== 0 ? d : compareLatest(a, b);
    });
  }

  const withCaption = pool.filter(hasCaption);
  if (withCaption.length) return [...withCaption].sort(compareLatest);

  return [...pool].sort(compareLatest);
}

/**
 * Pick one cover from `images`.
 * @param {object[]} images
 * @param {{ usedKeys?: Set<string>, warnLabel?: string, warnMultiple?: boolean, allowRandomFallback?: boolean, seed?: string }} [opts]
 */
export function pickCover(images, opts = {}) {
  const { usedKeys = null, warnLabel = '', warnMultiple = false, allowRandomFallback = false, seed = '' } = opts;
  if (!images?.length) return { cover: null, warning: null, reused: false };

  const unused = usedKeys ? images.filter((img) => !usedKeys.has(imageKey(img))) : images;
  let pool = unused;

  if (usedKeys && unused.length === 0) {
    if (allowRandomFallback) {
      const i = seededIndex(seed || warnLabel, images.length);
      return { cover: images[i], warning: null, reused: true };
    }
    pool = images;
  }

  const flagged = images.filter((img) => img.cover);
  const ranked = rankPool(pool);
  const cover = ranked[0] || null;

  let warning = null;
  if (warnMultiple && flagged.length > 1) {
    const files = flagged.map((img) => img.file).join(', ');
    const chosen = [...flagged].sort(compareLatest)[0];
    warning = `${warnLabel} has ${flagged.length} images with cover: true (${files}). Using latest (${chosen.file}).`;
  }

  return { cover, warning, reused: false };
}

export function assignSiteCovers({ projects = [], series = [], untitled = null, themes = [], journal = [] }) {
  const warnings = [];
  const used = new Set();
  const log = [];

  // TBD: montage of latest 2 + earliest 2 as the series cover.
  const collections = [...projects, ...series];
  for (const collection of collections) {
    const label = `${collection.type}:${collection.slug}`;
    const { cover, warning } = pickCover(collection.images, { warnLabel: label, warnMultiple: true });
    if (warning) warnings.push(warning);
    collection.cover = cover;
    if (cover) {
      used.add(imageKey(cover));
      const how = cover.cover ? 'flagged' : cover.highlight ? 'highlight' : storyLength(cover) ? 'story' : cover.caption ? 'caption' : 'latest';
      log.push(`${label} → ${cover.file} (${how})`);
    }
  }

  if (untitled?.images?.length) {
    const { cover, reused } = pickCover(untitled.images, {
      usedKeys: used,
      allowRandomFallback: true,
      seed: 'untitled',
      warnLabel: 'untitled',
    });
    untitled.cover = cover;
    if (cover) {
      used.add(imageKey(cover));
      log.push(`untitled → ${cover.file}${reused ? ' (reuse)' : ''}`);
    }
  }

  for (const theme of themes) {
    const images = theme.items.map((item) => item.image).filter(Boolean);
    const { cover, reused } = pickCover(images, {
      usedKeys: used,
      allowRandomFallback: true,
      seed: `theme-${theme.slug}`,
      warnLabel: `theme:${theme.slug}`,
    });
    theme.cover = cover;
    if (cover) {
      used.add(imageKey(cover));
      log.push(`theme:${theme.slug} → ${cover.file}${reused ? ' (reuse)' : ''}`);
    }
  }

  for (const post of journal) {
    const { cover } = pickCover(post.images || []);
    post.cover = cover;
  }

  return { warnings, log, used };
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function imageTakenParts(image) {
  const raw = String(image?.takenAt || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const monthIndex = Number(match[2]) - 1;
    return {
      year: match[1],
      month: MONTH_SHORT[monthIndex] || '',
      key: match[1],
    };
  }
  const yearOnly = raw.slice(0, 4);
  if (/^\d{4}$/.test(yearOnly)) {
    return { year: yearOnly, month: '', key: yearOnly };
  }
  return { year: '', month: '', key: 'undated' };
}

export function buildTimelineYears(images) {
  const groups = new Map();
  for (const image of images) {
    const key = imageTakenParts(image).key;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(image);
  }

  const years = [...groups.entries()].map(([year, yearImages]) => ({
    year,
    label: year === 'undated' ? 'Undated' : year,
    images: [...yearImages].sort(compareLatest),
    hero: null,
    rest: yearImages,
  }));

  years.sort((a, b) => {
    if (a.year === 'undated') return 1;
    if (b.year === 'undated') return -1;
    return b.year.localeCompare(a.year);
  });

  return years;
}

/** Flat newest-first sequence with year markers between year changes. */
export function buildTimelineSequence(images) {
  const sorted = [...(images || [])].sort(compareLatest);
  const items = [];
  let lastKey = null;

  for (const image of sorted) {
    const parts = imageTakenParts(image);
    if (lastKey !== null && parts.key !== lastKey) {
      items.push({
        type: 'year',
        year: parts.year,
        label: parts.key === 'undated' ? 'Undated' : parts.year,
      });
    }
    lastKey = parts.key;

    items.push({
      type: 'image',
      image,
      year: parts.year,
      month: parts.month,
      series: image.sheet?.title || '',
      highlight: Boolean(image.highlight),
    });
  }

  return items;
}
