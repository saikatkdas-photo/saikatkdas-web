#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadSite } from './lib/content.js';
import { INTRO_FONTS } from './lib/controls.js';
import { generateResponsiveImages } from './lib/image.js';
import { renderLayout } from './templates/partials.js';
import { renderHome } from './templates/home.js';
import { renderIntroType } from './templates/introType.js';
import { renderCollectionsIndex } from './templates/collectionsIndex.js';
import { renderCollectionDetail } from './templates/collectionDetail.js';
import { renderThemesIndex, renderThemeDetail } from './templates/themes.js';
import { renderPlacesIndex, renderPlaceDetail } from './templates/places.js';
import { renderAbout } from './templates/about.js';
import { renderGear } from './templates/gear.js';
import { renderJournalIndex, renderJournalDetail } from './templates/journal.js';
import { renderUntitled } from './templates/untitled.js';
import { renderTimeline } from './templates/timeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DOMAIN = 'saikatkdas.com';

async function writeFile(relPath, contents) {
  const fullPath = path.join(DIST, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, contents, 'utf8');
}

async function copyFile(src, relDestPath) {
  const dest = path.join(DIST, relDestPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

function collectAllImages(data) {
  const images = [];
  for (const list of [data.projects, data.series, data.journal]) {
    for (const collection of list) {
      for (const image of collection.images) images.push(image);
    }
  }
  if (data.untitled?.images) {
    for (const image of data.untitled.images) images.push(image);
  }
  for (const item of data.gear) {
    if (item.image) images.push(item.image);
  }
  if (data.about.data.portrait) images.push(data.aboutPortraitImage);
  return images.filter(Boolean);
}

async function processAllImages(data) {
  const images = collectAllImages(data);
  let processed = 0;
  await Promise.all(
    images.map(async (image) => {
      const destDir = path.join(DIST, 'media', path.dirname(image.src));
      const baseName = path.basename(image.src, path.extname(image.src));
      const result = await generateResponsiveImages(image.sourcePath, destDir, baseName);
      image.rendered = { ...result, publicDir: `/media${path.dirname(image.src)}` };
      processed += 1;
    })
  );
  return processed;
}

function pickRenderedSrc(rendered, preferWidth = 1800) {
  if (!rendered?.outputs?.length) return '';
  const match = rendered.outputs.find((o) => o.width === preferWidth) || rendered.outputs[rendered.outputs.length - 1];
  return `${rendered.publicDir}/${match.jpg}`;
}

async function processIntroImages() {
  const files = [
    { key: 'introCanvas', file: 'canvas.jpg', alt: '' },
    { key: 'introHero', file: 'hero.jpg', alt: 'Street workers unloading sacks from a truck' },
  ];
  const result = {};
  for (const item of files) {
    const sourcePath = path.join(ROOT, 'src/assets/intro', item.file);
    const destDir = path.join(DIST, 'media', 'intro');
    const baseName = path.basename(item.file, path.extname(item.file));
    const rendered = await generateResponsiveImages(sourcePath, destDir, baseName);
    rendered.publicDir = '/media/intro';
    result[item.key] = {
      src: `/intro/${item.file}`,
      sourcePath,
      alt: item.alt,
      rendered,
    };
  }
  return result;
}

function page(templateContent, { title, description, activeKey, canonicalPath, data, bodyClass, noIndex, extraGoogleFamilies }) {
  return renderLayout({
    title,
    description,
    activeKey,
    canonicalPath,
    site: data.site,
    owner: data.owner,
    nav: data.nav,
    flags: data.flags,
    controls: data.controls,
    assetVersion: data.assetVersion,
    introCanvasSrc: pickRenderedSrc(data.introCanvas?.rendered),
    bodyClass,
    content: templateContent,
    noIndex,
    extraGoogleFamilies,
  });
}

async function computeAssetVersion() {
  const files = ['src/styles/main.css', 'src/scripts/main.js', 'data/controls.yaml'];
  const hash = crypto.createHash('sha1');
  for (const rel of files) {
    hash.update(await fs.readFile(path.join(ROOT, rel)));
  }
  return hash.digest('hex').slice(0, 8);
}

async function buildHome(data) {
  const html = page(renderHome(data), {
    title: data.site.title,
    description: data.site.description,
    activeKey: 'home',
    canonicalPath: '/',
    data,
  });
  await writeFile('index.html', html);
}

async function buildCollections(data, { list, typeDir, kindLabel, activeKey, title, description }) {
  if (list.length === 0) return;

  const indexHtml = page(renderCollectionsIndex({ title, description, collections: list, kindLabel }), {
    title: `${title} — ${data.owner.name}`,
    description,
    activeKey,
    canonicalPath: `/${typeDir}/`,
    data,
  });
  await writeFile(`${typeDir}/index.html`, indexHtml);

  for (const collection of list) {
    const more = list.filter((c) => c.slug !== collection.slug).slice(0, 6);
    const detailHtml = page(
      renderCollectionDetail(collection, { backHref: `/${typeDir}/`, backLabel: `Back to ${title.toLowerCase()}`, moreCollections: more }),
      {
        title: `${collection.title} — ${data.owner.name}`,
        description: collection.summary || `${collection.title} — ${kindLabel.toLowerCase()} by ${data.owner.name}.`,
        activeKey,
        canonicalPath: `/${typeDir}/${collection.slug}/`,
        data,
      }
    );
    await writeFile(`${typeDir}/${collection.slug}/index.html`, detailHtml);
  }
}

async function buildPlaces(data) {
  if (!data.places?.length) return;

  const indexHtml = page(renderPlacesIndex(data.places), {
    title: `Places — ${data.owner.name}`,
    description: 'Cities the work keeps returning to.',
    activeKey: 'places',
    canonicalPath: '/places/',
    data,
  });
  await writeFile('places/index.html', indexHtml);

  for (const place of data.places) {
    const html = page(renderPlaceDetail(place), {
      title: `${place.title} — Places — ${data.owner.name}`,
      description: `Photos from ${place.title}.`,
      activeKey: 'places',
      canonicalPath: `/places/${place.slug}/`,
      data,
    });
    await writeFile(`places/${place.slug}/index.html`, html);
  }
}

async function buildThemes(data) {
  if (data.themes.length === 0) return;

  const indexHtml = page(renderThemesIndex(data.themes), {
    title: `Themes — ${data.owner.name}`,
    description: 'Cross-cutting visual themes across the work.',
    activeKey: 'themes',
    canonicalPath: '/themes/',
    data,
  });
  await writeFile('themes/index.html', indexHtml);

  for (const theme of data.themes) {
    const html = page(renderThemeDetail(theme), {
      title: `${theme.title} — Themes — ${data.owner.name}`,
      description: `Photos tagged “${theme.tag}”.`,
      activeKey: 'themes',
      canonicalPath: `/themes/${theme.slug}/`,
      data,
    });
    await writeFile(`themes/${theme.slug}/index.html`, html);
  }
}

async function buildUntitled(data) {
  if (!data.flags.hasUntitled) return;
  const html = page(renderUntitled(data.untitled), {
    title: `Untitled — ${data.owner.name}`,
    description: 'Standalone frames, outside of a series.',
    activeKey: 'untitled',
    canonicalPath: '/untitled/',
    data,
  });
  await writeFile('untitled/index.html', html);
}

async function buildTimeline(data) {
  if (!data.flags.hasTimeline) return;
  const html = page(renderTimeline(data.timelineSequence), {
    title: `Timeline — ${data.owner.name}`,
    description: 'The work, newest first.',
    activeKey: 'timeline',
    canonicalPath: '/timeline/',
    data,
    bodyClass: 'is-timeline',
  });
  await writeFile('timeline/index.html', html);
}

async function buildAbout(data) {
  const html = page(
    renderAbout({ about: data.about, owner: data.owner, portraitImage: data.aboutPortraitImage, flags: data.flags }),
    {
      title: `About — ${data.owner.name}`,
      description: data.site.description,
      activeKey: 'about',
      canonicalPath: '/about/',
      data,
    }
  );
  await writeFile('about/index.html', html);
}

async function buildGear(data) {
  if (!data.flags.hasGear) return;
  const html = page(renderGear(data.gear), {
    title: `Gear — ${data.owner.name}`,
    description: 'The camera and kit behind the work.',
    activeKey: 'gear',
    canonicalPath: '/gear/',
    data,
  });
  await writeFile('gear/index.html', html);
}

async function buildJournal(data) {
  if (!data.flags.hasJournal) return;
  const posts = data.journal.map((p) => ({ ...p, cover: p.cover, year: p.year || (p.html.match(/\d{4}/) || [])[0] }));

  const indexHtml = page(renderJournalIndex(posts), {
    title: `Journal — ${data.owner.name}`,
    description: 'Notes and stories from behind the lens.',
    activeKey: 'journal',
    canonicalPath: '/journal/',
    data,
  });
  await writeFile('journal/index.html', indexHtml);

  for (const post of posts) {
    const html = page(renderJournalDetail(post), {
      title: `${post.title} — Journal — ${data.owner.name}`,
      description: post.summary || post.title,
      activeKey: 'journal',
      canonicalPath: `/journal/${post.slug}/`,
      data,
    });
    await writeFile(`journal/${post.slug}/index.html`, html);
  }
}

async function buildIntroType(data) {
  const extraGoogleFamilies = Object.values(INTRO_FONTS).map((f) => f.google);
  const html = page(renderIntroType(data.controls), {
    title: `Intro type — ${data.owner.name}`,
    description: 'Gaunt type options for the SKD intro letters.',
    activeKey: '',
    canonicalPath: '/intro-type/',
    data,
    noIndex: true,
    extraGoogleFamilies,
  });
  await writeFile('intro-type/index.html', html);
}

async function build404(data) {
  const html = page(
    `<section class="hero wrap"><h1 class="hero-heading">That frame doesn't exist.</h1><p class="hero-sub"><a class="text-link" href="/">Back to the homepage</a></p></section>`,
    { title: `Not found — ${data.owner.name}`, description: 'Page not found.', activeKey: '', canonicalPath: '/404.html', data }
  );
  await writeFile('404.html', html);
}

async function copyStaticAssets() {
  await copyFile(path.join(ROOT, 'src/styles/main.css'), 'styles/main.css');
  await copyFile(path.join(ROOT, 'src/scripts/main.js'), 'scripts/main.js');
  await copyFile(path.join(ROOT, 'src/assets/favicon.svg'), 'assets/favicon.svg');
}

async function writeHostingFiles(data) {
  await writeFile('CNAME', `${DOMAIN}\n`);
  await writeFile('.nojekyll', '');
  await writeFile(
    'robots.txt',
    `User-agent: *\nAllow: /\nSitemap: ${data.site.url}/sitemap.xml\n`
  );

  const urls = ['/', '/about/'];
  if (data.flags.hasProjects) {
    urls.push('/projects/');
    data.projects.forEach((c) => urls.push(`/projects/${c.slug}/`));
  }
  if (data.flags.hasSeries) {
    urls.push('/series/');
    data.series.forEach((c) => urls.push(`/series/${c.slug}/`));
  }
  if (data.flags.hasPlaces) {
    urls.push('/places/');
    data.places.forEach((p) => urls.push(`/places/${p.slug}/`));
  }
  if (data.flags.hasThemes) {
    urls.push('/themes/');
    data.themes.forEach((t) => urls.push(`/themes/${t.slug}/`));
  }
  if (data.flags.hasUntitled) urls.push('/untitled/');
  if (data.flags.hasTimeline) urls.push('/timeline/');
  if (data.flags.hasGear) urls.push('/gear/');
  if (data.flags.hasJournal) {
    urls.push('/journal/');
    data.journal.forEach((p) => urls.push(`/journal/${p.slug}/`));
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${data.site.url}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  await writeFile('sitemap.xml', sitemap);
}

async function main() {
  const started = Date.now();
  console.log('→ Loading content…');
  const data = await loadSite(ROOT);

  if (data.about.data.portrait) {
    data.aboutPortraitImage = {
      src: `/about/${data.about.data.portrait}`,
      sourcePath: path.join(ROOT, data.about.data.portrait.startsWith('about/') ? data.about.data.portrait : `about/${data.about.data.portrait}`),
      alt: `${data.owner.name} portrait`,
    };
  }

  await fs.rm(DIST, { recursive: true, force: true });

  console.log('→ Processing images…');
  const count = await processAllImages(data);
  const introImages = await processIntroImages();
  Object.assign(data, introImages);
  console.log(`  processed ${count} image(s) + intro frames`);

  data.assetVersion = await computeAssetVersion();
  console.log(`→ Asset version ${data.assetVersion}`);

  console.log('→ Copying static assets…');
  await copyStaticAssets();

  console.log('→ Rendering pages…');
  await buildHome(data);
  await buildCollections(data, {
    list: data.projects,
    typeDir: 'projects',
    kindLabel: 'Project',
    activeKey: 'projects',
    title: 'Projects',
    description: 'Client and commissioned work.',
  });
  await buildCollections(data, {
    list: data.series,
    typeDir: 'series',
    kindLabel: 'Series',
    activeKey: 'series',
    title: 'Series',
    description: 'Personal, ongoing bodies of work.',
  });
  await buildPlaces(data);
  await buildThemes(data);
  await buildUntitled(data);
  await buildTimeline(data);
  await buildAbout(data);
  await buildGear(data);
  await buildJournal(data);
  await buildIntroType(data);
  await build404(data);
  await writeHostingFiles(data);

  const ms = Date.now() - started;
  if (data.coverWarnings?.length) {
    for (const warning of data.coverWarnings) console.warn(`  ! ${warning}`);
  }
  console.log('  TBD: series covers as a montage of the latest 2 and earliest 2 frames.');
  console.log(`✓ Build complete in ${ms}ms → dist/`);
  console.log(`  Projects: ${data.projects.length} · Series: ${data.series.length} · Places: ${data.places.length} · Untitled: ${data.untitled.images.length} · Timeline years: ${data.timelineYears.length} · Themes: ${data.themes.length} · Gear: ${data.gear.length} · Journal: ${data.journal.length} · Highlights: ${data.highlights.length}`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
