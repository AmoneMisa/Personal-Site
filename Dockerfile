FROM node:22 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22 AS build
WORKDIR /app
##ENV NODE_OPTIONS="--max-old-space-size=4096"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22 AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
