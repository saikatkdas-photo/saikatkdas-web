#!/usr/bin/env node
/**
 * Batch-import photos from a single source directory into the site's
 * project/series/photos folder structure — copies images, extracts EXIF,
 * auto-tags color vs monochrome, and writes a sidecar .md per image with a
 * caption placeholder ready for you to fill in.
 *
 * Usage:
 *   node scripts/import-photos.js --source "/path/to/folder" --dest series/japan
 *
 * Options:
 *   --source <dir>       Folder of source images (required)
 *   --dest <path>        Destination folder relative to repo root, e.g. series/japan (required)
 *   --place <slug>       Set the image `place:` field (photo appears under /places/<slug>/)
 *   --tags a,b,c         Extra tags applied to every imported image (in addition to auto color/monochrome)
 *   --highlight          Mark every imported image as a homepage highlight
 *   --highlight-start N  Starting `order` value for highlights (default: continues after existing max)
 *   --link <path>        Explicit link target for highlighted images, e.g. /series/japan/ (default: parent collection)
 *   --keep-names         Keep original filenames instead of renumbering sequentially
 *   --move               Move instead of copy (default: copy, source untouched)
 *   --dry-run            Print what would happen without writing anything
 *   --ensure-thumbs      Write missing *.thumb.webp/*.thumb.jpg next to every existing image
 *   --promote-places     One-time: copy kolkata/bangalore off tags onto place: (no --source/--dest)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import matter from 'gray-matter';
import { extractExif } from './lib/exif.js';
import { detectIsMonochrome, generateThumbnail, ensureAllThumbnails, isSourceImageFile } from './lib/image.js';
import {
  applyPlaceToFrontmatter,
  normalizeTags,
  resolvePlace,
  stripPlaceTags,
  stripPlacesFromCollectionFrontmatter,
} from './lib/place.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function yamlString(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function yamlList(values) {
  return `[${values.map((v) => yamlString(v)).join(', ')}]`;
}

async function readFrontmatter(filePath) {
  if (!(await pathExists(filePath))) return {};
  const raw = await fs.readFile(filePath, 'utf8');
  return matter(raw).data || {};
}

async function promotePlacesFromTags(rootDir, { dryRun = false } = {}) {
  const rows = [];

  async function walk(dir, collectionTags) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const readme = entries.find((e) => e.isFile() && /^readme\.md$/i.test(e.name));
    let nextCollectionTags = collectionTags;
    if (readme) {
      const data = await readFrontmatter(path.join(dir, readme.name));
      nextCollectionTags = [...collectionTags, ...normalizeTags(data.tags)];
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, nextCollectionTags);
        continue;
      }
      if (!isSourceImageFile(entry.name)) continue;

      const mdPath = path.join(dir, `${path.basename(entry.name, path.extname(entry.name))}.md`);
      if (!(await pathExists(mdPath))) continue;

      const raw = await fs.readFile(mdPath, 'utf8');
      const data = matter(raw).data || {};
      const place = resolvePlace({
        place: data.place,
        ownTags: data.tags,
        collectionTags: nextCollectionTags,
      });
      if (!place) continue;

      const result = applyPlaceToFrontmatter(raw, place);
      const rel = path.relative(rootDir, mdPath);
      if (!result.changed) {
        rows.push({ file: rel, place, action: 'keep' });
        continue;
      }
      if (!dryRun) await fs.writeFile(mdPath, result.text, 'utf8');
      rows.push({ file: rel, place: result.place, action: 'write' });
    }

    if (readme) {
      const readmePath = path.join(dir, readme.name);
      const raw = await fs.readFile(readmePath, 'utf8');
      const result = stripPlacesFromCollectionFrontmatter(raw);
      if (result.changed) {
        if (!dryRun) await fs.writeFile(readmePath, result.text, 'utf8');
        rows.push({ file: path.relative(rootDir, readmePath), place: '—', action: 'readme' });
      }
    }
  }

  for (const rel of ['photos', 'projects', 'series', 'journal']) {
    await walk(path.join(rootDir, rel), []);
  }
  return rows;
}

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      dest: { type: 'string' },
      place: { type: 'string', default: '' },
      tags: { type: 'string', default: '' },
      highlight: { type: 'boolean', default: false },
      'highlight-start': { type: 'string' },
      link: { type: 'string', default: '' },
      'keep-names': { type: 'boolean', default: false },
      move: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'ensure-thumbs': { type: 'boolean', default: false },
      'promote-places': { type: 'boolean', default: false },
    },
  });

  if (values['promote-places'] && !values.source && !values.dest) {
    const rows = await promotePlacesFromTags(ROOT, { dryRun: values['dry-run'] });
    if (rows.length) console.table(rows);
    else console.log('No kolkata/bangalore tags left to promote.');
    console.log(values['dry-run']
      ? '\n(dry run — nothing was written)'
      : `\n✓ Promoted place on ${rows.filter((r) => r.action === 'write').length} file(s).`);
    return;
  }

  if (values['ensure-thumbs'] && !values.source && !values.dest) {
    if (values['dry-run']) {
      console.log('(dry run — would write missing thumbnails next to existing images)');
      return;
    }
    const { created, cached } = await ensureAllThumbnails(ROOT);
    console.log(`✓ Thumbnails: ${created} created, ${cached} already fresh.`);
    return;
  }

  if (!values.source || !values.dest) {
    console.error('Usage: node scripts/import-photos.js --source <dir> --dest <projects|series|photos>/<slug>');
    console.error('   or: node scripts/import-photos.js --ensure-thumbs');
    console.error('   or: node scripts/import-photos.js --promote-places');
    process.exit(1);
  }

  const sourceDir = path.resolve(values.source);
  const destDir = path.resolve(ROOT, values.dest);

  if (!(await pathExists(sourceDir))) {
    console.error(`✗ Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  const withinRoot = destDir.startsWith(ROOT + path.sep);
  if (!withinRoot) {
    console.error(`✗ Destination must live inside the repo: ${destDir}`);
    process.exit(1);
  }

  await fs.mkdir(destDir, { recursive: true });

  const readmePath = path.join(destDir, 'readme.md');
  if (!(await pathExists(readmePath))) {
    console.warn(`  ! No readme.md found in ${values.dest} yet — run scripts/new-project.js or add one so this collection has a title/summary.`);
  }

  const sourceEntries = (await fs.readdir(sourceDir, { withFileTypes: true }))
    .filter((e) => e.isFile() && isSourceImageFile(e.name))
    .map((e) => e.name)
    .sort(naturalCompare);

  if (sourceEntries.length === 0) {
    console.error(`✗ No images (.jpg/.jpeg/.png/.webp) found in ${sourceDir}`);
    process.exit(1);
  }

  const existingEntries = (await fs.readdir(destDir, { withFileTypes: true }))
    .filter((e) => e.isFile() && isSourceImageFile(e.name))
    .map((e) => e.name);
  const existingNumbers = existingEntries
    .map((f) => Number.parseInt(path.basename(f, path.extname(f)), 10))
    .filter((n) => Number.isFinite(n));
  let nextNumber = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;

  let highlightOrder = values['highlight-start'] ? Number.parseInt(values['highlight-start'], 10)
    : (existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1);

  const extraTags = values.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const place = resolvePlace({ place: values.place, ownTags: extraTags });
  const extraTagsWithoutPlace = stripPlaceTags(extraTags);

  console.log(`\nImporting ${sourceEntries.length} image(s) from\n  ${sourceDir}\ninto\n  ${path.relative(ROOT, destDir)}/\n`);

  const rows = [];

  for (const fileName of sourceEntries) {
    const ext = path.extname(fileName).toLowerCase();
    const srcPath = path.join(sourceDir, fileName);

    const destBaseName = values['keep-names']
      ? path.basename(fileName, ext).toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
      : String(nextNumber).padStart(2, '0');
    if (!values['keep-names']) nextNumber += 1;

    const destFileName = `${destBaseName}${ext}`;
    const destImagePath = path.join(destDir, destFileName);
    const destMdPath = path.join(destDir, `${destBaseName}.md`);

    if (await pathExists(destImagePath)) {
      console.warn(`  ! Skipping ${fileName} — ${destFileName} already exists in destination.`);
      continue;
    }

    const [exif, isMonochrome] = await Promise.all([
      extractExif(srcPath),
      detectIsMonochrome(srcPath).catch(() => false),
    ]);

    const tags = [...new Set([...extraTagsWithoutPlace, isMonochrome ? 'monochrome' : 'color'])];
    const isHighlight = values.highlight;
    const order = isHighlight ? highlightOrder++ : null;

    const frontmatterLines = [
      '---',
      `alt: ${yamlString(path.basename(fileName, ext).replace(/[_-]+/g, ' '))}`,
      'caption:',
      place ? `place: ${yamlString(place)}` : null,
      `tags: ${yamlList(tags)}`,
      `highlight: ${isHighlight}`,
      'cover: false',
      'story:',
      order != null ? `order: ${order}` : null,
      values.link ? `link: ${yamlString(values.link)}` : null,
      exif.camera ? `camera: ${yamlString(exif.camera)}` : null,
      exif.lens ? `lens: ${yamlString(exif.lens)}` : null,
      exif.aperture ? `aperture: ${yamlString(exif.aperture)}` : null,
      exif.shutter ? `shutter: ${yamlString(exif.shutter)}` : null,
      exif.focalLength ? `focalLength: ${yamlString(exif.focalLength)}` : null,
      exif.iso ? `iso: ${exif.iso}` : null,
      exif.takenAt ? `takenAt: ${yamlString(exif.takenAt)}` : null,
      exif.gps ? `location: ${yamlString(`${exif.gps.lat}, ${exif.gps.lng}`)}` : null,
      '---',
      '',
      '<!-- TODO(saikat): add a caption or short story for this photo -->',
      '',
    ].filter((l) => l !== null).join('\n');

    if (!values['dry-run']) {
      if (values.move) {
        await fs.rename(srcPath, destImagePath);
      } else {
        await fs.copyFile(srcPath, destImagePath);
      }
      await fs.writeFile(destMdPath, frontmatterLines, 'utf8');
      await generateThumbnail(destImagePath);
    }

    rows.push({
      file: fileName,
      dest: destFileName,
      camera: exif.camera || '—',
      taken: exif.takenAt || '—',
      place: place || '—',
      color: isMonochrome ? 'mono' : 'color',
      highlight: isHighlight ? `yes (#${order})` : 'no',
    });
  }

  console.table(rows);
  console.log(values['dry-run'] ? '\n(dry run — nothing was written)' : `\n✓ Imported ${rows.length} image(s). Run \`npm run build\` to see them on the site.`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
