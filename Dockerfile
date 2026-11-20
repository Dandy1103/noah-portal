FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/noah-portal/browser ./dist/noah-portal/browser
COPY server ./server
USER node
CMD ["node", "server/index.mjs"]
