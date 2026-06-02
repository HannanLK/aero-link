FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY services/flight-service/package*.json ./services/flight-service/
RUN npm ci --workspace=services/flight-service --workspace=packages/events \
           --workspace=packages/common-middleware --workspace=packages/shared-kernel \
           --ignore-scripts

COPY tsconfig.base.json ./
COPY services/flight-service/ ./services/flight-service/
COPY packages/ ./packages/

WORKDIR /app/services/flight-service
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/flight-service/dist ./dist
COPY --from=builder /app/services/flight-service/node_modules ./node_modules
COPY --from=builder /app/services/flight-service/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s \
  CMD wget -qO- http://localhost:3000/api/v1/health/live || exit 1
CMD ["node", "dist/main"]
