# Issue 0016 — Photo thumbnails and lightbox in observation expanded row

## What to build

Two changes end-to-end:

**API change:** `GET /api/observations` currently omits `photo_urls` from its response even though the column exists in the database. Add `photo_urls` to the SELECT and include it in the returned observation objects.

**UI:** A `PhotoLightbox` component rendered inside the expanded observation row, alongside the existing GPS coordinate text. Given `urls: string[]` it renders a row of small thumbnail `<img>` elements. Clicking a thumbnail opens a modal overlay showing the full-size image. The modal has prev/next arrow buttons to browse all photos for that observation, a counter ("2 of 4"), and closes on Escape keypress or click outside the image. If `urls` is empty or the observation has no photos, nothing is rendered.

## Demoable as

District lead expands an observation row that has photos and sees thumbnails; clicking a thumbnail opens a full-screen browsable lightbox with prev/next arrows and a "1 of N" counter; pressing Escape closes it.

## Acceptance criteria

- [ ] `GET /api/observations` response includes `photo_urls: string[]` for each observation (empty array if none)
- [ ] Expanded observation row renders thumbnails when `photo_urls` is non-empty
- [ ] No thumbnails rendered when `photo_urls` is empty or absent
- [ ] Clicking a thumbnail opens the lightbox showing that photo
- [ ] Lightbox shows a "n of total" counter (e.g. "1 of 3")
- [ ] Clicking the next arrow advances to the next photo; clicking prev retreats
- [ ] Pressing Escape closes the lightbox
- [ ] Clicking outside the image (on the modal backdrop) closes the lightbox
- [ ] Playwright test: expand an observation row with photos → thumbnails visible
- [ ] Playwright test: click thumbnail → lightbox opens; click next → counter updates; Escape → lightbox closes

## Blocked by

None — can start immediately
