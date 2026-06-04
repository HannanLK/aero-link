# AeroLink — Cloud-Native Airline Platform

> **COMP60010 Enterprise Cloud & Distributed Web Applications**
> Deadline: 5 June 2026 · Stack: NestJS · React · AWS EKS · Kafka · Terraform · Argo CD

---

## What This Is

AeroLink is a full-stack, production-grade airline booking platform built on a microservices architecture deployed to AWS EKS. It covers the complete passenger journey — flight discovery, booking (with distributed saga), web check-in, baggage tracking, and gate operations — plus staff portals for gate agents, flight ops crews, and immigration officers, and a super-admin dashboard.

---

## Application Features

### Passenger-facing (public, no login required)
| Feature | Route | Description |
|---------|-------|-------------|
| Landing page | `/` | Emirates-style hero with one-way / return / multi-city search, passenger count, cabin class |
| Flight search | `/search` | Results with filter sidebar, sort (cheapest / fastest / earliest), all-class price breakdown |
| Inline compare | `/search` | Select up to 3 flights → floating comparison panel |
| Flight tracker | `/track` | Leaflet world map with 20 live-animated AeroLink flights, status filter, detail card |
| Help centre | `/help` | FAQ accordion, 6 topic categories, 3 contact channels |
| Baggage policy | `/help/baggage` | Allowances by class, size guide, special items, prohibited list |

### Authenticated passenger flows (require login)
| Feature | Route |
|---------|-------|
| Seat selection & booking | `/flights/:id/book` |
| Booking management | `/bookings` |
| Web check-in + boarding pass QR | `/checkin` |
| Baggage tracker | `/baggage` |

### Staff portals (role-gated)
| Role | Route | What it does |
|------|-------|-------------|
| `GATE_AGENT` | `/gate-agent` | Load manifest, board passengers, progress bar |
| `FLIGHT_OPS` / `AIRCRAFT_CREW` | `/flight-ops` | Update flight status (8 states) |
| `IMMIGRATION_OFFICER` | `/immigration` | Passenger manifest with clearance status (CLEARED / FLAGGED / ADDITIONAL_SCREENING) |
| `ADMIN` | `/admin` | Service health monitoring, live metrics, user management table, booking ledger |

### Demo credentials (seeded automatically on first `docker compose` run)
| Email | Password | Role |
|-------|----------|------|
| `admin@aerolink.app` | `Demo@2024` | Admin + Passenger |
| `passenger@aerolink.app` | `Demo@2024` | Passenger |
| `gateagent@aerolink.app` | `Demo@2024` | Gate Agent |
| `flightops@aerolink.app` | `Demo@2024` | Flight Ops |
| `immigration@aerolink.app` | `Demo@2024` | Immigration Officer |

---

## Architecture

```
Browser
  │
  ├── CloudFront CDN ─────────────────────── Static webui (S3)
  │
  └── AWS API Gateway (JWT / Cognito) ───── ALB ──► EKS Cluster
                                                      ├── identity-service   (Aurora PG)
                                                      ├── flight-service     (Aurora PG + Redis)
                                                      ├── booking-service    (Aurora PG)
                                                      ├── payment-service    (Aurora PG + Stripe)
                                                      ├── checkin-service    (Aurora PG + Lambda)
                                                      ├── baggage-service    (DynamoDB)
                                                      └── notification-service (DynamoDB + SES)
                                                               │
                                                        Amazon MSK (Kafka)
                                                   Choreography Saga across services
```

### Event-Driven Booking Saga (Kafka choreography)
```
POST /bookings
  → booking-service publishes aerolink.booking.created
    → flight-service locks seat  → aerolink.seat-lock.confirmed / failed
      → booking-service initiates payment → aerolink.booking.payment-initiated
        → payment-service charges Stripe → aerolink.payment.completed / failed
          → booking-service confirms / compensates → aerolink.booking.confirmed
            → checkin-service + notification-service react
```

---

## Services

| Service | Port (local) | DB | Role |
|---------|-------------|----|------|
| identity-service | 3001 | Aurora PG | Auth (register / login / refresh / RBAC) |
| flight-service | 3002 | Aurora PG + Redis | Flight CRUD, CQRS seat-map projection |
| booking-service | 3003 | Aurora PG | Booking saga orchestration |
| payment-service | 3004 | Aurora PG | Stripe charge / refund (PCI DSS — last 4 only) |
| checkin-service | 3005 | Aurora PG | Web check-in, boarding-pass QR (Lambda) |
| baggage-service | 3006 | DynamoDB | Barcode scan, 7-state FSM |
| notification-service | 3007 | DynamoDB | SES email + SNS SMS |
| lambda-qr | — | — | QR code + Code128 barcode generator |

