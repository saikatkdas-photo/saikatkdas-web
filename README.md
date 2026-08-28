# saikatkdas-web

Saikat K Das — street photography portfolio. A hand-rolled static site generator
(no framework, no client-side JS framework) that reads its content straight out
of plain folders and Markdown files, and builds a fast, static, mobile-first
site to `dist/`.

Live at **[saikatkdas.com](https://saikatkdas.com)** (once DNS is configured — see below).

## How it works

There's no CMS. The site *is* the file structure:

```
photos/<slug>/            → standalone highlight photos (rarely used — most photos live in a series)
projects/<slug>/          → client / commissioned work
  readme.md                 → title, client, industry, services, year, tags, cover
  1.jpg, 1.md                → an image + its metadata (alt, caption, EXIF, tags, highlight)
series/<slug>/            → personal, ongoing bodies of work (e.g. "Kolkata", "Japan")
  readme.md, 1.jpg, 1.md    → same shape as projects/, minus client metadata
gear/<slug>.md            → one file per camera/lens, with an optional same-folder photo
journal/<slug>/           → blog-style posts (optional)
about.md                  → bio text shown on the About page
data/site.json            → your name, tagline, email, Instagram, nav labels
```

Nothing above is committed to being permanent — **any section with zero content
is automatically hidden** from the navigation and no page is built for it. Add
a project, and "Projects" appears in the nav. Delete every gear entry, and
"Gear" disappears. You never have to touch a template to reflect this.

**Themes are not folders.** They're computed automatically from the `tags:`
field on every image. Tag a photo `monochrome`, and it shows up on
`/themes/monochrome/` — no extra step. A collection's own `tags:` (e.g. a
series' `readme.md`) cascade down to every image inside it, so you only have
to tag the series once with `kolkata` and every photo in it inherits that tag.

**Highlights** (the homepage hero gallery) are just images with
`highlight: true` in their own `.md` file. They link to their parent
project/series by default, or wherever `link:` points if you set it.

## Content field reference

### Collection `readme.md` (projects/series/journal)

```yaml
---
title: "Kolkata"
summary: "One-line summary shown on listing cards."
client: ""        # projects only
industry: ""      # projects only
services: []      # projects only
year: 2026
tags: ["kolkata"] # cascades to every image in this folder
cover: "04.jpg"   # filename of the cover image; defaults to the first image
order: 1          # controls sort order in listings; omit to sort by title
---
Markdown body — the write-up shown on the detail page.
```

### Per-image `<name>.md` (sidecar next to `<name>.jpg`)

```yaml
---
alt: "Accessible description"
caption: "Short caption shown under the thumbnail"
tags: ["monochrome"]     # merged with the collection's cascaded tags
highlight: true           # feature this photo on the homepage
order: 3                   # controls highlight + gallery order
link: "/series/kolkata/"  # optional override for where a highlight links
camera: "RICOH GR IIIx"   # usually auto-filled by import-photos.js
lens: ""
aperture: ""
shutter: ""
focalLength: ""
iso:
takenAt: ""
---
Optional longer caption / story, as Markdown.
```

### Gear `<slug>.md`

```yaml
---
title: "Ricoh GR IIIx"
category: "Camera"
since: 2022
image: "ricoh-gr-iiix.jpg"  # optional, same folder
current: true
order: 1
---
Write-up as Markdown.
```

## Scripts

```bash
npm run build            # generate the static site into dist/
npm run dev               # build once, then serve dist/ at http://localhost:4173
npm run serve              # just serve the existing dist/ (skip rebuild)
npm run new-project        # interactive: scaffold a new projects/ or series/ folder + readme.md
npm run import-photos -- --source "/path/to/photos" --dest series/kolkata
```

### `import-photos.js`

Points at a folder of exported photos and drops them straight into the site
structure: copies (or moves) each image, extracts EXIF (camera, lens,
aperture, shutter speed, ISO, focal length, date taken) into that image's
sidecar `.md`, and auto-tags each photo `color` or `monochrome` based on a
quick pixel-saturation check (correct almost always — toned black & white
conversions occasionally need a manual nudge, so always skim the results).

```bash
node scripts/import-photos.js \
  --source "/Volumes/One Touch/Photography/Ricoh/Best-2026/shortlist" \
  --dest series/kolkata \
  --tags kolkata \
  --highlight
```

Useful flags: `--tags a,b,c` (extra tags for every imported image),
`--highlight` (mark all as homepage highlights), `--highlight-start N`
(starting order number), `--link /some/path/` (override highlight link
target), `--keep-names` (don't renumber sequentially), `--move` (move
instead of copy), `--dry-run` (preview without writing anything).

### `new-project.js`

Interactively scaffolds a `projects/<slug>/` or `series/<slug>/` folder with a
pre-filled `readme.md`, so you don't have to remember the frontmatter shape.

## Design system

Warm-neutral editorial look, alternating light/dark sections, big display
type, minimal chrome, mobile-first (the homepage gallery stacks vertically
on phones and only becomes a horizontal scroller at wider viewports).
Tokens live as CSS custom properties at the top of `src/styles/main.css` —
color, type, spacing, radius, motion. Fonts: Bricolage Grotesque (display),
IBM Plex Sans (body), IBM Plex Mono (labels/EXIF chips).

## Deployment (GitHub Pages + custom domain)

`.github/workflows/deploy.yml` builds the site with Node 22 and deploys
`dist/` to GitHub Pages on every push to `main`.

**One-time setup, once you're ready to point `saikatkdas.com` at this repo:**

1. In the repo settings → **Pages**, set the source to **GitHub Actions**.
2. Add your domain in the same settings screen ("Custom domain" → `saikatkdas.com`).
   This repo's build already writes a `CNAME` file into `dist/` automatically,
   but setting it in the GitHub UI too keeps it from being wiped on the next
   settings change.
3. At your domain registrar, point DNS at GitHub Pages:
   - Apex domain (`saikatkdas.com`): four `A` records to
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` subdomain (optional): a `CNAME` record to `<username>.github.io`
4. Once DNS propagates, enable **Enforce HTTPS** in the Pages settings.

## Local preview

```bash
npm install
npm run dev
# → http://localhost:4173
```

## Credits

Saikat K Das — [@saikatkdas](https://www.instagram.com/saikatkdas) ·
skdjuit@gmail.com
