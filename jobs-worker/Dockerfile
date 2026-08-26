FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV JOBS_RUNTIME_ROLE=worker

COPY package.json package-lock.json ./
# Reconcile the explicit parsing-lexicon SHA pin while retaining the lock for
# all unchanged dependencies.
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

CMD ["node", "--experimental-transform-types", "--import", "./jobs-worker/alias-loader.mjs", "./jobs-worker/worker.ts"]
