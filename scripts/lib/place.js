import matter from 'gray-matter';
import { slugify } from './slug.js';

/** Used only for the one-time tag → place promotion. New places can be any slug. */
export const KNOWN_PLACES = ['kolkata', 'bangalore'];

function toArray(value) {
  if (value == null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

export function normalizeTags(value) {
  return toArray(value)
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
}

export function normalizePlace(value) {
  return slugify(String(value || '').trim());
}

export function isKnownPlace(value) {
  return KNOWN_PLACES.includes(normalizePlace(value));
}

export function firstPlaceInTags(tags, known = KNOWN_PLACES) {
  return normalizeTags(tags).find((t) => known.includes(t)) || '';
}

export function stripPlaceTags(tags, known = KNOWN_PLACES) {
  return normalizeTags(tags).filter((t) => !known.includes(t));
}

export function resolvePlace({ place, ownTags = [], collectionTags = [] } = {}) {
  const explicit = normalizePlace(place);
  if (explicit) return explicit;
  return firstPlaceInTags(ownTags) || firstPlaceInTags(collectionTags) || '';
}

export function yamlPlaceLine(place) {
  return `place: "${String(place).replace(/"/g, '\\"')}"`;
}

export function yamlTagsLine(tags) {
  return `tags: [${tags.map((t) => `"${String(t).replace(/"/g, '\\"')}"`).join(', ')}]`;
}

export function applyPlaceToFrontmatter(raw, place) {
  const parsed = matter(raw);
  const ownTags = normalizeTags(parsed.data.tags);
  const nextTags = stripPlaceTags(ownTags);
  const nextPlace = normalizePlace(place || parsed.data.place);
  const tagsChanged = ownTags.join('\0') !== nextTags.join('\0');
  const placeChanged = normalizePlace(parsed.data.place) !== nextPlace;

  if (!tagsChanged && !placeChanged) {
    return { text: raw, changed: false, place: nextPlace, tags: nextTags };
  }

  let text = raw;

  if (nextPlace && (/^place:\s*/m.test(text) || placeChanged)) {
    if (/^place:\s*/m.test(text)) {
      text = text.replace(/^place:\s*.*$/m, yamlPlaceLine(nextPlace));
    } else if (/^tags:\s*/m.test(text)) {
      text = text.replace(/^tags:\s*.*$/m, (line) => `${line}\n${yamlPlaceLine(nextPlace)}`);
    } else {
      text = text.replace(/^---\r?\n/, (open) => `${open}${yamlPlaceLine(nextPlace)}\n`);
    }
  }

  if (tagsChanged) {
    if (nextTags.length) {
      text = text.replace(/^tags:\s*.*$/m, yamlTagsLine(nextTags));
    } else {
      text = text.replace(/^tags:\s*.*\r?\n/m, '');
    }
  }

  return { text, changed: true, place: nextPlace, tags: nextTags };
}

export function stripPlacesFromCollectionFrontmatter(raw) {
  const parsed = matter(raw);
  const tags = normalizeTags(parsed.data.tags);
  const nextTags = stripPlaceTags(tags);
  if (tags.join('\0') === nextTags.join('\0')) {
    return { text: raw, changed: false, tags: nextTags };
  }

  let text = raw;
  if (nextTags.length) {
    text = text.replace(/^tags:\s*.*$/m, yamlTagsLine(nextTags));
  } else {
    text = text.replace(/^tags:\s*.*\r?\n/m, '');
  }
  return { text, changed: true, tags: nextTags };
}
