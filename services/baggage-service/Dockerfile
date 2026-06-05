FROM node:22-slim AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY services/baggage-service/package*.json ./services/baggage-service/
RUN npm ci --workspace=services/baggage-service --workspace=packages/events \
           --workspace=packages/common-middleware --workspace=packages/shared-kernel \
           --ignore-scripts

COPY tsconfig.base.json ./
COPY services/baggage-service/ ./services/baggage-service/
COPY packages/ ./packages/

WORKDIR /app/services/baggage-service
RUN npm run build

FROM node:22-slim
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/baggage-service/dist ./dist
COPY --from=builder /app/services/baggage-service/node_modules ./node_modules

RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "dist/main"]
