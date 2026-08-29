import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const WIDTHS = [480, 800, 1200, 1800, 2400];
export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
export const THUMB_WIDTH = 320;
export const THUMB_SUFFIX = '.thumb';

export function isThumbnailFile(fileName) {
  return /\.thumb\.(jpe?g|png|webp)$/i.test(fileName || '');
}

export function isSourceImageFile(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) && !isThumbnailFile(fileName);
}

export function thumbnailNames(baseName) {
  return {
    webp: `${baseName}${THUMB_SUFFIX}.webp`,
    jpg: `${baseName}${THUMB_SUFFIX}.jpg`,
  };
}

export function thumbnailSiblingPaths(srcPath) {
  const dir = path.dirname(srcPath);
  const baseName = path.basename(srcPath, path.extname(srcPath));
  const names = thumbnailNames(baseName);
  return {
    webp: path.join(dir, names.webp),
    jpg: path.join(dir, names.jpg),
  };
}

/**
 * Cheap, dependency-free "is this photo monochrome?" heuristic: downsample
 * and measure average per-pixel chroma (max channel - min channel). Real
 * black & white / heavily desaturated photos land well under the threshold;
 * normal color photos (even muted ones) sit clearly above it.
 */
export async function detectIsMonochrome(filePath, threshold = 0.035) {
  const size = 48;
  const { data, info } = await sharp(filePath)
    .rotate()
    .resize(size, size, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  let totalChroma = 0;
  let count = 0;
  for (let i = 0; i + 2 < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    totalChroma += (max - min) / 255;
    count += 1;
  }
  const avgChroma = count ? totalChroma / count : 0;
  return avgChroma < threshold;
}

async function isFresh(srcPath, outputPaths) {
  try {
    const srcStat = await fs.stat(srcPath);
    for (const outputPath of outputPaths) {
      const outStat = await fs.stat(outputPath).catch(() => null);
      if (!outStat || outStat.mtimeMs < srcStat.mtimeMs) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a small WebP + JPEG pair next to a source image (or into destDir).
 * Used by import-photos, ensure-thumbs, and the build for half-cards / dense grids.
 */
export async function generateThumbnail(srcPath, destDir = path.dirname(srcPath), baseName = path.basename(srcPath, path.extname(srcPath))) {
  await fs.mkdir(destDir, { recursive: true });
  const names = thumbnailNames(baseName);
  const webpPath = path.join(destDir, names.webp);
  const jpgPath = path.join(destDir, names.jpg);

  if (await isFresh(srcPath, [webpPath, jpgPath])) {
    return { ...names, cached: true };
  }

  const image = sharp(srcPath).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true });
  await image.clone().webp({ quality: 72 }).toFile(webpPath);
  await image.clone().jpeg({ quality: 76, mozjpeg: true }).toFile(jpgPath);
  return { ...names, cached: false };
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function copyIfStale(src, dest) {
  if (!(await pathExists(src))) return false;
  if (await isFresh(src, [dest])) return true;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return true;
}

/**
 * Prefer a sibling source thumb written at import time; otherwise generate
 * one into destDir so the built site always has a small surface asset.
 */
export async function ensureDestThumbnail(srcPath, destDir, baseName) {
  const names = thumbnailNames(baseName);
  const destWebp = path.join(destDir, names.webp);
  const destJpg = path.join(destDir, names.jpg);
  const sibling = thumbnailSiblingPaths(srcPath);

  const copiedWebp = await copyIfStale(sibling.webp, destWebp);
  const copiedJpg = await copyIfStale(sibling.jpg, destJpg);
  if (copiedWebp && copiedJpg) return { ...names, cached: true };

  return generateThumbnail(srcPath, destDir, baseName);
}

export async function ensureAllThumbnails(rootDir) {
  const roots = ['photos', 'projects', 'series', 'journal', 'gear'];
  let created = 0;
  let cached = 0;

  async function walk(dir) {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!isSourceImageFile(entry.name)) continue;
      const result = await generateThumbnail(full);
      if (result.cached) cached += 1;
      else created += 1;
    }
  }

  for (const rel of roots) {
    await walk(path.join(rootDir, rel));
  }

  return { created, cached };
}

/**
 * Generate a set of responsive WebP + JPEG derivatives for one source image.
 * Skips work if fresh derivatives already exist (mtime-based build cache).
 */
export async function generateResponsiveImages(srcPath, destDir, baseName) {
  await fs.mkdir(destDir, { recursive: true });
  const probe = sharp(srcPath).rotate();
  const metadata = await probe.metadata();
  const sourceWidth = metadata.width || 1600;

  let widths = WIDTHS.filter((w) => w <= sourceWidth);
  if (widths.length === 0) widths = [sourceWidth];
  if (widths[widths.length - 1] < sourceWidth && sourceWidth - widths[widths.length - 1] > 200) {
    widths.push(sourceWidth);
  }

  const outputs = widths.map((width) => ({
    width,
    webp: `${baseName}-${width}.webp`,
    jpg: `${baseName}-${width}.jpg`,
  }));

  const outputPaths = outputs.flatMap((o) => [path.join(destDir, o.webp), path.join(destDir, o.jpg)]);
  const cachedOutputs = await isFresh(srcPath, outputPaths);
  if (!cachedOutputs) {
    for (const { width, webp, jpg } of outputs) {
      const image = sharp(srcPath).rotate().resize({ width, withoutEnlargement: true });
      await image.clone().webp({ quality: 78 }).toFile(path.join(destDir, webp));
      await image.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(destDir, jpg));
    }
  }

  const thumb = await ensureDestThumbnail(srcPath, destDir, baseName);
  const thumbW = Math.min(THUMB_WIDTH, metadata.width || THUMB_WIDTH);
  const thumbH = metadata.width && metadata.height
    ? Math.round(metadata.height * (thumbW / metadata.width))
    : thumbW;

  return {
    outputs,
    thumb: { ...thumb, width: thumbW, height: thumbH },
    width: metadata.width,
    height: metadata.height,
    cached: cachedOutputs && thumb.cached,
  };
}
