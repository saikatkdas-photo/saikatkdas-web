# photos/

Standalone highlight photos that don't belong to any project or series.

Each photo gets its own folder:

```
photos/
  <slug>/
    1.jpg
    1.md
```

Every image needs a sidecar `.md` file with the same base name (see any
example under `series/` for the metadata fields). Set `highlight: true`
in an image's metadata to feature it in the homepage gallery.

This folder is empty right now — all current photos live under `series/`
(each is still eligible as a homepage highlight via its own metadata).
Use `node scripts/import-photos.js` to add photos here, or drop them in
by hand and run `npm run build`.
