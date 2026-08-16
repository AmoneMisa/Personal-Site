# FastAPI backend

Private tool API for the WhitesLove Personal Site monorepo. Nuxt proxies
`/api/**` to this service over the internal Compose network.

## Features

- PDF editing and conversion
- File-format conversion
- DockerHub tag search
- Country index datasets
- Redis-backed temporary state and caches

## Development

From the repository root, use the unified stack:

```bash
docker compose --env-file db.env up -d --build backend
```

For Python-only development on Windows:

```powershell
python -m venv .venv
.venv\Scripts\pip install -r backend\requirements.txt
.venv\Scripts\uvicorn backend.src.main:app --reload --port 8000
```

Production deployment is owned by the root `deploy.sh`; this directory has no
independent Compose stack or deployment workflow.
