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
data/controls.yaml        → intro timings, colors, fonts, section on/off flags
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

Warm-neutral editorial look, big Helvetica-like display type, minimal chrome,
mobile-first. Color, type, intro timing, and section flags live in
`data/controls.yaml` and are compiled into CSS variables plus a small JSON
blob on the homepage intro. Change a knob, then `npm run build`.

Default type: Helvetica Neue / Helvetica, with IBM Plex Sans as the web
fallback, and IBM Plex Mono for labels and EXIF.

## Control knobs (`data/controls.yaml`)

This is the file to edit when you want to restyle or retune the site without
opening CSS or JS. Keys you omit keep the defaults in `scripts/lib/controls.js`.

### Intro timings

Under `intro.timings`, every value is milliseconds from page load:

| Key | What it does |
|---|---|
| `letters_in` | SKD letters enter |
| `canvas_open` | Photo frame fills the viewport |
| `photo_in` | Photo fades in, still zoomed in |
| `photo_zoom` | Zoom-out toward a device fit |
| `shutter` | Shutters wipe the photo (SKD stays put) |
| `name_expand` | SKD extends to Saikat K Das |
| `name_out` | Name leaves, homepage shows |
| `total` | Loading counter duration |

Also here: `intro.enabled`, `intro.play_on` (`reload` or `once`),
`photo_zoom_start` (default `1.72` — how tight the photo starts),
`photo_zoom_end` (default `1.0` — the fit after zoom-out), and
`photo_fit_landscape` (`contain` on short landscape screens, or `cover`).

### Colors

`colors.*` maps 1:1 onto CSS variables (`bg`, `ink`, `accent`, `surface_dark`,
and the rest). Light page surfaces and dark sections both live in this block.

### Fonts

`fonts.display`, `fonts.body`, `fonts.mono` are CSS font stacks.
`fonts.display_weight` is the heading weight (700 for Helvetica).
`fonts.google` is the Google Fonts family query used as a fallback; leave it
empty to skip the webfont request.

### Section flags

`sections.intro`, `hero`, `selected`, `selected_strip`, `work_previews`,
`about`, `projects`, `series`, `themes`, `gear`, `journal`. Set any of these
to `false` to hide that block. Projects / series / themes / gear / journal
also hide automatically when their content folder is empty.

### Other knobs

- `selected_strip.items`: nav keys shown as the floating `series * themes * about` strip
- `motion.highlight_stagger`: `jitter` (default), `linear`, or `none`
- `motion.honor_reduced`: skip the intro when the OS asks for reduced motion
- `layout.highlight_track_min_height` / `selected_min_height`: Selected gallery height

After edits:

```bash
npm run build
npm run serve
```

## Deployment (GitHub Pages + custom domain)

`.github/workflows/deploy.yml` builds the site with Node 22 and deploys
`dist/` to GitHub Pages on every push to `main`.

Two separate things have to happen before `saikatkdas.com` goes live: (A) tell
**GitHub** to serve this repo on that domain, and (B) tell **your domain
registrar** (wherever you bought `saikatkdas.com`) to point at GitHub. Do them
in this order — A first, then B — and finish with a DNS check before flipping
on HTTPS.

### A. GitHub side (do this first)

1. Push this repo to GitHub and make sure the **Deploy** Actions workflow has
   run at least once successfully (Actions tab → green checkmark). This
   publishes an initial site to `<username>.github.io/<repo>` and turns Pages on.
2. In the repo on GitHub: **Settings** → **Pages** (left sidebar, under "Code and automation").
3. Under **Build and deployment → Source**, confirm it's set to **GitHub Actions** (it already is, via `deploy.yml`).
4. Scroll to **Custom domain**, type `saikatkdas.com`, and click **Save**.
   - GitHub will show a message that it can't verify the domain yet — that's
     expected, because you haven't added the DNS records. Leave this tab open
     or come back to it after step B.
   - This also commits a `CNAME` file to your repo automatically (this repo's
     build script writes one too, so it survives future deploys either way).