### RBAC — 9 Roles
`PASSENGER` · `GATE_AGENT` · `CHECK_IN_STAFF` · `BAGGAGE_HANDLER` · `FLIGHT_OPS` · `FLIGHT_ATTENDANT` · `AIRCRAFT_CREW` · `IMMIGRATION_OFFICER` · `ADMIN`

---

## Local Development

### Mode 1 — Infrastructure only (recommended for active development)

Services run on your host with hot-reload. Docker only provides databases, Kafka, and NGINX.

```bash
# Start infrastructure
docker compose up -d

# In separate terminals, start each service
npx turbo run dev --filter=identity-service
npx turbo run dev --filter=flight-service
# ... or start all at once from repo root
npm run dev

# Start webui
cd webui && npm run dev
# → http://localhost:5173
```

**Why:** Code changes reflect immediately — no Docker rebuild needed.
**NGINX** proxies `http://localhost:8080/api/v1/*` → services running on host ports 3001–3007.

---

### Mode 2 — Full Docker stack (demo / integration testing)

Everything runs in containers. No `npm run dev` needed. Demo users are seeded automatically.

```bash
# First run — builds 7 Docker images (~5–10 min)
docker compose -f docker-compose.full.yml up -d --build

# Subsequent runs (uses cached images, ~30 sec)
docker compose -f docker-compose.full.yml up -d

# Watch seed output for credentials confirmation
docker compose -f docker-compose.full.yml logs demo-seed

# Start webui (still runs on host, points to dockerised API gateway)
cd webui && npm run dev
# → http://localhost:5173
```

**Why two compose files?** The NGINX config must target either `host.docker.internal:3001` (host services) or `identity-service:3000` (container DNS). One file handles each case. See `infrastructure/dev/nginx-local.conf` vs `nginx-docker.conf`.

---

## Testing

### Order: Test → Deploy → Validate

```
1. Local unit tests
2. Local integration tests (against docker-compose infra)
3. Build passes (tsc + vite build)
4. Deploy to AWS (terraform apply)
5. Post-deploy health validation
6. Load test against live environment
```

**Never deploy untested code** — Terraform provisions real AWS resources that incur cost from the moment they exist.

### Run tests

```bash
# Unit tests — all services
npx turbo run test

# Unit tests — single service
npx turbo run test --filter=identity-service

# Coverage report
npx turbo run test:cov

# Type-check webui
cd webui && npx tsc --noEmit

# Production build (must pass before deploy)
cd webui && npm run build

# Lint all
npx turbo run lint
```

### Integration tests

```bash
# Start docker-compose infra first
docker compose up -d

# Run saga end-to-end tests
cd tests/integration && npm test

# Load tests (k6 required)
k6 run tests/load/booking-flow.js
```

---

## Deployment Prerequisites

### Tools (all already installed on this machine)
| Tool | Required | Installed |
|------|----------|-----------|
| AWS CLI | ≥ 2.x | ✅ 2.32.34 |
| Terraform | ≥ 1.7 | ✅ 1.14.3 |
| kubectl | ≥ 1.28 | ✅ 1.34.1 |
| Helm | ≥ 3.x | ✅ 4.1.4 |
| Docker | ≥ 24.x | ✅ 29.5.2 |
| Node.js | ≥ 22 | ✅ 25.2.0 |

### What you need to provide
| Item | Where used | Notes |
|------|-----------|-------|
| AWS Access Key ID | `aws configure` | IAM user with `AdministratorAccess` for initial setup |
| AWS Secret Access Key | `aws configure` | Never committed to git |
| AWS Account ID | Terraform, ECR URLs | Found in AWS Console → top-right menu |
| AWS Region | `terraform.tfvars` | Default: `us-east-1` |
| Domain name | Terraform (Route 53) | e.g. `aerolink.app` — optional for demo (can use ELB URL) |
| DB master password | `TF_VAR_db_master_password` | Min 12 chars, letters + numbers + symbol |
| Alert email | `terraform.tfvars` | Receives CloudWatch alarm notifications |
| Notification sender email | `terraform.tfvars` | Must be SES-verified; use same as alert email for dev |
| Stripe test key | AWS Secrets Manager | `sk_test_...` — free at dashboard.stripe.com |
| GitHub repo connected | GitHub Actions | For automated CI/CD (optional for manual deploy) |

---

## Deployment — Step by Step

