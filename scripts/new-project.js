#!/usr/bin/env node
/**
 * Interactive scaffolder for a new project or series folder.
 * Usage: node scripts/new-project.js
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { slugify } from './lib/slug.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, fallback = '') => rl.question(fallback ? `${q} [${fallback}]: ` : `${q}: `).then((a) => a.trim() || fallback);

  console.log('New project / series scaffolder\n');

  let type = (await ask('Type — "project" (client work) or "series" (personal work)', 'series')).toLowerCase();
  if (type !== 'project' && type !== 'series') type = 'series';
  const typeDir = type === 'project' ? 'projects' : 'series';

  const title = await ask('Title (e.g. "Kolkata Streets")');
  if (!title) {
    console.error('A title is required.');
    rl.close();
    process.exit(1);
  }
  const slug = slugify(await ask('Slug (URL-friendly id)', slugify(title)));

  const destDir = path.join(ROOT, typeDir, slug);
  if (await pathExists(destDir)) {
    console.error(`\n✗ ${typeDir}/${slug} already exists. Aborting.`);
    rl.close();
    process.exit(1);
  }

  const summary = await ask('One-line summary (optional)');
  let client = '', industry = '', services = '', year = '';
  if (type === 'project') {
    client = await ask('Client (optional)');
    industry = await ask('Industry (optional)');
    services = await ask('Service(s), comma-separated (optional)');
  }
  year = await ask('Year (optional)', String(new Date().getFullYear()));
  const tags = await ask('Tags, comma-separated — cascade to every image in this folder (optional)');
  const body = await ask('Write-up / description (optional, you can also edit readme.md later)');

  rl.close();

  await fs.mkdir(destDir, { recursive: true });

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    summary ? `summary: "${summary.replace(/"/g, '\\"')}"` : null,
    type === 'project' && client ? `client: "${client.replace(/"/g, '\\"')}"` : null,
    type === 'project' && industry ? `industry: "${industry.replace(/"/g, '\\"')}"` : null,
    type === 'project' && services ? `services: [${services.split(',').map((s) => `"${s.trim()}"`).join(', ')}]` : null,
    year ? `year: ${year}` : null,
    tags ? `tags: [${tags.split(',').map((t) => `"${slugify(t.trim())}"`).join(', ')}]` : null,
    'cover:',
    '---',
    '',
    body || `<!-- TODO(saikat): write the story behind "${title}" here. -->`,
    '',
  ].filter((line) => line !== null).join('\n');

  await fs.writeFile(path.join(destDir, 'readme.md'), frontmatter, 'utf8');

  console.log(`\n✓ Created ${typeDir}/${slug}/readme.md`);
  console.log(`  Next: drop images into ${typeDir}/${slug}/, then run:`);
  console.log(`    node scripts/import-photos.js --source "/path/to/your/images" --dest ${typeDir}/${slug}`);
  console.log('  …or add images + sidecar .md files by hand, then `npm run build`.');
}

main();
