FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV JOBS_RUNTIME_ROLE=worker

COPY package.json package-lock.json ./
# parsing-lexicon intentionally tracks #master. Resolve the live branch instead
# of enforcing stale package-lock integrity from a previous branch snapshot.
RUN npm install --omit=dev --package-lock=false --legacy-peer-deps

COPY . .

CMD ["node", "--experimental-transform-types", "--import", "./jobs-worker/alias-loader.mjs", "./jobs-worker/worker.ts"]