### Step 1 — Configure AWS credentials
```bash
aws configure
# AWS Access Key ID:     <your key>
# AWS Secret Access Key: <your secret>
# Default region:        us-east-1
# Default output format: json

# Verify
aws sts get-caller-identity
```

### Step 2 — Create Terraform remote state (one-time, ~30 sec)
```bash
# State bucket
aws s3api create-bucket \
  --bucket aerolink-terraform-state \
  --region us-east-1

# Lock table
aws dynamodb create-table \
  --table-name aerolink-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Step 3 — Create terraform.tfvars
```bash
cp infrastructure/terraform/environments/dev/terraform.tfvars.example \
   infrastructure/terraform/environments/dev/terraform.tfvars

# Edit with your values:
#   aws_region                = "us-east-1"
#   domain_name               = "aerolink.app"   # or any domain you own
#   alert_email               = "you@email.com"
#   notification_email_sender = "you@email.com"
```

### Step 4 — Terraform init + plan
```bash
cd infrastructure/terraform/environments/dev
terraform init

# Review what will be created (19 modules, ~60 resources)
terraform plan \
  -var="db_master_password=YourStr0ngPass!" \
  -out=tfplan
```

### Step 5 — Apply infrastructure (~15–25 min)
```bash
terraform apply tfplan
# Creates: VPC, EKS, Aurora, MSK, ElastiCache, DynamoDB,
#          API Gateway, Cognito, CloudFront, Route 53, ACM,
#          WAF, GuardDuty, CloudTrail, KMS, ECR, Argo CD
```

### Step 6 — Configure kubectl for EKS
```bash
aws eks update-kubeconfig \
  --name aerolink-dev-eks \
  --region us-east-1

kubectl get nodes   # should show 2 Ready nodes
```

### Step 7 — Build & push Docker images to ECR
```bash
# Get ECR registry URL
REGISTRY=$(terraform output -raw ecr_registry_url)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $REGISTRY

# Build and push all 7 services + webui
for svc in identity-service flight-service booking-service \
           payment-service checkin-service baggage-service notification-service; do
  docker build -t $REGISTRY/aerolink-dev/$svc:latest \
    -f services/$svc/Dockerfile .
  docker push $REGISTRY/aerolink-dev/$svc:latest
done
```

### Step 8 — Store secrets in AWS Secrets Manager
```bash
ACCT=$(aws sts get-caller-identity --query Account --output text)
SM="aws secretsmanager update-secret --region us-east-1"

# DB URLs (Terraform output gives Aurora endpoint)
AURORA=$(terraform output -raw aurora_endpoint)
$SM --secret-id /aerolink/dev/identity-service/db-url \
    --secret-string "postgresql://aerolink:YourStr0ngPass!@${AURORA}:5432/identity_db"
# ... (repeat for each service)

# JWT secret
$SM --secret-id /aerolink/dev/shared/jwt-public-key \
    --secret-string "$(openssl rand -base64 48)"

# Stripe key
$SM --secret-id /aerolink/dev/payment-service/stripe-api-key \
    --secret-string "sk_test_YOUR_STRIPE_KEY"
```

### Step 9 — Argo CD syncs automatically
Argo CD (installed by Terraform) watches this git repo. Once images are in ECR and the `ApplicationSet` is active, it deploys all services automatically.

```bash
# Get Argo CD admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Port-forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8443:443
# → https://localhost:8443  (admin / <password above>)
```

### Step 10 — Post-deploy validation
```bash
API=$(terraform output -raw api_gateway_url)

# Health checks
curl $API/api/v1/health/live          # identity-service
curl $API/api/v1/flights/health/live  # flight-service

# Register a user
curl -X POST $API/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@1234","firstName":"Test","lastName":"User"}'
```

### Step 11 — Update webui to point to production API
```bash
# In webui/.env.production (create this file)
echo "VITE_API_BASE_URL=$(terraform output -raw api_gateway_url)/api/v1" \
  > webui/.env.production

# Build & sync to S3
cd webui && npm run build
aws s3 sync dist/ s3://$(terraform output -raw webui_bucket_name)/ \
  --delete
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

### Destroy (avoids AWS bill when not in use)
```bash
cd infrastructure/terraform/environments/dev
terraform destroy -var="db_master_password=YourStr0ngPass!"
# Confirm: yes
# Takes ~10-15 min to tear everything down
```

---

## CI/CD (GitHub Actions — automated path)

Configure these secrets in your GitHub repository → Settings → Secrets:

