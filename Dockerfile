FROM node:24 AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:24 AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


FROM node:24 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]