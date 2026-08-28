import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const WIDTHS = [480, 800, 1200, 1800, 2400];

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
  if (await isFresh(srcPath, outputPaths)) {
    return { outputs, width: metadata.width, height: metadata.height, cached: true };
  }

  for (const { width, webp, jpg } of outputs) {
    const image = sharp(srcPath).rotate().resize({ width, withoutEnlargement: true });
    await image.clone().webp({ quality: 78 }).toFile(path.join(destDir, webp));
    await image.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(destDir, jpg));
  }

  return { outputs, width: metadata.width, height: metadata.height, cached: false };
}
