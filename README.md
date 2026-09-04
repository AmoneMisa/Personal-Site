# WhitesLove Personal Site

Source for [whiteslove.me](https://whiteslove.me): the Nuxt UI/SSR application
and its small FastAPI helper backend. Jobs, hiring, crawler execution, browser
fetching and the Telegram subscription worker live in the separate
`AmoneMisa/whiteslove.me-backend-platform` repository.

## What is on the site

| Area | What it is |
| --- | --- |
| `/`, `/about`, `/projects`, `/cv` | Portfolio: introduction, work, and CV. |
| `/services` | Service pages, one per offering. |
| `/flat-finder` | Apartment search over the Flat Finder backend: filtered list plus a Leaflet map with metro-proximity shapes. The heaviest UI in the repo. |
| `/jobs`, `/hiring` | Vacancy and candidate browsing, proxied to the backend platform. |
| `/quizzes` | Self-contained interactive quizzes. |

All display text lives in `i18n/` locale files rather than in components.

## Repository layout

```text
Personal-Site/
├── app/                 Nuxt pages, components and composables
├── server/              Nitro BFF/proxy routes and site-only server utilities
├── shared/              types and helpers used by both app and server
├── backend/             FastAPI helper API (document/media tools)
├── i18n/                locale files — the source of all display text
├── quizzData/           quiz question sets
├── scripts/             build and maintenance scripts
├── public/              static assets
├── docs/                site documentation
├── tests/               UI/BFF/site regression coverage
├── Dockerfile           Nuxt production image
├── docker-compose.yml   frontend + helper backend
└── deploy.sh            Personal Site deployment
```

The previous `Personal-Site-Backend` repository was imported as a Git subtree,
so its history remains available here.

## The FastAPI helper

`backend/` is a small, stateless tool API for work Node is a poor fit for. It
holds no database, no auth and no site content — it converts and generates, and
nothing more.

| Prefix | Purpose |
| --- | --- |
| `/convert` | File and document conversion. |
| `/pdf` | PDF composition and rendering. |
| `/indices` | Country index data. |
| `/dockerhub` | Docker Hub image statistics. |

It stays private on the default Compose network; the browser never calls it
directly.

## Backend boundaries

The site is intentionally a thin consumer of backend-platform services:

- `/jobs-feed` and `/jobs-vacancy` proxy `vacancies-api`.
- `/hiring-feed` and `/hiring-meta` proxy `cv-api`.
- SSR job/candidate share previews resolve their data from the same APIs.
- the website keeps only subscription handoff/status endpoints; the Telegram
  worker itself is deployed by backend-platform.
- Flat Finder remains an external service consumed through the existing BFF.

Crawler concurrency, timeouts, traversal budgets, pacing and source execution
policy do **not** belong in this repository. They are centralized in
backend-platform crawler/worker infrastructure.

## Local development

Requires Node.js 24 LTS, matching the Dockerfile and CI.

```bash
npm install
npm run dev
npm test          # UI/BFF/site regression suite
npm run lint      # eslint . (--fix to apply)
```

Copy `.env.example` to `.env` for server-side integrations. To exercise jobs or
hiring locally, point `VACANCIES_API_URL` and `CV_API_URL` at a running backend
platform.

Flat Finder pages need the Flat Finder API reachable; without it the list and
map render empty rather than failing loudly.

## Docker

The Compose stack contains only `frontend` and the Python `backend`. It joins the
external `ai-net` and `whiteslove-backend-platform` networks.

```bash
cp .env.example db.env
docker network create ai-net 2>/dev/null || true
# Start whiteslove.me-backend-platform first so its external network exists.
docker compose --env-file db.env up -d
```

The frontend is published on `127.0.0.1:8080`; the FastAPI helper remains
private on the default Compose network.

## Production deployment

GitHub Actions builds two immutable images from the same commit:

- `ghcr.io/amonemisa/personal-site`
- `ghcr.io/amonemisa/personal-site-backend`

`deploy.sh` pulls/recreates only those two services and requires the
`whiteslove-backend-platform` Docker network to already exist. It never runs
workforce database migrations and never deploys workforce workers.

```bash
bash ~/opt/myproject/deploy.sh
```

Rollback manifests likewise contain only the frontend/backend image revisions.

## Environment

The important cross-service settings are:

```env
VACANCIES_API_URL=http://vacancies-api:4010
CV_API_URL=http://cv-api:4011
AI_WORKER_URL=http://ai-worker:4030
SUBSCRIPTIONS_DATABASE_URL=postgresql://...
SUBSCRIPTIONS_DB_SCHEMA=subscriptions
TELEGRAM_SUBSCRIPTION_BOT_ENABLED=off
TELEGRAM_SUBSCRIPTION_BOT_USERNAME=
```

`SUBSCRIPTIONS_DATABASE_URL` is the only database connection retained by the
Nuxt runtime, and only for the website ↔ Telegram handoff/status contract.

## License

Personal project, shared for demonstration purposes.
