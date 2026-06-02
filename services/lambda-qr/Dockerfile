FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /build/dist/ ./
COPY --from=builder /build/node_modules/ ./node_modules/

CMD ["handler.handler"]
