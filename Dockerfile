FROM node:24-bookworm-slim AS deps

WORKDIR /app

# Git is required because parsing-lexicon intentionally tracks github:#master.
# Keep it in the dependency stage only so the runtime image stays minimal.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# parsing-lexicon intentionally tracks #master. Ignore the lock while installing
# so each build resolves the current branch head instead of a stale tarball/hash.
# legacy-peer-deps preserves the already-working Nuxt/Vite graph instead of
# failing on optional peer ranges while resolving the live git dependency.
RUN npm install --package-lock=false --legacy-peer-deps

FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app

# The OG renderer uses DejaVu Sans so Cyrillic and Latin card titles are both
# rendered consistently in the small production image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