5. Leave **Enforce HTTPS** unchecked for now — it's greyed out until DNS is live. You'll come back for step D.

### B. Registrar side (wherever `saikatkdas.com` is registered)

Log in to your registrar (e.g. GoDaddy, Namecheap, Google Domains, Cloudflare,
Porkbun...) and find its **DNS management** / **DNS records** page for
`saikatkdas.com` (sometimes called "DNS Zone Editor" or "Manage DNS"). Add the
following records. Exact field names differ slightly per registrar, but every
record needs: a **type**, a **host/name**, and a **value/points to**.

**Required — apex domain (`saikatkdas.com`, no `www`):** add four separate `A` records, all with the host set to `@` (or left blank, which usually means the same thing — the bare domain):

| Type | Host / Name | Value / Points to |
|---|---|---|
| A | @ | `185.199.108.153` |
| A | @ | `185.199.109.153` |
| A | @ | `185.199.110.153` |
| A | @ | `185.199.111.153` |

**Recommended — IPv6 support:** four `AAAA` records, also on host `@`:

| Type | Host / Name | Value / Points to |
|---|---|---|
| AAAA | @ | `2606:50c0:8000::153` |
| AAAA | @ | `2606:50c0:8001::153` |
| AAAA | @ | `2606:50c0:8002::153` |
| AAAA | @ | `2606:50c0:8003::153` |

**Optional — make `www.saikatkdas.com` work too** (it will automatically
redirect to the apex once GitHub verifies the domain): one `CNAME` record —

| Type | Host / Name | Value / Points to |
|---|---|---|
| CNAME | www | `<username>.github.io` |

Notes:
- If your registrar won't let you add an `A` record on the bare apex alongside other records, that's normal — just make sure you don't also have a leftover "parking page" `A` record or `CNAME` on `@` from the registrar; delete those first.
- Some registrars (Cloudflare, DNSimple, etc.) offer an `ALIAS`/`ANAME`/"CNAME flattening" record instead — if so, you can use one of those pointed at `<username>.github.io` instead of the four `A` records. Either approach works; don't do both.
- Don't add wildcard records (`*.saikatkdas.com`) — GitHub explicitly warns against it (domain takeover risk).
- Delete any pre-existing `A`/`CNAME` records on `@` or `www` left over from a registrar parking page or previous host — GitHub Pages requires exactly its own records, no others alongside them.

### C. Wait for DNS to propagate, then verify

DNS changes usually take anywhere from a few minutes to a few hours (rarely, up to 24-48h). Check from your own terminal:

```bash
dig +short saikatkdas.com A
# should eventually print the four 185.199.10x.153 addresses

dig +short www.saikatkdas.com CNAME
# should print <username>.github.io.
```

If `dig` still shows your old host's IP, or nothing at all, DNS hasn't
propagated yet — wait and retry. You can also check propagation globally at
[dnschecker.org](https://dnschecker.org) (search `saikatkdas.com`, type `A`).

Once `dig` shows the GitHub IPs, go back to **Settings → Pages** in the repo —
the custom domain field should now show a green checkmark instead of the
"unable to verify" warning. If it still shows an error after DNS looks
correct, remove the domain from the field, save, wait a minute, then re-enter
it and save again to force GitHub to re-check.

### D. Turn on HTTPS

Back in **Settings → Pages**, once the domain shows verified, tick
**Enforce HTTPS**. GitHub provisions a Let's Encrypt certificate for you —
this can take a few minutes up to an hour after DNS first verifies. Until it's
checked, visiting `https://saikatkdas.com` may show a certificate warning;
that resolves itself once the checkbox is available and enabled.

After that, `saikatkdas.com` (and `www.saikatkdas.com`, if you added the
`CNAME`) both serve the site over HTTPS, and every push to `main` redeploys
automatically via `deploy.yml`.

## Local preview

```bash
npm install
npm run dev
# → http://localhost:4173
```

## Credits

Saikat K Das — [@saikatkdas](https://www.instagram.com/saikatkdas) ·
skdjuit@gmail.com
