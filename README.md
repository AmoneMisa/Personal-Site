# WhitesLove Personal Site

Monorepo for [whiteslove.me](https://whiteslove.me). It contains the Nuxt
application, FastAPI tool backend, jobs/hiring worker, browser fetch helper and
Telegram subscription bot, deployed through one Docker Compose stack.

## Repository layout

```text
Personal-Site/
├── app/                   Nuxt pages, components and composables
├── server/                Nitro routes and server-side jobs/hiring utilities
├── backend/               FastAPI tool API
│   ├── src/
│   ├── Dockerfile
│   └── requirements.txt
├── jobs-worker/           Background jobs/hiring ingestion worker
├── job-browser-fetcher/   Browser-like HTTP fetch helper for protected job pages
├── subscription-bot/      Telegram subscriptions service
├── i18n/                  Russian and English locale files
├── public/                Static assets
├── Dockerfile             Nuxt production image
├── docker-compose.yml     Unified production stack
└── deploy.sh              Unified production deployment
```

The previous `Personal-Site-Backend` repository was imported as a Git subtree,
so its history remains available in this repository.

## Local frontend development

Requires Node.js 24 LTS (Krypton), matching the production Docker runtime.

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

Stop the old two-repository stack, remove orphaned services (including any
legacy admin frontend), preserve only the required environment file temporarily,
and replace the checkout in place:

```bash
cd ~/opt/myproject
docker compose --env-file db.env down --remove-orphans
docker rm -f myproject-admin-frontend-1 2>/dev/null || true
mv db.env /tmp/personal-site-db.env

cd ~/opt
rm -rf myproject
git clone https://github.com/AmoneMisa/Personal-Site.git myproject
mv /tmp/personal-site-db.env ~/opt/myproject/db.env
cd ~/opt/myproject
bash deploy.sh
```

Using the same `~/opt/myproject` directory preserves the Compose project name.
The current stack uses the `site_state` volume for filesystem-backed application
state; there is no standalone Redis service in this repository.

## Services

- Nuxt SSR site with static i18n, portfolio/CV pages and browser tools.
- Nitro read APIs backed by indexed Personal Site PostgreSQL schemas for jobs
  and hiring, with database-side filtering, pagination and analytics.
- `jobs-worker` for scheduling, queue processing, scraping, normalization,
  enrichment and indexing of jobs/hiring data.
- `job-browser-fetcher` for job pages that require browser-like TLS/HTTP behavior.
- Flat Finder proxy backed by the separately deployed `flat-finder` service.
- FastAPI PDF, conversion, DockerHub and country-index APIs.
- Telegram bot for apartment, job and candidate subscriptions.
- Shared `site_state` recovery snapshots plus PostgreSQL read models and
  Elasticsearch compatibility indexes configured through the environment.

## License

Personal project, shared for demonstration purposes.
