# Nightfall: one container serves the web app and the WebSocket game server on $PORT.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src ./src
ENV PORT=8787
ENV DATA_FILE=/data/store.json
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
