import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { renderMarkdown } from './markdown.js';
import { slugify, titleFromSlug } from './slug.js';
import { loadControls } from './controls.js';
import { assignSiteCovers, buildTimelineYears, buildTimelineSequence, compareLatest, pickPreviewImages } from './covers.js';
import { isSourceImageFile } from './image.js';
import { KNOWN_PLACES, normalizePlace } from './place.js';

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function byOrderThenTitle(a, b) {
  const orderA = Number.isFinite(a.order) ? a.order : Infinity;
  const orderB = Number.isFinite(b.order) ? b.order : Infinity;
  if (orderA !== orderB) return orderA - orderB;
  return naturalCompare(a.title || '', b.title || '');
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readMatter(filePath) {
  if (!(await pathExists(filePath))) return { data: {}, content: '' };
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = matter(raw);
  return { data: parsed.data || {}, content: parsed.content || '' };
}

async function listSubdirectories(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort(naturalCompare);
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function isCoverFlag(value) {
  return value === true || value === 'true' || value === 'yes' || value === 1;
}

function storyFromSidecar(data, content) {
  if (data.story != null && String(data.story).trim()) return String(data.story).trim();
  return String(content || '').replace(/<!--[\s\S]*?-->/g, '').trim();
}

async function walkImageFiles(dir, base = dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkImageFiles(full, base));
    } else if (isSourceImageFile(entry.name)) {
      files.push(path.relative(base, full));
    }
  }
  files.sort(naturalCompare);
  return files;
}

/**
 * Load one image's sidecar metadata + merge in tags cascaded down from its
 * parent collection (e.g. every image in a market series inherits "market").
 */
