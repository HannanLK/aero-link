FROM node:22-slim AS builder

WORKDIR /app

# Copy ALL workspace manifests
COPY package*.json ./
COPY packages/ ./packages/
COPY services/flight-service/ ./services/flight-service/

# Full install - all workspaces, all deps
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./

# Build shared packages
RUN cd packages/shared-kernel && npx tsc 2>/dev/null || true
RUN cd packages/events && npx tsc 2>/dev/null || true
RUN cd packages/common-middleware && npx tsc 2>/dev/null || true

# Build the service
WORKDIR /app/services/flight-service
RUN npx prisma generate && npm run build

# Prune devDependencies from node_modules
WORKDIR /app
RUN npm prune --omit=dev --ignore-scripts

# --- Production image ---
FROM node:22-slim
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/flight-service/node_modules ./services/flight-service/node_modules
COPY --from=builder /app/services/flight-service/dist ./services/flight-service/dist
COPY --from=builder /app/services/flight-service/prisma ./services/flight-service/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
WORKDIR /app/services/flight-service
CMD ["node", "dist/main"]