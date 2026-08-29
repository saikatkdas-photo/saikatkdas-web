#!/usr/bin/env node
/**
 * Merge one or more image folders into a single collection folder.
 * Each source image moves (or copies) together with its sidecar .md and
 * sibling thumbnails. Incoming files are renumbered so they never overwrite
 * frames already in the destination.
 *
 * Usage:
 *   node scripts/merge-folders.js --dest series/mullick-ghat "series/Mullick Ghat"
 *   node scripts/merge-folders.js --dest series/markets "series/KR Market" "series/Russell Market"
 *   node scripts/merge-folders.js --dest "series/Mullick Ghat" --repack
 *   node scripts/merge-folders.js --scan
 *
 * Options:
 *   --dest <path>   Destination folder relative to repo root (required unless --scan)
 *   --slug          Slugify the destination folder name (Mullick Ghat → mullick-ghat)
 *   --repack        Renumber every image in dest (+ sources) as one 01, 02, … sequence
 *   --keep-names    Keep incoming filenames instead of numbering (skips collisions)
 *   --move          Move instead of copy (default: copy, sources untouched)
 *   --dry-run       Print the plan without writing anything
 *   --scan          List series/projects folders and group same-slug names
 *   --start N       First number for incoming (or for --repack). Default: after dest max
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { isSourceImageFile, thumbnailNames } from './lib/image.js';
import { slugify } from './lib/slug.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_ROOTS = ['series', 'projects', 'photos'];
const README_NAMES = new Set(['readme.md', 'README.md']);
const TMP_PREFIX = '.merge-tmp-';

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

/** On-disk folder name (macOS APFS is case-insensitive; git paths are not). */
async function existingDirPath(absPath) {
  const resolved = path.resolve(absPath);
  const parent = path.dirname(resolved);
  const base = path.basename(resolved);
  if (!(await pathExists(parent))) return resolved;
  const entries = await fs.readdir(parent);
  const match = entries.find((e) => e.toLowerCase() === base.toLowerCase());
  return match ? path.join(parent, match) : resolved;
}

async function sameFile(a, b) {
  try {
    const [sa, sb] = await Promise.all([fs.stat(a), fs.stat(b)]);
    return sa.dev === sb.dev && sa.ino === sb.ino;
  } catch {
    return false;
  }
}

async function sameDirectory(a, b) {
  if (await pathExists(a) && await pathExists(b)) {
    return sameFile(a, b);
  }
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function rel(p) {
  const resolved = path.resolve(p);
  const relative = path.relative(ROOT, resolved);
  return relative.startsWith('..') ? resolved : relative;
}

function numberedBase(n) {
  return String(n).padStart(2, '0');
}

function parseNumber(fileName) {
  const n = Number.parseInt(path.basename(fileName, path.extname(fileName)), 10);
  return Number.isFinite(n) ? n : null;
}

function companionNames(base) {
  const thumbs = thumbnailNames(base);
  return [`${base}.md`, thumbs.webp, thumbs.jpg];
}

async function listImageGroups(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const images = entries
    .filter((e) => e.isFile() && isSourceImageFile(e.name))
    .map((e) => e.name)
    .sort(naturalCompare);

  const groups = [];
  for (const image of images) {
    const ext = path.extname(image);
    const base = path.basename(image, ext);
    const companions = [];
    for (const name of companionNames(base)) {
      if (await pathExists(path.join(dir, name))) companions.push(name);
    }
    groups.push({ dir, image, ext, base, companions });
  }
  return groups;
}

async function listCollectionFolders() {
  const rows = [];
  for (const typeDir of CONTENT_ROOTS) {
    const abs = path.join(ROOT, typeDir);
    if (!(await pathExists(abs))) continue;
    if (typeDir === 'photos') {
      const groups = await listImageGroups(abs);
      rows.push({
        typeDir,
        name: 'photos',
        rel: 'photos',
        slug: 'untitled',
        images: groups.length,
        readme: await pathExists(path.join(abs, 'readme.md')) || await pathExists(path.join(abs, 'README.md')),
      });
      continue;
    }
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const dir = path.join(abs, entry.name);
      const groups = await listImageGroups(dir);
      rows.push({
        typeDir,
        name: entry.name,
        rel: `${typeDir}/${entry.name}`,
        slug: slugify(entry.name),
        images: groups.length,
        readme: await pathExists(path.join(dir, 'readme.md')) || await pathExists(path.join(dir, 'README.md')),
      });
    }
  }
  return rows;
}