| Secret | Value |
|--------|-------|
| `AWS_ACCOUNT_ID` | Your 12-digit account ID |
| `AWS_DEPLOY_ROLE_ARN` | OIDC role ARN (created by Terraform IAM module) |
| `AWS_TERRAFORM_ROLE_ARN` | OIDC role ARN for infra changes |
| `ALERT_EMAIL` | ops@yourdomain.com |
| `DOMAIN_NAME` | aerolink.app (or your domain) |
| `DB_MASTER_PASSWORD` | Your Aurora password |

Once set, every push to `main` automatically:
1. Runs lint + tests
2. Builds Docker images
3. Pushes to ECR
4. Updates Helm values
5. Argo CD detects the change and syncs to EKS

---

## Kafka Topics (15 total, 3 partitions each)

| Topic | Producer | Consumers |
|-------|----------|-----------|
| `aerolink.booking.created` | booking | flight |
| `aerolink.booking.confirmed` | booking | checkin, notification |
| `aerolink.booking.cancelled` | booking | notification |
| `aerolink.booking.payment-initiated` | booking | payment |
| `aerolink.booking.seat-released` | booking | flight |
| `aerolink.seat-lock.confirmed` | flight | booking |
| `aerolink.seat-lock.failed` | flight | booking |
| `aerolink.payment.completed` | payment | booking |
| `aerolink.payment.failed` | payment | booking |
| `aerolink.checkin.completed` | checkin | notification |
| `aerolink.baggage.tagged` | baggage | notification |
| `aerolink.baggage.scanned` | baggage | — |
| `aerolink.baggage.status-updated` | baggage | notification |
| `aerolink.identity.registered` | identity | notification |
| `aerolink.dlq` | all (failures) | monitoring |

---

## Observability

| Layer | Tool | Config |
|-------|------|--------|
| Logs | Fluent Bit → CloudWatch Logs | `/aws/aerolink/dev/*` log groups |
| Traces | OpenTelemetry → X-Ray | Auto-instrumented NestJS |
| Metrics | CloudWatch Container Insights | EKS pod/node metrics |
| Dashboards | CloudWatch | `infrastructure/observability/cloudwatch-dashboard.json` |
| Alarms | CloudWatch → SNS → email | CPU >70%, error rate >5%, latency >2s |
| Threat detection | GuardDuty | EKS audit logs, S3 data events, malware scan |

---

## Security Controls

| Control | Implementation |
|---------|---------------|
| Auth | Cognito User Pool + JWT (15 min access / 7 day refresh) |
| Secrets | AWS Secrets Manager + External Secrets Operator (pod-injected) |
| Encryption at rest | 3 KMS CMKs: `cmk-pci` (payments), `cmk-pii` (user data), `cmk-infra` (general) |
| Encryption in transit | TLS 1.3 — CloudFront, ALB, EKS pod-to-pod via IRSA |
| PCI DSS | Card last-4 only stored; Stripe tokenises card numbers |
| GDPR | Per-user envelope key — delete key to cryptographically shred PII |
| WAF | AWS Managed Rule Groups on API Gateway + CloudFront |
| Audit trail | CloudTrail multi-region, 7-year Glacier archival |
| Container hardening | Read-only FS, drop ALL Linux capabilities, non-root UID 1000 |
| RBAC | 9 roles enforced at API Gateway (JWT claim) + service layer (own-record check) |

---

## Estimated AWS Cost (dev environment, ap-southeast-1)

| Resource | $/day |
|----------|-------|
| EKS cluster + 2× t3.medium Spot nodes | ~$1.20 |
| Aurora PostgreSQL (1 writer + 1 reader t3.medium) | ~$4.80 |
| MSK Kafka (3× kafka.t3.small, 3 AZs) | ~$3.60 |
| ElastiCache Redis (2× cache.t3.micro) | ~$0.48 |
| NAT Gateway | ~$1.08 |
| ALB + data transfer | ~$0.60 |
| **Total** | **~$11.76/day (~$353/month)** |

> ⚠️ Run `terraform destroy` when not using the environment.

---

## Project Structure

