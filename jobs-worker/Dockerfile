FROM node:24

WORKDIR /app

ENV NODE_ENV=production
ENV JOBS_RUNTIME_ROLE=worker
ENV JOBS_EXECUTION_ENABLED=on

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["node", "--experimental-transform-types", "--import", "./jobs-worker/alias-loader.mjs", "./jobs-worker/worker.ts"]
