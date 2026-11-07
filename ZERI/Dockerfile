# Backend (Express /api + serves the built site) for Google Cloud Run / Render.
# Build:  gcloud run deploy zeri-api --source .   (see docs/DEPLOY_BACKEND.md)
FROM node:22-slim AS build
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=450"
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:server
RUN mkdir -p dist && (test -f dist/index.html || echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zëri API</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h1>Zëri i Qytetarëve API</h1><p>Status: Operacional (200 OK)</p></body></html>' > dist/index.html)

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
