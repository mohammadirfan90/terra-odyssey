# Open-source map setup

Terra Odyssey renders its map with MapLibre GL JS and Mapcn's copy-paste React
components. The basemap styles and vector tiles come from OpenFreeMap and use
OpenStreetMap data. This setup needs no map account, API token, billing project,
or Google GIS credentials.

## Run locally

Install the frontend packages and start Next.js:

```powershell
cd terra-odyssey/frontend
npm install
npm run dev
```

The selected style URLs are in `lib/map/open-source-basemap.ts`:

- Dark: `https://tiles.openfreemap.org/styles/dark`
- Light: `https://tiles.openfreemap.org/styles/positron`

There is no map-related environment variable to add. The frontend `.env.local` only needs `NEXT_PUBLIC_API_URL` (including the `/api`
prefix) to reach the independently running FastAPI service. You can remove
old `NEXT_PUBLIC_CARTO_*` entries from your private env file; the application no
longer reads them. The backend `.env` is only for server-side NASA Earthdata and
app settings.

MapLibre displays the attribution supplied by the style. Keep this control
visible when changing map controls or styles. The OpenFreeMap public service is
free to use without registration or API keys; if you prefer to operate the map
infrastructure yourself, follow the project's
[self-hosting guide](https://openfreemap.org/).

## Source and licenses

`components/ui/map.tsx` contains the Mapcn component source adapted for this
application. Its MIT license is preserved in
`THIRD_PARTY_LICENSES/MAPCN-MIT.txt`. The map renderer is the open-source
MapLibre GL JS package; the OpenFreeMap styles and server are open source, and
the underlying map data is OpenStreetMap data. Keep the visible map attribution
for OpenMapTiles and OpenStreetMap contributors.

Google GIS is not included. It is unnecessary for rendering the current map,
and this project keeps its map stack on open-source components and services.
