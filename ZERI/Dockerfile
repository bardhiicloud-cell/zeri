# Backend (Express /api + serves the built site) for Google Cloud Run / Render.
# Build:  gcloud run deploy zeri-api --source .   (see docs/DEPLOY_BACKEND.md)
FROM node:22-slim AS build
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=450"
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY scripts/start-prod.cjs ./scripts/start-prod.cjs
# Server code reads the web config as a fallback when VITE_FIREBASE_* are not set.
COPY firebase-applet-config.json ./firebase-applet-config.json
# Cloud Run sets PORT (8080); server.ts honours it.
EXPOSE 8080
CMD ["node", "scripts/start-prod.cjs"]