async function loadImage(collectionDir, collectionTags, collectionHref, imageFile, publicSrcPrefix) {
  const ext = path.extname(imageFile);
  const baseName = path.basename(imageFile, ext);
  const mdPath = path.join(collectionDir, path.dirname(imageFile), `${baseName}.md`);
  const { data, content } = await readMatter(mdPath);

  const ownTags = toArray(data.tags).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  const folder = path.dirname(imageFile);
  const folderSlug = folder && folder !== '.' ? slugify(folder) : '';
  const folderTag = folderSlug && /[a-z]/.test(folderSlug) ? folderSlug : '';
  const place = normalizePlace(data.place);
  const tags = [...new Set([...collectionTags, ...ownTags, folderTag].filter((t) => t && t !== place && !KNOWN_PLACES.includes(t)))];

  return {
    file: imageFile,
    slug: slugify(baseName),
    src: `${publicSrcPrefix}/${imageFile}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/'),
    sourcePath: path.join(collectionDir, imageFile),
    title: data.title || '',
    alt: data.alt || data.title || titleFromSlug(baseName),
    caption: data.caption || '',
    story: storyFromSidecar(data, content),
    location: data.location || '',
    place,
    tags,
    highlight: Boolean(data.highlight),
    cover: isCoverFlag(data.cover),
    order: typeof data.order === 'number' ? data.order : Number.parseFloat(baseName),
    link: data.link || '',
    camera: data.camera || '',
    lens: data.lens || '',
    aperture: data.aperture || '',
    shutter: data.shutter || '',
    focalLength: data.focalLength || '',
    iso: data.iso || '',
    takenAt: data.takenAt || '',
    html: renderMarkdown(content),
    parentHref: collectionHref,
  };
}

async function loadCollection(rootDir, typeDir, type, slug) {
  const collectionDir = path.join(rootDir, typeDir, slug);
  const { data, content } = await readMatter(path.join(collectionDir, 'readme.md'));

  const entries = await fs.readdir(collectionDir, { withFileTypes: true });
  const imageFiles = entries
    .filter((e) => e.isFile() && isSourceImageFile(e.name))
    .map((e) => e.name)
    .sort(naturalCompare);

  const href = `/${typeDir}/${slug}/`;
  const publicSrcPrefix = `/${typeDir}/${slug}`;
  const collectionTags = toArray(data.tags).map((t) => String(t).trim().toLowerCase()).filter(Boolean);

  const images = await Promise.all(
    imageFiles.map((file) => loadImage(collectionDir, collectionTags, href, file, publicSrcPrefix))
  );
  images.sort(byOrderThenTitle);

  // Backward compatible: readme `cover: 04.jpg` counts as cover: true on that image.
  const readmeCover = typeof data.cover === 'string' ? data.cover.trim() : '';
  if (readmeCover) {
    const marked = images.find((img) => img.file === readmeCover);
    if (marked) marked.cover = true;
  }

  return {
    type,
    slug,
    title: data.title || titleFromSlug(slug),
    summary: data.summary || '',
    client: data.client || '',
    industry: data.industry || '',
    services: toArray(data.services),
    year: data.year || '',
    tags: collectionTags,
    order: typeof data.order === 'number' ? data.order : null,
    cover: null,
    images,
    html: renderMarkdown(content),
    href,
  };
}

async function loadCollectionsOfType(rootDir, typeDir, type) {
  const slugs = await listSubdirectories(path.join(rootDir, typeDir));
  const collections = await Promise.all(slugs.map((slug) => loadCollection(rootDir, typeDir, type, slug)));
  collections.sort(byOrderThenTitle);
  return collections.filter((c) => c.images.length > 0);
}

async function loadUntitled(rootDir) {
  const photosDir = path.join(rootDir, 'photos');
  const imageFiles = await walkImageFiles(photosDir);
  const href = '/untitled/';
  const images = await Promise.all(
    imageFiles.map((file) => loadImage(photosDir, [], href, file, '/photos'))
  );
  images.sort(compareLatest);

  return {
    type: 'untitled',
    slug: 'untitled',
    title: 'Untitled',
    summary: 'Standalone frames, outside of a series.',
    client: '',
    industry: '',
    services: [],
    year: '',
    tags: [],
    order: null,
    cover: null,
    images,
    html: '',
    href,
  };
}

async function loadGear(rootDir) {
  const gearDir = path.join(rootDir, 'gear');
  if (!(await pathExists(gearDir))) return [];
  const entries = await fs.readdir(gearDir, { withFileTypes: true });
  const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);

  const items = await Promise.all(
    mdFiles.map(async (file) => {
      const slug = path.basename(file, '.md');
      const { data, content } = await readMatter(path.join(gearDir, file));

      let image = null;
      if (data.image) {
        const imagePath = path.join(gearDir, data.image);
        if (await pathExists(imagePath)) {
          image = { src: `/gear/${data.image}`, sourcePath: imagePath, alt: data.title || titleFromSlug(slug) };
        }
      }

      return {
        slug,
        title: data.title || titleFromSlug(slug),
        category: data.category || '',
        since: data.since || '',
        current: data.current !== false,
        order: typeof data.order === 'number' ? data.order : null,
        image,
        html: renderMarkdown(content),
        href: `/gear/#${slug}`,
      };
    })
  );

  items.sort(byOrderThenTitle);
  return items;
}

function placeRank(slug) {
  const index = KNOWN_PLACES.indexOf(slug);
  return index === -1 ? 99 : index;
}

function buildPlaces(allCollections) {
  const placeMap = new Map();
  for (const collection of allCollections) {
    for (const image of collection.images) {
      const place = normalizePlace(image.place);
      if (!place) continue;
      if (!placeMap.has(place)) placeMap.set(place, []);
      placeMap.get(place).push({ image, collection });
    }
  }

  const places = [...placeMap.entries()].map(([place, items]) => ({
    type: 'place',
    place,
    slug: place,
    title: titleFromSlug(place),
    href: `/places/${place}/`,
    cover: null,
    items: items.sort((a, b) => byOrderThenTitle(a.image, b.image)),
    images: items.map((item) => item.image),
    year: '',
    summary: '',
  }));

  places.sort((a, b) => placeRank(a.slug) - placeRank(b.slug) || naturalCompare(a.title, b.title));
  return places;
}

function buildThemes(allCollections) {
  const themeMap = new Map();
  for (const collection of allCollections) {
    for (const image of collection.images) {
      for (const tag of image.tags) {
        if (tag === image.place || KNOWN_PLACES.includes(tag)) continue;
        if (!themeMap.has(tag)) themeMap.set(tag, []);
        themeMap.get(tag).push({ image, collection });
      }
    }
  }

  const themes = [...themeMap.entries()].map(([tag, items]) => ({
    tag,
    slug: slugify(tag),
    title: titleFromSlug(tag),
    href: `/themes/${slugify(tag)}/`,
    cover: null,
    items: items.sort((a, b) => byOrderThenTitle(a.image, b.image)),
  }));

  themes.sort((a, b) => b.items.length - a.items.length || naturalCompare(a.title, b.title));
  return themes;
}

