# photos/

Standalone frames that are not part of a project or series. They publish
as the **Untitled** section (`/untitled/`).

Drop images anywhere under this folder (root or nested). Each image can
have a sidecar `.md` with the same base name:

```
photos/
  01.jpg
  01.md
  Monochrome/
    RM000146.jpg
```

Sidecar fields match series images (`caption`, `story`, `highlight`,
`cover`, EXIF, tags). Nested folder names that look like words (e.g.
`Monochrome`) are added as tags. Import also writes `*.thumb.webp` and
`*.thumb.jpg` beside each frame for half-cards and other small surfaces.

Untitled photos are also eligible for homepage highlights, themes, and
the timeline.
