# ADR-008 — Frontend Deployment: nginx in EKS + CloudFront CDN

| Field      | Value |
|------------|-------|
| Status     | Accepted |
| Date       | 2026-05-26 |
| Rubric     | Task 1 (Containerisation), Implementation — full K8s demonstration |

## Context

The React 19 SPA (Vite build output) must be deployed to AWS. The deployment strategy must:
- Demonstrate full containerisation (Docker) and Kubernetes orchestration
- Achieve CDN performance (global edge caching)
- Be consistent with the deployment model of all backend services
- Be cost-efficient

## Decision

**nginx:alpine container in EKS** served behind the **ALB + CloudFront**.

```
Browser ──HTTPS──► CloudFront (WAF + ACM TLS)
                        │
                   Origin: ALB (EKS Ingress)
                        │
                  webui Deployment (nginx pods)
                  - Vite dist/ at /usr/share/nginx/html
                  - SPA routing: try_files $uri /index.html
```

## Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **EKS nginx (chosen)** | Fully containerised, consistent GitOps pipeline, Kubernetes demonstrates full stack | Slightly more infra than S3 | Accepted |
| S3 + CloudFront only | Zero pod cost, simplest setup | Static hosting only; webui not containerised; breaks the "everything in K8s" story | Rejected |
| ECS Fargate | Serverless containers | Not Kubernetes; inconsistent with rest of platform | Rejected |

## Dockerfile

```dockerfile
# Stage 1 — build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_WS_BASE_URL
RUN npm run build

# Stage 2 — serve
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s \
  CMD wget -qO- http://localhost/health || exit 1
```

`VITE_API_BASE_URL` and `VITE_WS_BASE_URL` are injected at Docker build time by GitHub Actions (read from GitHub Secrets → API Gateway URL from Terraform output).

## nginx.conf

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /health {
    return 200 'ok';
    add_header Content-Type text/plain;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }

  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header Referrer-Policy "strict-origin-when-cross-origin";
  add_header Content-Security-Policy "default-src 'self'; connect-src 'self' <API_GW_URL> wss://<API_GW_WS_URL>; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'";
}
```

CSP headers block XSS by restricting script sources to `'self'` only.

## Helm Chart

The webui Helm chart follows the same structure as every backend service:

```
webui/helm/
├── Chart.yaml         name: webui, appVersion: "{{ .Values.image.tag }}"
├── values.yaml        image.repository, image.tag, ingress.host, hpa.minReplicas
└── templates/
    ├── deployment.yaml    — 2 replicas, nginx liveness at /health
    ├── service.yaml       — ClusterIP :80
    ├── ingress.yaml       — ALB Ingress, host: aerolink.app, cert: ACM ARN
    ├── hpa.yaml           — CPU 70% → max 4 replicas
    └── pdb.yaml           — minAvailable: 1
```

## CloudFront Configuration

| Setting | Value |
|---------|-------|
| Origin | ALB DNS name (HTTPS only) |
| Cache behaviours | `/*.html` — no cache; `/*.js`, `/*.css` — 1 year (hash in filename) |
| WAF | `aerolink-waf` WebACL attached |
| TLS | ACM certificate `aerolink.app` |
| Price class | `PriceClass_100` (US/Europe edge nodes only — cost reduction) |
| HTTP/2 | Enabled |
| Compress | Enabled (gzip/brotli) |

## Consequences

- Vite build hashes all static asset filenames (`main.a1b2c3.js`) — safe to set 1-year CloudFront cache on JS/CSS.
- `/index.html` is never cached (Cache-Control: no-cache) — ensures users always get the latest SPA shell.
- GitHub Actions CI: `npm run build → docker build → docker push ECR → bump Helm values → Argo CD sync`.
- Environment variables (`VITE_*`) are baked into the Docker image at build time via `ARG`. No runtime injection needed since this is a static SPA.