function collectionKind(collection) {
  if (collection?.type === 'project') return 'Project';
  if (collection?.type === 'untitled') return 'Untitled';
  if (collection?.type === 'journal') return 'Journal';
  return 'Series';
}

function attachSheetMeta(collections) {
  for (const collection of collections) {
    if (!collection?.images?.length) continue;
    const previews = pickPreviewImages(collection.images, 5);
    collection.previewImages = previews;
    const base = {
      href: collection.href,
      title: collection.title,
      kind: collectionKind(collection),
      summary: collection.summary || '',
    };
    collection.sheet = base;
    for (const image of collection.images) {
      image.sheet = {
        ...base,
        href: image.link || collection.href,
      };
      image.sheetPreviews = previews;
    }
  }
}

function collectHighlights(allCollections) {
  const highlights = [];
  for (const collection of allCollections) {
    for (const image of collection.images) {
      if (!image.highlight) continue;
      highlights.push({
        image,
        collection,
        href: image.link || collection.href,
        title: image.title || collection.title,
      });
    }
  }
  highlights.sort((a, b) => byOrderThenTitle(a.image, b.image));
  return highlights;
}

export async function loadSite(rootDir) {
  const siteConfigRaw = await fs.readFile(path.join(rootDir, 'data', 'site.json'), 'utf8');
  const siteConfig = JSON.parse(siteConfigRaw);
  const controls = await loadControls(rootDir);

  const about = await readMatter(path.join(rootDir, 'about.md'));

  const [projects, series, untitled, journal, gear] = await Promise.all([
    loadCollectionsOfType(rootDir, 'projects', 'project'),
    loadCollectionsOfType(rootDir, 'series', 'series'),
    loadUntitled(rootDir),
    loadCollectionsOfType(rootDir, 'journal', 'journal'),
    loadGear(rootDir),
  ]);

  const allGalleryCollections = [...projects, ...series, untitled].filter((c) => c.images?.length);
  attachSheetMeta(allGalleryCollections);
  attachSheetMeta(journal.filter((post) => post.images?.length));
  const themes = buildThemes(allGalleryCollections);
  const places = buildPlaces(allGalleryCollections);
  const highlights = collectHighlights(allGalleryCollections);

  const allGalleryImages = allGalleryCollections.flatMap((c) => c.images);
  const timelineImages = [
    ...allGalleryImages,
    ...journal.flatMap((post) => post.images || []),
  ];
  const timelineYears = buildTimelineYears(timelineImages);
  const timelineSequence = buildTimelineSequence(timelineImages);

  const { warnings, log } = assignSiteCovers({
    projects,
    series,
    untitled,
    places,
    themes,
    journal,
  });

  const sectionOn = (key) => controls.sections?.[key] !== false;

  return {
    site: siteConfig.site,
    owner: siteConfig.owner,
    nav: siteConfig.nav,
    controls,
    about: { data: about.data, html: renderMarkdown(about.content) },
    projects,
    series,
    untitled,
    photos: untitled,
    journal,
    gear,
    themes,
    places,
    highlights,
    timelineYears,
    timelineSequence,
    coverWarnings: warnings,
    coverLog: log,
    flags: {
      hasProjects: projects.length > 0 && sectionOn('projects'),
      hasSeries: series.length > 0 && sectionOn('series'),
      hasUntitled: untitled.images.length > 0 && sectionOn('untitled'),
      hasTimeline: timelineImages.length > 0 && sectionOn('timeline'),
      hasPlaces: places.length > 0 && sectionOn('places'),
      hasThemes: themes.length > 0 && sectionOn('themes'),
      hasGear: gear.length > 0 && sectionOn('gear'),
      hasJournal: journal.length > 0 && sectionOn('journal'),
      hasIntro: Boolean(controls.intro?.enabled && sectionOn('intro')),
      hasHero: sectionOn('hero'),
      hasSelected: sectionOn('selected'),
      hasSelectedStrip: Boolean(controls.selected_strip?.enabled && sectionOn('selected_strip')),
      hasWorkPreviews: sectionOn('work_previews'),
      hasAboutTeaser: sectionOn('about'),
    },
  };
}
