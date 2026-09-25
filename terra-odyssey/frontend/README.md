# Terra Odyssey Frontend

This is the standalone Next.js investigation workspace. It owns the map, charts, question builder, evidence views, and API client; acquisition, persistence, and scientific calculations remain in the backend.

## Setup

Node.js 20 or newer is recommended.

```powershell
cd terra-odyssey/frontend
npm install
Copy-Item .env.example .env.local
```

Set the API base in `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

`NEXT_PUBLIC_API_URL` must include the backend `/api` prefix. The client falls back to the same local URL when the variable is absent. Public Next.js variables are embedded at build time, so set the deployed API URL before building a static export.

## Run

Start the FastAPI backend in a separate terminal, then run:

```powershell
cd terra-odyssey/frontend
npm run dev
```

Open `http://localhost:3000`. Next.js serves the frontend independently; FastAPI does not mount or serve `frontend/out`.

## Checks and build

```powershell
cd terra-odyssey/frontend
npm run typecheck
npm run lint
npm run build
```

The static export and Next.js build files are written under `frontend/out/`. Dependencies and generated build artifacts are ignored by Git and excluded from the packaged codebase.

The map uses Mapcn React components, MapLibre GL JS, and OpenFreeMap styles without an API token. See [MAP_SETUP.md](MAP_SETUP.md) for style URLs, attribution, and self-hosting notes.
