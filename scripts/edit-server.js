#!/usr/bin/env node
/**
 * Local content editor for markdown files and data/controls.yaml.
 * Usage: npm run edit
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, exec } from 'node:child_process';
import {
  detectKind,
  editorMeta,
  isAssetPath,
  isEditablePath,
  listEditableFiles,
  readEditable,
  resolveUnderRoot,
  parseEditable,
  serializeControls,
  serializeMarkdown,
  writeEditable,
} from './lib/edit-io.js';
import {
  browseDir,
  browseShortcuts,
  buildImportArgs,
  buildMergeArgs,
  buildSimpleArgs,
  createCollection,
  listCollections,
} from './lib/edit-tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UI = path.join(__dirname, 'edit-ui');
const PORT = Number(process.env.EDIT_PORT || process.env.PORT || 4174);
const HOST = '127.0.0.1';
const OPEN = !process.argv.includes('--no-open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function queryParam(url, key) {
  return new URL(url, `http://${HOST}`).searchParams.get(key) || '';
}

async function loadSite() {
  try {
    const raw = await fsp.readFile(path.join(ROOT, 'data', 'site.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { nav: [] };
  }
}

function serveStatic(req, res, urlPath) {
  const file = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const full = path.resolve(UI, file);
  if (!full.startsWith(UI + path.sep) && full !== UI) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(full);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}

function serveAsset(req, res, relPath) {
  const resolved = resolveUnderRoot(ROOT, relPath);
  if (!resolved || !isAssetPath(resolved.rel)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  if (!fs.existsSync(resolved.full)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(resolved.full);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(resolved.full).pipe(res);
}

let jobProc = null;

function runNodeScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    if (jobProc) {
      reject(Object.assign(new Error('Another job is already running'), { status: 409 }));
      return;
    }
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', scriptName), ...args], {
      cwd: ROOT,
      env: process.env,
    });
    jobProc = child;
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (err) => {
      jobProc = null;
      reject(err);
    });
    child.on('close', (code) => {
      jobProc = null;
      resolve({ ok: code === 0, code, output, args: [scriptName, ...args] });
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const pathname = url.pathname;

  try {
    if (pathname === '/api/tree' && req.method === 'GET') {
      json(res, 200, { groups: await listEditableFiles(ROOT) });
      return;
    }

    if (pathname === '/api/meta' && req.method === 'GET') {
      json(res, 200, editorMeta(await loadSite()));
      return;
    }

    if (pathname === '/api/file' && req.method === 'GET') {
      const rel = queryParam(req.url, 'path');
      json(res, 200, await readEditable(ROOT, rel));
      return;
    }

    if (pathname === '/api/file' && req.method === 'POST') {
      const body = await readBody(req);
      json(res, 200, await writeEditable(ROOT, body));
      return;
    }

    if (pathname === '/api/parse' && req.method === 'POST') {
      const body = await readBody(req);
      if (!isEditablePath(body.path || '')) {
        json(res, 400, { error: 'File is not editable' });
        return;
      }
      json(res, 200, parseEditable(body.path, String(body.raw || '')));
      return;
    }

    if (pathname === '/api/serialize' && req.method === 'POST') {
      const body = await readBody(req);
      const kind = detectKind(body.path || '');
      if (!isEditablePath(body.path || '')) {
        json(res, 400, { error: 'File is not editable' });
        return;
      }
      const raw = kind === 'controls'
        ? serializeControls(body.controls || body.data || {})
        : serializeMarkdown(kind, body.data || {}, body.content || '');
      json(res, 200, { raw });
      return;
    }

    if (pathname === '/api/rebuild' && req.method === 'POST') {
      const result = await runNodeScript('build.js');
      json(res, result.ok ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/tools/meta' && req.method === 'GET') {
      json(res, 200, {
        collections: await listCollections(ROOT),
        shortcuts: browseShortcuts(ROOT),
      });
      return;
    }

    if (pathname === '/api/tools/browse' && req.method === 'GET') {
      json(res, 200, await browseDir(queryParam(req.url, 'path')));
      return;
    }

    if (pathname === '/api/tools/new' && req.method === 'POST') {
      const created = await createCollection(ROOT, await readBody(req));
      json(res, 200, created);
      return;
    }

    if (pathname === '/api/tools/import' && req.method === 'POST') {
      const result = await runNodeScript('import-photos.js', buildImportArgs(await readBody(req)));
      json(res, result.ok ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/tools/merge' && req.method === 'POST') {
      const result = await runNodeScript('merge-folders.js', buildMergeArgs(await readBody(req)));
      json(res, result.ok ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/tools/scan' && req.method === 'POST') {
      const result = await runNodeScript('merge-folders.js', ['--scan']);
      json(res, result.ok ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/tools/thumbs' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await runNodeScript('import-photos.js', ['--ensure-thumbs', ...buildSimpleArgs(body)]);
      json(res, result.ok ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/tools/promote-places' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await runNodeScript('import-photos.js', ['--promote-places', ...buildSimpleArgs(body)]);
      json(res, result.ok ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/asset' && req.method === 'GET') {
      serveAsset(req, res, queryParam(req.url, 'path'));
      return;
    }

    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      serveStatic(req, res, pathname);
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    const status = err.status || (err.code === 'ENOENT' ? 404 : 500);
    json(res, status, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Content editor  ${url}`);
  console.log('Edit markdown and data/controls.yaml. Cmd/Ctrl+S saves.');
  if (OPEN) {
    const command = process.platform === 'darwin'
      ? `open ${url}`
      : process.platform === 'win32'
        ? `start ${url}`
        : `xdg-open ${url}`;
    exec(command);
  }
});
