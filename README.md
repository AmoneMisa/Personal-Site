# WhitesLove Personal Site

Monorepo for [whiteslove.me](https://whiteslove.me). It contains the Nuxt
application and the FastAPI tool backend, with one Docker Compose stack and one
deployment workflow.

## Repository layout

```text
Personal-Site/
├── app/                 Nuxt pages, components and composables
├── server/              Nitro routes, jobs and server utilities
├── backend/             FastAPI tool API
│   ├── src/
│   ├── Dockerfile
│   └── requirements.txt
├── i18n/                Russian and English locale files
├── public/              Static assets
├── Dockerfile           Nuxt production image
├── docker-compose.yml   Nuxt + FastAPI + Redis
└── deploy.sh            Unified production deployment
```

The previous `Personal-Site-Backend` repository was imported as a Git subtree,
so its history remains available in this repository.

## Local frontend development

Requires Node.js 20.19+ (Node.js 22 recommended).

```bash
npm install
npm run dev
```

The Nuxt app runs on `http://localhost:3000`. Copy `.env.example` to `.env` for
local server-side integrations.

## Local full stack

Create the server environment file and start the complete stack:

```bash
cp .env.example db.env
docker network create ai-net 2>/dev/null || true
docker compose --env-file db.env up -d --build
```

The frontend is published on `127.0.0.1:8080`; FastAPI remains private on the
Compose network and Nuxt proxies `/api/**` to `http://backend:8000`.

`AI_WORKER_KEY` in `db.env` must match `AI_API_KEY` in the separately deployed
`ai-worker`. The key is server-only and must never be exposed to browser code.

## Production deployment

The GitHub Actions workflow invokes:

```bash
bash ~/opt/myproject/deploy.sh
```

The script pulls this repository and rebuilds the unified stack. The old
`frontend` and `backend` arguments remain accepted during migration, but normal
deployments rebuild the whole stack.

### One-time migration from two repositories

Back up the existing environment and preserve the old checkout before replacing
it with this monorepo:

```bash
cp ~/opt/myproject/db.env ~/opt/db.env.personal-site
cd ~/opt
mv myproject myproject.two-repo-backup
git clone https://github.com/AmoneMisa/Personal-Site.git myproject
cp ~/opt/db.env.personal-site ~/opt/myproject/db.env
cd ~/opt/myproject
bash deploy.sh
```

Using the same `~/opt/myproject` directory preserves the Compose project name
and therefore reuses the existing Redis volume. Verify the site, `/api` tools,
jobs and AI connectivity before removing `myproject.two-repo-backup`.

## Services

- Nuxt SSR site with static i18n, portfolio/CV pages and browser tools.
- Vacancy aggregator with deterministic parsing and background AI enrichment.
- Flat Finder proxy backed by the separately deployed `flat-finder` service.
- FastAPI PDF, conversion, DockerHub and country-index APIs.
- Redis persistence for jobs, rates, PDF state and backend caches.

## License

Personal project, shared for demonstration purposes.
