FROM node:22-slim AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY services/booking-service/package*.json ./services/booking-service/
RUN npm ci --workspace=services/booking-service --workspace=packages/events \
           --workspace=packages/common-middleware --workspace=packages/shared-kernel \
           --ignore-scripts

COPY tsconfig.base.json ./
COPY services/booking-service/ ./services/booking-service/
COPY packages/ ./packages/

# Build shared packages (generates dist/ for runtime resolution)
WORKDIR /app/packages/shared-kernel
RUN npx tsc 2>/dev/null || true
WORKDIR /app/packages/events
RUN npx tsc 2>/dev/null || true
WORKDIR /app/packages/common-middleware
RUN npx tsc 2>/dev/null || true

WORKDIR /app/services/booking-service
RUN npx prisma generate && npm run build

# --- Production image -------------------------------------------
FROM node:22-slim
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Copy manifests and compiled packages for workspace resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/booking-service/package.json ./services/booking-service/

# Fresh production install - follows lock file exactly, places packages correctly
RUN npm ci --workspace=services/booking-service --workspace=packages/events \
           --workspace=packages/common-middleware --workspace=packages/shared-kernel \
           --omit=dev --ignore-scripts

# Copy compiled service
COPY --from=builder /app/services/booking-service/dist ./dist
COPY --from=builder /app/services/booking-service/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "dist/main"]