async function scanFolders() {
  const rows = await listCollectionFolders();
  if (rows.length === 0) {
    console.log('No content folders found under series/, projects/, or photos/.');
    return;
  }

  console.log('\nContent folders\n');
  console.table(rows.map((r) => ({
    folder: r.rel,
    slug: r.slug,
    images: r.images,
    readme: r.readme ? 'yes' : '—',
  })));

  const bySlug = new Map();
  for (const row of rows) {
    if (!bySlug.has(row.slug)) bySlug.set(row.slug, []);
    bySlug.get(row.slug).push(row);
  }

  const collisions = [...bySlug.entries()].filter(([, list]) => list.length > 1);
  if (collisions.length === 0) {
    console.log('No same-slug folder pairs. To merge two folders:');
    console.log('  node scripts/merge-folders.js --dest series/<slug> "series/Folder A" "series/Folder B" --dry-run');
    return;
  }

  console.log('\nSame slug — candidates to merge:\n');
  for (const [slug, list] of collisions) {
    const dest = list[0].rel;
    const sources = list.slice(1).map((r) => `"${r.rel}"`).join(' ');
    console.log(`  ${slug}`);
    for (const item of list) console.log(`    ${item.rel}  (${item.images} image${item.images === 1 ? '' : 's'})`);
    console.log(`    node scripts/merge-folders.js --dest ${dest} ${sources} --dry-run`);
    console.log('');
  }
}

function resolveDest(rawDest, slugifyName) {
  const destDir = path.resolve(ROOT, rawDest);
  if (slugifyName) {
    return path.join(path.dirname(destDir), slugify(path.basename(destDir)));
  }
  return destDir;
}

function assertInsideRepo(absPath, label) {
  const prefix = ROOT + path.sep;
  if (absPath !== ROOT && !absPath.startsWith(prefix)) {
    console.error(`✗ ${label} must live inside the repo: ${absPath}`);
    process.exit(1);
  }
}

async function findReadme(dir) {
  for (const name of ['readme.md', 'README.md']) {
    const candidate = path.join(dir, name);
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

function planName(group, keepNames, nextNumber) {
  if (keepNames) {
    const safe = group.base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || numberedBase(nextNumber);
    return { destBase: safe, consumedNumber: false };
  }
  return { destBase: numberedBase(nextNumber), consumedNumber: true };
}

function fileMoves(group, destDir, destBase) {
  const moves = [{
    from: path.join(group.dir, group.image),
    to: path.join(destDir, `${destBase}${group.ext}`),
    kind: 'image',
  }];
  for (const name of group.companions) {
    const from = path.join(group.dir, name);
    let toName = name;
    if (name === `${group.base}.md`) toName = `${destBase}.md`;
    else if (name === `${group.base}.thumb.webp`) toName = `${destBase}.thumb.webp`;
    else if (name === `${group.base}.thumb.jpg`) toName = `${destBase}.thumb.jpg`;
    moves.push({ from, to: path.join(destDir, toName), kind: 'companion' });
  }
  return moves;
}

async function transfer(from, to, move) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  if (await sameFile(from, to)) return;
  if (move) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      if (err.code !== 'EXDEV') throw err;
    }
  }
  await fs.copyFile(from, to);
  if (move) await fs.unlink(from);
}

async function dirIsEmpty(dir) {
  let entries = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return true;
  }
  const leftovers = entries.filter((name) => name !== '.DS_Store' && !name.startsWith(TMP_PREFIX));
  return leftovers.length === 0;
}

async function removeEmptyDir(dir) {
  if (dir === ROOT || !(await pathExists(dir))) return false;
  const entries = await fs.readdir(dir);
  for (const name of entries) {
    if (name === '.DS_Store' || name.startsWith(TMP_PREFIX)) {
      await fs.unlink(path.join(dir, name)).catch(() => {});
    }
  }
  if (await dirIsEmpty(dir)) {
    await fs.rmdir(dir);
    return true;
  }
  return false;
}

