import exifr from 'exifr';

function round(num, digits) {
  const factor = 10 ** digits;
  return Math.round(num * factor) / factor;
}

function formatShutter(exposureTime) {
  if (!exposureTime || Number.isNaN(exposureTime)) return '';
  if (exposureTime >= 1) return `${round(exposureTime, 1)}s`;
  const denominator = Math.round(1 / exposureTime);
  return `1/${denominator}`;
}

function toISODate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/**
 * Extract a friendly, site-ready subset of EXIF data from an image file.
 * Never throws — returns an empty-ish object on failure so imports don't halt.
 */
export async function extractExif(filePath) {
  let tags = {};
  try {
    tags = (await exifr.parse(filePath, {
      tiff: true,
      exif: true,
      gps: true,
      translateValues: true,
      reviveValues: true,
    })) || {};
  } catch (err) {
    console.warn(`  ! EXIF read failed for ${filePath}: ${err.message}`);
  }

  const camera = [tags.Make, tags.Model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const lens = tags.LensModel || '';
  const aperture = tags.FNumber ? `f/${round(tags.FNumber, 1)}` : '';
  const shutter = formatShutter(tags.ExposureTime);
  const focalLength = tags.FocalLength ? `${round(tags.FocalLength, 1)}mm` : '';
  const iso = tags.ISO || '';
  const takenAt = toISODate(tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate);
  const gps = (typeof tags.latitude === 'number' && typeof tags.longitude === 'number')
    ? { lat: round(tags.latitude, 5), lng: round(tags.longitude, 5) }
    : null;

  return { camera, lens, aperture, shutter, focalLength, iso, takenAt, gps };
}
