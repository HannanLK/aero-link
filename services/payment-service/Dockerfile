FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY services/payment-service/package*.json ./services/payment-service/
RUN npm ci --workspace=services/payment-service --workspace=packages/events \
           --workspace=packages/common-middleware --workspace=packages/shared-kernel \
           --ignore-scripts

COPY tsconfig.base.json ./
COPY services/payment-service/ ./services/payment-service/
COPY packages/ ./packages/

WORKDIR /app/services/payment-service
RUN npx prisma generate && npm run build

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/payment-service/dist ./dist
COPY --from=builder /app/services/payment-service/node_modules ./node_modules
COPY --from=builder /app/services/payment-service/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s \
  CMD wget -qO- http://localhost:3000/api/v1/health/live || exit 1
CMD ["node", "dist/main"]