async function mergeFolders(values, sourceArgs) {
  let destDir = resolveDest(values.dest, values.slug);
  assertInsideRepo(destDir, 'Destination');
  if (await pathExists(destDir)) destDir = await existingDirPath(destDir);

  const sourceDirs = [];
  for (const raw of sourceArgs) {
    const abs = await existingDirPath(path.resolve(ROOT, raw));
    if (!(await pathExists(abs))) {
      console.error(`✗ Source directory not found: ${abs}`);
      process.exit(1);
    }
    sourceDirs.push(abs);
  }

  const destExists = await pathExists(destDir);
  const destIsSource = [];
  const incomingDirs = [];
  for (const src of sourceDirs) {
    if (destExists && await sameDirectory(src, destDir)) {
      destIsSource.push(src);
    } else {
      incomingDirs.push(src);
    }
  }

  if (!destExists && incomingDirs.length === 0 && destIsSource.length === 0) {
    console.error('✗ Pass at least one source folder, or an existing --dest with --repack.');
    process.exit(1);
  }

  if (incomingDirs.length === 0 && !values.repack && destExists) {
    console.error('✗ Destination already exists and no other folders were passed.');
    console.error('   Add source folders to append, or pass --repack to renumber in place.');
    process.exit(1);
  }

  const destGroups = destExists ? await listImageGroups(destDir) : [];
  const incomingGroups = [];
  for (const dir of incomingDirs) {
    incomingGroups.push(...await listImageGroups(dir));
  }

  if (destGroups.length === 0 && incomingGroups.length === 0) {
    console.error('✗ No images (.jpg/.jpeg/.png/.webp) found in the given folders.');
    process.exit(1);
  }

  const destNumbers = destGroups.map((g) => parseNumber(g.image)).filter((n) => n != null);
  const defaultStart = destNumbers.length && !values.repack ? Math.max(...destNumbers) + 1 : 1;
  let nextNumber = values.start ? Number.parseInt(values.start, 10) : defaultStart;
  if (!Number.isFinite(nextNumber) || nextNumber < 1) {
    console.error('✗ --start must be a positive integer.');
    process.exit(1);
  }

  const reserved = new Set();
  const jobs = [];

  function reserve(destBase, ext) {
    const key = `${destBase}${ext}`.toLowerCase();
    if (reserved.has(key)) return false;
    reserved.add(key);
    return true;
  }

  const inPlaceRepack = values.repack && incomingGroups.length === 0;
  const keepDestAsIs = destExists && !inPlaceRepack;
  if (keepDestAsIs) {
    for (const group of destGroups) {
      reserved.add(`${group.base}${group.ext}`.toLowerCase());
      jobs.push({ group, destBase: group.base, keep: true });
    }
  }

  // Dest frames always keep their names unless this is an in-place --repack.
  // Incoming is appended after dest. Never sort a source ahead of dest and
  // write it onto dest/01.jpg — that is what clobbered folders on APFS.
  const toAssign = inPlaceRepack
    ? [...destGroups].sort((a, b) => naturalCompare(a.image, b.image))
    : incomingGroups.sort((a, b) => {
      const dirCmp = naturalCompare(rel(a.dir), rel(b.dir));
      if (dirCmp !== 0) return dirCmp;
      return naturalCompare(a.image, b.image);
    });

  for (const group of toAssign) {
    let destBase;
    let consumed = false;
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const planned = planName(group, values['keep-names'] && !values.repack, nextNumber);
      destBase = planned.destBase;
      consumed = planned.consumedNumber;
      if (reserve(destBase, group.ext)) break;
      if (values['keep-names'] && !values.repack) {
        destBase = null;
        break;
      }
      nextNumber += 1;
    }
    if (!destBase) {
      console.warn(`  ! Skipping ${rel(path.join(group.dir, group.image))} — ${group.image} already exists in destination.`);
      continue;
    }
    if (consumed) nextNumber += 1;
    jobs.push({ group, destBase, keep: false });
  }

  const rows = [];
  const allMoves = [];
  for (const job of jobs) {
    const moves = fileMoves(job.group, destDir, job.destBase);
    const imageMove = moves[0];
    const unchanged = await sameFile(imageMove.from, imageMove.to);
    rows.push({
      from: `${rel(job.group.dir)}/${job.group.image}`,
      to: `${rel(destDir)}/${job.destBase}${job.group.ext}`,
      extras: job.group.companions.length,
      action: unchanged ? 'keep' : (values.move ? 'move' : 'copy'),
    });
    if (!unchanged) allMoves.push(...moves);
  }

  console.log(`\nMerging into ${rel(destDir)}/\n`);
  if (incomingDirs.length) {
    console.log(`Sources: ${incomingDirs.map((d) => rel(d)).join(', ')}`);
  }
  if (values.repack) console.log('Repack: renumbering the whole destination as one sequence.');
  if (values.move) console.log('Mode: move');
  else console.log('Mode: copy (pass --move to relocate sources)');
  console.log('');
  console.table(rows);

  const destReadme = destExists ? await findReadme(destDir) : null;
  let readmeFrom = null;
  if (!destReadme) {
    for (const dir of [...(destExists ? [destDir] : []), ...incomingDirs]) {
      const found = await findReadme(dir);
      if (found) {
        readmeFrom = found;
        break;
      }
    }
  }

  if (values['dry-run']) {
    if (readmeFrom) console.log(`\nWould copy ${rel(readmeFrom)} → ${rel(destDir)}/readme.md`);
    else if (!destReadme) console.log(`\n! No readme.md in destination yet — add one so this collection has a title.`);
    console.log('\n(dry run — nothing was written)');
    return;
  }

  await fs.mkdir(destDir, { recursive: true });

  const stamp = `${Date.now()}`;
  let stagedAny = false;
  for (const [index, move] of allMoves.entries()) {
    const fromInDest = await sameDirectory(path.dirname(move.from), destDir);
    const targetExists = await pathExists(move.to);
    if (!fromInDest && !targetExists) continue;
    if (await sameFile(move.from, move.to)) continue;
    const staged = path.join(destDir, `${TMP_PREFIX}${stamp}-${index}${path.extname(move.from)}`);
    await fs.rename(move.from, staged);
    move.from = staged;
    stagedAny = true;
  }

  for (const move of allMoves) {
    if (await pathExists(move.to) && !(await sameFile(move.from, move.to))) {
      console.error(`✗ Refusing to overwrite ${rel(move.to)}`);
      process.exit(1);
    }
    await transfer(move.from, move.to, values.move || stagedAny);
  }

  if (readmeFrom && !(await findReadme(destDir))) {
    await fs.copyFile(readmeFrom, path.join(destDir, 'readme.md'));
    if (values.move && path.dirname(readmeFrom) !== destDir) {
      await fs.unlink(readmeFrom);
    }
    console.log(`\nCopied ${rel(readmeFrom)} → ${rel(destDir)}/readme.md`);
  } else if (!(await findReadme(destDir))) {
    console.warn(`\n  ! No readme.md in ${rel(destDir)} yet — run scripts/new-project.js or add one so this collection has a title/summary.`);
  }

  if (values.move) {
    const removed = [];
    for (const dir of incomingDirs) {
      if (await removeEmptyDir(dir)) removed.push(rel(dir));
    }
    if (removed.length) console.log(`Removed empty folder${removed.length === 1 ? '' : 's'}: ${removed.join(', ')}`);
  }

  const written = rows.filter((r) => r.action !== 'keep').length;
  console.log(`\n✓ ${written} image${written === 1 ? '' : 's'} ${values.move ? 'moved' : 'copied'} into ${rel(destDir)}/. Run \`npm run build\` to see them on the site.`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dest: { type: 'string' },
      slug: { type: 'boolean', default: false },
      repack: { type: 'boolean', default: false },
      'keep-names': { type: 'boolean', default: false },
      move: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      scan: { type: 'boolean', default: false },
      start: { type: 'string' },
    },
  });

  if (values.scan) {
    await scanFolders();
    return;
  }

  if (!values.dest) {
    console.error('Usage: node scripts/merge-folders.js --dest <projects|series|photos>/<slug> [source-folders…]');
    console.error('   or: node scripts/merge-folders.js --dest <folder> --repack');
    console.error('   or: node scripts/merge-folders.js --scan');
    process.exit(1);
  }

  await mergeFolders(values, positionals);
}

main().catch((err) => {
  console.error('Merge failed:', err);
  process.exit(1);
});
