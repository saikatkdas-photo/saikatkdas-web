# projects/

Client / commissioned work. Each project is a folder:

```
projects/
  <slug>/
    readme.md      # project write-up + metadata (client, year, tags...)
    1.jpg
    1.md            # per-image metadata (camera, caption, tags...)
    2.jpg
    2.md
```

Run `node scripts/new-project.js` to scaffold a new project folder
interactively, then drop your images in and run `node scripts/import-photos.js`
to generate per-image metadata (with EXIF pre-filled) for them, or
`npm run build` once metadata files already exist.

This folder is empty right now — the **Projects** nav item and its pages
are hidden from the built site until at least one project exists here.