```
aero-link/
├── packages/
│   ├── events/                 # Zod-validated Kafka event schemas (shared contract)
│   ├── common-middleware/      # CorrelationId, RolesGuard, ExceptionFilter, Logger
│   └── shared-kernel/          # Money, PaginatedResult, DTOs, constants
│
├── services/
│   ├── identity-service/       # NestJS + Prisma + bcrypt + JWT
│   ├── flight-service/         # NestJS + Prisma + Redis CQRS projection
│   ├── booking-service/        # NestJS + Prisma + Kafka saga
│   ├── payment-service/        # NestJS + Prisma + Stripe SDK
│   ├── checkin-service/        # NestJS + Prisma + Lambda invocation
│   ├── baggage-service/        # NestJS + DynamoDB + Kafka FSM
│   ├── notification-service/   # NestJS + DynamoDB + SES/SNS
│   └── lambda-qr/              # Node.js Lambda — QR code + Code128 barcode
│
├── webui/                      # React 19 + Vite + shadcn/ui + Tailwind v4
│   └── src/
│       ├── pages/              # 15 pages (public + authenticated + staff)
│       ├── components/         # AirportSelect, PassengersSelector, SeatMap, layouts
│       ├── lib/                # airports.ts, pricing.ts, mockFlights.ts, api.ts
│       └── store/              # Zustand auth store (JWT + 9 RBAC roles)
│
├── infrastructure/
│   ├── terraform/
│   │   ├── modules/            # 19 reusable modules (vpc, eks, rds-aurora, msk, ...)
│   │   └── environments/dev/   # Root module — single terraform apply/destroy
│   ├── argocd/                 # ApplicationSet — auto-deploys all 8 services
│   ├── dev/
│   │   ├── nginx-local.conf    # NGINX config → host services (npm run dev mode)
│   │   ├── nginx-docker.conf   # NGINX config → container services (full docker mode)
│   │   ├── postgres-init.sql   # Creates 5 databases on first start
│   │   └── seed-demo.sh        # Creates 5 demo users with roles
│   └── observability/
│       └── cloudwatch-dashboard.json
│
├── tests/
│   ├── load/                   # k6 load + stress tests
│   └── integration/            # Saga end-to-end tests
│
├── docs/
│   ├── adr/                    # 8 Architecture Decision Records
│   ├── architecture/           # Sequence diagrams (Booking Saga, Checkin Flow)
│   ├── event-catalogue.md      # All 15 Kafka topics with schemas
│   └── rbac-matrix.md          # Permission matrix (9 roles × 6 domains)
│
├── docker-compose.yml          # Infra only (postgres, redis, kafka, nginx) — dev mode
├── docker-compose.full.yml     # Full stack (infra + all 7 services + seed) — demo mode
└── start-demo.sh               # One-command demo startup
```

---

## Shared Packages

| Package | Purpose |
|---------|---------|
| `@aerolink/events` | Zod schemas for all 15 Kafka event types — single source of truth |
| `@aerolink/common-middleware` | `CorrelationIdMiddleware`, `RolesGuard`, `HttpExceptionFilter`, `RequestLoggerInterceptor`, `CircuitBreaker`, `retryWithBackoff`, `initTracing`, `createKafka` |
| `@aerolink/shared-kernel` | `Money` value object, `PaginatedResult<T>`, shared constants |

---

## Architecture Documentation

| Document | Location | Description |
|----------|----------|-------------|
| **High-Level Architecture** | `docs/architecture/high-level-architecture.md` | System overview, AWS infra diagram, service communication matrix, data flow |
| **Kafka Architecture** | `docs/architecture/kafka-architecture.md` | Topic design, partition strategy, consumer groups, SASL/IAM auth, DLQ |
| **Circuit Breaker** | `docs/architecture/circuit-breaker.md` | State machine, per-service config, retry policy, cascading failure prevention |
| **Data Consistency** | `docs/architecture/data-consistency.md` | CAP theorem, Saga choreography, CQRS, eventual consistency, idempotency |
| **Disaster Recovery** | `docs/architecture/disaster-recovery.md` | Multi-AZ HA, RTO/RPO targets, failure scenarios, auto-scaling, backups |
| **Security & Compliance** | `docs/architecture/security-compliance.md` | KMS encryption, OAuth 2.0 + Cognito, RBAC, GDPR, PCI DSS |
| **Booking Saga Sequence** | `docs/architecture/sequence-booking-saga.md` | Detailed booking saga sequence diagram |
| **Check-in Flow** | `docs/architecture/sequence-checkin-flow.md` | Check-in and boarding pass sequence diagram |
| **ADRs (1-8)** | `docs/adr/` | 8 Architecture Decision Records |
| **Swagger Testing** | `docs/testing/swagger-testing-guide.md` | Step-by-step API testing with Swagger UI |
| **Performance Testing** | `docs/testing/performance-results.md` | Load/stress/spike test results template |
| **Event Catalogue** | `docs/event-catalogue.md` | All 15 Kafka topics with schemas |
| **RBAC Matrix** | `docs/rbac-matrix.md` | Permission matrix (9 roles × 6 domains) |

