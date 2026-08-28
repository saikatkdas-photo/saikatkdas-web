import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { renderMarkdown } from './markdown.js';
import { slugify, titleFromSlug } from './slug.js';
import { loadControls } from './controls.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

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

/**
 * Load one image's sidecar metadata + merge in tags cascaded down from its
 * parent collection (e.g. every image in series/kolkata inherits "kolkata").
 */
async function loadImage(collectionDir, collectionTags, collectionHref, imageFile, publicSrcPrefix) {
  const ext = path.extname(imageFile);
  const baseName = path.basename(imageFile, ext);
  const mdPath = path.join(collectionDir, `${baseName}.md`);
  const { data, content } = await readMatter(mdPath);

  const ownTags = toArray(data.tags).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  const tags = [...new Set([...collectionTags, ...ownTags])];

  return {
    file: imageFile,
    slug: slugify(baseName),
    src: `${publicSrcPrefix}/${imageFile}`.replace(/\/{2,}/g, '/'),
    sourcePath: path.join(collectionDir, imageFile),
    title: data.title || '',
    alt: data.alt || data.title || titleFromSlug(baseName),
    caption: data.caption || '',
    location: data.location || '',
    tags,
    highlight: Boolean(data.highlight),
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
    .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort(naturalCompare);

  const href = `/${typeDir}/${slug}/`;
  const publicSrcPrefix = `/${typeDir}/${slug}`;
  const collectionTags = toArray(data.tags).map((t) => String(t).trim().toLowerCase()).filter(Boolean);

  const images = await Promise.all(
    imageFiles.map((file) => loadImage(collectionDir, collectionTags, href, file, publicSrcPrefix))
  );
  images.sort(byOrderThenTitle);

  const coverFile = data.cover && imageFiles.includes(data.cover) ? data.cover : imageFiles[0];
  const cover = images.find((img) => img.file === coverFile) || images[0] || null;

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
    cover,
    images,
    html: renderMarkdown(content),
    href,
  };
}

async function loadCollectionsOfType(rootDir, typeDir, type) {
  const slugs = await listSubdirectories(path.join(rootDir, typeDir));
  const collections = await Promise.all(slugs.map((slug) => loadCollection(rootDir, typeDir, type, slug)));
  collections.sort(byOrderThenTitle);
  return collections;
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

function buildThemes(allCollections) {
  const themeMap = new Map();
  for (const collection of allCollections) {
    for (const image of collection.images) {
      for (const tag of image.tags) {
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
    items: items.sort((a, b) => byOrderThenTitle(a.image, b.image)),
  }));

  themes.sort((a, b) => b.items.length - a.items.length || naturalCompare(a.title, b.title));
  return themes;
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

  const [projects, series, photos, journal, gear] = await Promise.all([
    loadCollectionsOfType(rootDir, 'projects', 'project'),
    loadCollectionsOfType(rootDir, 'series', 'series'),
    loadCollectionsOfType(rootDir, 'photos', 'photo'),
    loadCollectionsOfType(rootDir, 'journal', 'journal'),
    loadGear(rootDir),
  ]);

  const allGalleryCollections = [...projects, ...series, ...photos];
  const themes = buildThemes(allGalleryCollections);
  const highlights = collectHighlights(allGalleryCollections);

  const sectionOn = (key) => controls.sections?.[key] !== false;

  return {
    site: siteConfig.site,
    owner: siteConfig.owner,
    nav: siteConfig.nav,
    controls,
    about: { data: about.data, html: renderMarkdown(about.content) },
    projects,
    series,
    photos,
    journal,
    gear,
    themes,
    highlights,
    flags: {
      hasProjects: projects.length > 0 && sectionOn('projects'),
      hasSeries: series.length > 0 && sectionOn('series'),
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
