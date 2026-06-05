FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY services/notification-service/package*.json ./services/notification-service/
RUN npm ci --workspace=services/notification-service --workspace=packages/events \
           --workspace=packages/common-middleware --workspace=packages/shared-kernel \
           --ignore-scripts

COPY tsconfig.base.json ./
COPY services/notification-service/ ./services/notification-service/
COPY packages/ ./packages/

WORKDIR /app/services/notification-service
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/notification-service/dist ./dist
COPY --from=builder /app/services/notification-service/node_modules ./node_modules

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s \
  CMD wget -qO- http://localhost:3000/api/v1/health/live || exit 1
CMD ["node", "dist/main"]
