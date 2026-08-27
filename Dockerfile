FROM node:24-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
# npm install reconciles package-lock while shared packages are consumed from
# the public npm registry via normal semver dependencies.
RUN npm install --no-audit --no-fund

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
