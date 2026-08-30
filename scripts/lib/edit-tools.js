import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { slugify } from './slug.js';
import { isSourceImageFile } from './image.js';

const DEST_ROOTS = ['series', 'projects', 'photos'];

function toPosix(rel) {
  return String(rel || '').split(path.sep).join('/');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function assertContentDest(relPath) {
  const rel = toPosix(relPath).replace(/^\/+/, '').replace(/\/+$/, '');
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) {
    const err = new Error('Destination must be a repo-relative folder');
    err.status = 400;
    throw err;
  }
  const top = rel.split('/')[0];
  if (!DEST_ROOTS.includes(top)) {
    const err = new Error('Destination must be under series/, projects/, or photos/');
    err.status = 400;
    throw err;
  }
  if (top !== 'photos' && !rel.split('/')[1]) {
    const err = new Error('Destination needs a folder name, e.g. series/japan');
    err.status = 400;
    throw err;
  }
  return rel;
}

export async function listCollections(rootDir) {
  const items = [];
  for (const root of DEST_ROOTS) {
    const abs = path.join(rootDir, root);
    if (!(await pathExists(abs))) continue;
    if (root === 'photos') {
      items.push(await collectionInfo(rootDir, abs, 'photos'));
      continue;
    }
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      items.push(await collectionInfo(rootDir, path.join(abs, entry.name), `${root}/${entry.name}`));
    }
  }
  items.sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true, sensitivity: 'base' }));
  return items;
}

async function collectionInfo(rootDir, abs, rel) {
  let images = 0;
  let readme = false;
  let title = path.basename(abs);
  try {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && isSourceImageFile(entry.name)) images += 1;
      if (entry.isFile() && /^readme\.md$/i.test(entry.name)) {
        readme = true;
        try {
          const raw = await fs.readFile(path.join(abs, entry.name), 'utf8');
          const match = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m);
          if (match) title = match[1].replace(/^["']|["']$/g, '');
        } catch { /* keep folder name */ }
      }
    }
  } catch { /* empty or unreadable */ }
  return { rel: toPosix(rel), title, images, readme, kind: rel.split('/')[0] };
}

export function browseShortcuts(rootDir) {
  const home = os.homedir();
  const names = [
    { label: 'Home', path: home },
    { label: 'Desktop', path: path.join(home, 'Desktop') },
    { label: 'Pictures', path: path.join(home, 'Pictures') },
    { label: 'Documents', path: path.join(home, 'Documents') },
    { label: 'Repo', path: rootDir },
  ];
  return names;
}

export async function browseDir(requested) {
  const home = os.homedir();
  const raw = String(requested || '').trim() || home;
  const abs = path.resolve(raw);
  let entries;
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch (err) {
    const error = new Error(err.code === 'ENOENT' ? 'Folder not found' : 'Cannot read folder');
    error.status = 400;
    throw error;
  }

  const dirs = [];
  let images = 0;
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, path: path.join(abs, entry.name) });
    } else if (entry.isFile() && isSourceImageFile(entry.name)) {
      images += 1;
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const parent = path.dirname(abs);
  return {
    path: abs,
    parent: parent !== abs ? parent : '',
    images,
    dirs,
  };
}

export async function createCollection(rootDir, input) {
  const type = input.type === 'project' ? 'project' : 'series';
  const typeDir = type === 'project' ? 'projects' : 'series';
  const title = String(input.title || '').trim();
  if (!title) {
    const err = new Error('A title is required');
    err.status = 400;
    throw err;
  }
  const slug = slugify(input.slug || title);
  if (!slug) {
    const err = new Error('A slug is required');
    err.status = 400;
    throw err;
  }
  const destRel = `${typeDir}/${slug}`;
  const destDir = path.join(rootDir, typeDir, slug);
  if (await pathExists(destDir)) {
    const err = new Error(`${destRel} already exists`);
    err.status = 409;
    throw err;
  }

  const summary = String(input.summary || '').trim();
  const year = String(input.year || '').trim();
  const tags = String(input.tags || '').split(',').map((t) => slugify(t.trim())).filter(Boolean);
  const body = String(input.body || '').trim();
  const client = String(input.client || '').trim();
  const industry = String(input.industry || '').trim();
  const services = String(input.services || '').split(',').map((s) => s.trim()).filter(Boolean);

  await fs.mkdir(destDir, { recursive: true });
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    summary ? `summary: "${summary.replace(/"/g, '\\"')}"` : null,
    type === 'project' && client ? `client: "${client.replace(/"/g, '\\"')}"` : null,
    type === 'project' && industry ? `industry: "${industry.replace(/"/g, '\\"')}"` : null,
    type === 'project' && services.length ? `services: [${services.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(', ')}]` : null,
    year ? `year: ${year}` : null,
    tags.length ? `tags: [${tags.map((t) => `"${t}"`).join(', ')}]` : null,
    '---',
    '',
    body || `<!-- TODO(saikat): write the story behind "${title}" here. -->`,
    '',
  ].filter((line) => line !== null).join('\n');

  const readmeRel = `${destRel}/readme.md`;
  await fs.writeFile(path.join(destDir, 'readme.md'), frontmatter, 'utf8');
  return { path: readmeRel, dest: destRel };
}

export function buildImportArgs(body) {
  const dest = assertContentDest(body.dest);
  const source = String(body.source || '').trim();
  if (!source) {
    const err = new Error('Source folder is required');
    err.status = 400;
    throw err;
  }
  const args = ['--source', source, '--dest', dest];
  if (body.place) args.push('--place', String(body.place).trim());
  if (body.tags) args.push('--tags', String(body.tags).trim());
  if (body.link) args.push('--link', String(body.link).trim());
  if (body.highlight) args.push('--highlight');
  if (body.highlightStart) args.push('--highlight-start', String(body.highlightStart));
  if (body.keepNames) args.push('--keep-names');
  if (body.move) args.push('--move');
  if (body.dryRun) args.push('--dry-run');
  return args;
}

export function buildMergeArgs(body) {
  const dest = assertContentDest(body.dest);
  const sources = (Array.isArray(body.sources) ? body.sources : [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map(assertContentDest);
  if (!body.repack && !sources.length) {
    const err = new Error('Pick at least one source folder, or use Repack on the destination');
    err.status = 400;
    throw err;
  }
  const args = ['--dest', dest, ...sources];
  if (body.slug) args.push('--slug');
  if (body.repack) args.push('--repack');
  if (body.keepNames) args.push('--keep-names');
  if (body.move) args.push('--move');
  if (body.dryRun) args.push('--dry-run');
  if (body.start) args.push('--start', String(body.start));
  return args;
}

export function buildSimpleArgs(body = {}) {
  const args = [];
  if (body.dryRun) args.push('--dry-run');
  return args;
}
