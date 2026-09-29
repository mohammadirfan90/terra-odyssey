# Verification Journal

## 2026-09-26 — Satellite imagery zoom boundary

- Symptom: zooming one step beyond the last detailed satellite view replaced the canvas with repeated gray `Map data not yet available` tiles.
- Root cause: Esri World Imagery returns that placeholder as a successful HTTP 200 response in locations without the requested high-resolution level, so the existing network-error handler cannot detect it. The raster source advertised native level 19 even though the reported location had real imagery only through level 18.
- Fix: changed the satellite raster source `maxzoom` from 19 to 18. MapLibre now overzooms level 18 at deeper map zooms instead of fetching the unavailable provider level.
- Provider probe: near Madhupur, the level-18 tile was real imagery (7,776 bytes); the matching level-19 and level-20 responses were the 2,521-byte placeholder.
- Browser proof: loaded the map at `[90.1, 24.61]`, map zoom 19, in headless Chrome. Resource inspection reported `{ "18": 6 }` satellite requests, and the captured canvas showed continuous satellite imagery with no placeholder text.
- Regression checks: `npm run typecheck` passed; `npm run lint` completed with 0 errors and 31 pre-existing warnings; `npm run build` completed and statically generated `/` and `/_not-found`.
