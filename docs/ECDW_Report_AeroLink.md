# AeroLink — Enterprise Cloud & Distributed Web Application

**Module:** COMP60010 — Enterprise Cloud & Distributed Web Applications
**Student:** [Your Name] | **ID:** [Your Student ID]
**Submission Date:** 5 June 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Cloud-Based Web Application Design](#2-cloud-based-web-application-design)
3. [Distributed Web Application and API Design](#3-distributed-web-application-and-api-design)
4. [Data Security, Compliance and Consistency](#4-data-security-compliance-and-consistency)
5. [Real-Time Data Synchronisation](#5-real-time-data-synchronisation)
6. [Fault Tolerance and Resilience](#6-fault-tolerance-and-resilience)
7. [Performance and Scalability Testing](#7-performance-and-scalability-testing)
8. [Monitoring and Observability](#8-monitoring-and-observability)
9. [Testing Strategy](#9-testing-strategy)
10. [CI/CD Pipeline and GitOps Deployment](#10-cicd-pipeline-and-gitops-deployment)
11. [Challenges and Future Improvements](#11-challenges-and-future-improvements)
12. [Conclusion and Reflections](#12-conclusion-and-reflections)
13. [References](#13-references)

---

## 1. Introduction

### 1.1 Background and Problem Statement

Airlines depend on interconnected digital systems to handle flight scheduling, passenger bookings, payments, check-in procedures, baggage tracking, and gate operations. A failure in any one of these areas can cascade across the entire operation, causing delays, revenue loss, and passenger dissatisfaction. Traditional monolithic applications struggle with this complexity because a single deployment unit cannot scale, evolve, or recover independently for each domain.

AeroLink addresses this by decomposing the airline domain into independently deployable microservices, each responsible for a bounded context, and orchestrating them through event-driven communication on AWS cloud infrastructure.

### 1.2 Aims and Objectives

| # | Objective |
|---|-----------|
| O1 | Design and implement a cloud-native microservices platform covering the full passenger journey |
| O2 | Deploy to AWS EKS with Infrastructure-as-Code (Terraform) and GitOps (ArgoCD) |
| O3 | Implement an event-driven Saga pattern for distributed booking transactions via Kafka |
| O4 | Enforce enterprise-grade security: OAuth 2.0, KMS encryption, RBAC, PCI DSS, GDPR |
| O5 | Deliver real-time seat availability and baggage tracking via WebSockets and CQRS |
| O6 | Demonstrate fault tolerance through circuit breakers, compensating transactions, and auto-scaling |
| O7 | Establish a CI/CD pipeline with automated testing, container builds, and continuous deployment |

### 1.3 Scope

**In scope:**
- 7 NestJS microservices + 1 serverless Lambda function
- React 19 single-page application (WebUI)
- AWS deployment: EKS, Aurora PostgreSQL, MSK Kafka, ElastiCache Redis, DynamoDB, Lambda, CloudFront, API Gateway, Cognito, KMS, WAF, GuardDuty, CloudTrail
- Kafka-based choreography saga for booking flow
- k6 load/stress testing
- GitHub Actions CI + ArgoCD continuous deployment

**Out of scope:**
- Mobile native applications
- Multi-region active-active deployment (designed for, not implemented)
- Real airline data integrations (GDS, Amadeus)

### 1.4 Technologies Used

| Layer | Technology | Version / Detail |
|-------|-----------|-----------------|
| **Backend** | NestJS (Node.js) | TypeScript, Prisma ORM |
| **Frontend** | React 19 + Vite | shadcn/ui, Tailwind v4, Zustand |
| **Event Streaming** | Apache Kafka | Amazon MSK, 15 topics |
| **Relational DB** | PostgreSQL | Amazon Aurora Multi-AZ |
| **Document DB** | DynamoDB | Baggage + notifications |
| **Cache / CQRS** | Redis | Amazon ElastiCache Multi-AZ |
| **Serverless** | AWS Lambda | QR/barcode generator |
| **Container Orchestration** | Kubernetes | Amazon EKS, Helm charts |
| **Infrastructure-as-Code** | Terraform | 19 reusable modules |
| **CI/CD** | GitHub Actions + ArgoCD | GitOps sync |
| **API Gateway** | AWS API Gateway | HTTP + WebSocket APIs |
| **Auth** | AWS Cognito | OAuth 2.0, JWT |
| **CDN** | CloudFront | TLS 1.3, WAF |
| **Monitoring** | CloudWatch, X-Ray | Logs, metrics, traces |
| **Testing** | Jest, k6, Postman | Unit, load, API testing |

---

## 2. Cloud-Based Web Application Design

### 2.1 Architecture Overview

AeroLink follows a layered cloud architecture comprising five tiers:

| Tier | Components | Responsibility |
|------|-----------|---------------|
| **Edge** | CloudFront CDN, WAF, Route 53 | TLS termination, DDoS protection, DNS |
| **API** | API Gateway (HTTP + WebSocket) | JWT validation, rate limiting, routing |
| **Compute** | EKS cluster (2–6 Spot nodes) | Service pods, platform add-ons |
| **Data** | Aurora PG, Redis, DynamoDB, MSK | Persistence, caching, event streaming |
| **Security** | KMS, Cognito, Secrets Manager, GuardDuty | Encryption, auth, threat detection |

Client requests flow through CloudFront (static assets) or API Gateway (API calls), which validates JWTs via Cognito before forwarding through a VPC Link to the Application Load Balancer inside the EKS cluster. The ALB routes to the appropriate service pod based on path prefixes.

**Figure 2.1 — High-Level Architecture**

![AeroLink High-Level Architecture](C:/Users/hanaa/.gemini/antigravity-ide/brain/bae818b8-527f-48ac-b120-cc578241c043/high_level_architecture_1780653272631.png)

> **📸 Screenshot Placeholder:** *[Insert AWS Console — VPC/EKS overview here]*

### 2.2 Microservices Breakdown

Each service owns its database, exposes a REST API, and communicates asynchronously through Kafka.

| Service | Database | Key Responsibility | Kafka Role |
|---------|----------|-------------------|------------|
| **identity-service** | Aurora PG | Registration, login, JWT, RBAC (9 roles) | Produces `user.registered` |
| **flight-service** | Aurora PG + Redis | Flight CRUD, CQRS seat-map projection | Produces `seat-lock.*`, consumes `booking.created` |
| **booking-service** | Aurora PG | Saga orchestration, booking lifecycle | Produces `booking.*`, consumes `seat-lock.*`, `payment.*` |
| **payment-service** | Aurora PG | Stripe integration, PCI-compliant charge/refund | Produces `payment.*`, consumes `booking.payment-initiated` |
| **checkin-service** | Aurora PG | Web check-in, boarding pass, Lambda QR invocation | Produces `checkin.completed`, consumes `booking.confirmed` |
| **baggage-service** | DynamoDB | 7-state FSM baggage tracking, barcode scanning | Produces `baggage.*` |
| **notification-service** | DynamoDB | SES email + SNS SMS dispatch | Consumes events from all domains |
| **lambda-qr** | — | Serverless QR code + Code128 barcode generation | Invoked by checkin-service |

Shared logic is extracted into three monorepo packages:
- `@aerolink/events` — Zod-validated Kafka event schemas (single source of truth)
- `@aerolink/common-middleware` — Correlation ID, RBAC guard, circuit breaker, tracing
- `@aerolink/shared-kernel` — Money value object, pagination, constants
**Figure 2.2 — Microservices Interaction and Shared Monorepo Packages**

![AeroLink Microservices Interaction Diagram](C:/Users/hanaa/.gemini/antigravity-ide/brain/bae818b8-527f-48ac-b120-cc578241c043/microservices_interaction_diagram_white_1780668332859.png)

### 2.3 Containerisation

Every service is containerised using multi-stage Docker builds:

```
Stage 1 (builder): npm ci → npx prisma generate → nest build
Stage 2 (runtime): node:22-alpine, copy dist + node_modules, UID 1000
```

**Container hardening applied:**

| Control | Implementation |
|---------|---------------|
| Non-root user | `USER 1000` in Dockerfile |
| Read-only filesystem | `readOnlyRootFilesystem: true` in Helm |
| Drop capabilities | `drop: ALL` — no Linux capabilities |
| Image scanning | ECR scans on push |

Docker Compose provides two operational modes:
- **`docker-compose.yml`** — infrastructure only (Postgres, Redis, Kafka, NGINX); services run on host with hot-reload
- **`docker-compose.full.yml`** — full stack with all 7 services containerised + demo user seeding

> **📸 Screenshot Placeholder:** *[Insert Docker Desktop — running containers here]*

> **📸 Screenshot Placeholder:** *[Insert terminal — `docker compose up` output here]*

### 2.4 Serverless Computing

The **lambda-qr** function handles QR code and Code128 barcode generation for boarding passes. It runs as an AWS Lambda function deployed via a Docker container image stored in ECR.

**Why serverless for this component:**
- Stateless, CPU-bound image generation — ideal for Lambda's execution model
- Invoked only during check-in — no need for always-on compute
- Scales to zero when unused, reducing cost
- Invoked synchronously by checkin-service via the AWS SDK (`InvokeCommand`)

**Configuration:**

| Property | Value |
|----------|-------|
| Runtime | Node.js 22 (container image) |
| Memory | 256 MB |
| Timeout | 30 seconds |
| VPC | Deployed in private subnets (same VPC as EKS) |
| Security | Accessible only from checkin-service's IRSA role |

> **📸 Screenshot Placeholder:** *[Insert AWS Lambda console — function overview here]*

### 2.5 Cloud-Managed Databases

AeroLink uses a polyglot persistence strategy — each service selects the database best suited to its data model.

| Database | Services | Justification |
|----------|---------|--------------|
| **Aurora PostgreSQL** (Multi-AZ) | identity, flight, booking, payment, checkin | Relational data with ACID transactions; 5 logical databases on a single cluster |
| **ElastiCache Redis** (Multi-AZ) | flight-service | CQRS read model for seat maps (<5ms reads); distributed seat locking via `SET NX` |
| **DynamoDB** | baggage, notification | Schema-flexible document storage; built-in 3-AZ replication; on-demand scaling |

Aurora is configured with a writer instance in `us-east-1a` and a reader replica in `us-east-1b`, providing synchronous replication and automatic failover within ~30 seconds.

> **📸 Screenshot Placeholder:** *[Insert AWS RDS Console — Aurora cluster here]*

> **📸 Screenshot Placeholder:** *[Insert AWS DynamoDB Console — tables here]*

### 2.6 High Availability and Multi-AZ Deployment

Every stateful component is replicated across two availability zones (`us-east-1a` and `us-east-1b`):

| Component | AZ-a | AZ-b | Failover Time |
|-----------|------|------|--------------|
| Aurora PostgreSQL | Writer | Reader (auto-promote) | ~30 seconds |
| ElastiCache Redis | Primary | Replica (auto-promote) | <60 seconds |
| MSK Kafka | Broker 1 | Broker 2 | ~5 seconds (leader election) |
| EKS Nodes | Spot nodes | Spot nodes | 2–5 minutes (autoscaler) |
| DynamoDB | Built-in 3-AZ | — | 0 (no failover needed) |

PodDisruptionBudgets (`minAvailable: 1`) ensure at least one replica of each service stays running during voluntary disruptions such as node drains or rolling updates.

**RTO/RPO Summary:**

| Metric | Target |
|--------|--------|
| Overall RPO (data loss) | < 1 second |
| Overall RTO (downtime) | < 5 minutes |

> **📸 Screenshot Placeholder:** *[Insert AWS VPC — subnet/AZ layout here]*

### 2.7 Horizontal Scalability

AeroLink scales at both the pod and node levels:

| Scaler | Trigger | Range |
|--------|---------|-------|
| **HPA** (Horizontal Pod Autoscaler) | CPU > 70% | 2 → 6 pods per service |
| **KEDA** (Event-Driven Autoscaler) | Kafka consumer lag > threshold | 2 → 6 pods (baggage, notification) |
| **Cluster Autoscaler** | Pending pods (insufficient node capacity) | 2 → 6 t3.medium Spot nodes |

KEDA is used specifically for baggage-service and notification-service because their workload is driven by Kafka event volume rather than HTTP request load. When consumer lag exceeds the threshold, KEDA scales out additional consumer pods.

> **📸 Screenshot Placeholder:** *[Insert EKS — node scaling / HPA output here]*

---

## 3. Distributed Web Application and API Design

### 3.1 RESTful API Design

All services follow consistent REST conventions:

| Convention | Implementation |
|-----------|---------------|
| Base path | `/api/v1/{resource}` |
| Versioning | URI path (`v1`) |
| Status codes | `200 OK`, `201 Created`, `202 Accepted` (async), `4xx`, `5xx` |
| Pagination | `?page=1&limit=20` with `PaginatedResult<T>` wrapper |
| Idempotency | `Idempotency-Key` header on write operations |
| Correlation | `X-Correlation-ID` header propagated across all services |

Key endpoint examples:

```
POST   /api/v1/auth/register        → 201 Created
POST   /api/v1/auth/login           → 200 OK { accessToken, refreshToken }
GET    /api/v1/flights?origin=LHR   → 200 OK (paginated)
POST   /api/v1/bookings             → 202 Accepted (saga starts)
POST   /api/v1/checkin              → 200 OK { boardingPassUrl }
GET    /api/v1/baggage/:id          → 200 OK { status, history[] }
```

Booking creation returns `202 Accepted` rather than `201` because the saga executes asynchronously across multiple services. The client polls `/bookings/{id}/status` or receives updates via WebSocket.

> **📸 Screenshot Placeholder:** *[Insert Swagger UI — booking-service endpoints here]*

### 3.2 Event-Driven Architecture

Inter-service communication uses **Apache Kafka** (Amazon MSK) with a choreography-based event-driven pattern. Services publish domain events and subscribe to events they need — there is no central orchestrator.

**Kafka Cluster Configuration:**

| Property | Value |
|----------|-------|
| Brokers | 2 (one per AZ) |
| Topics | 15 + 1 DLQ |
| Partitions per topic | 3 (booking-related) to 6 (high-volume) |
| Replication factor | 2 |
| Authentication | SASL/IAM (no passwords) |
| Encryption | TLS in-transit + KMS at-rest |
| Retention | 1 hour – 30 days (topic-dependent) |

**Topic Naming Convention:** `aerolink.{domain}.{event-name}`

**Event Schema Contract:**
All events share a standardized envelope defined in `@aerolink/events` and validated with **Zod** at both producer and consumer:

```typescript
interface EventEnvelope<T> {
  eventId: string;        // UUID v4
  eventType: string;      // e.g. 'BookingCreated'
  occurredAt: string;     // ISO 8601
  correlationId: string;  // traces request across services
  version: number;        // schema version
  payload: T;
}
```

**Key Event Flows:**

| Topic | Producer | Consumer(s) | Purpose |
|-------|----------|------------|---------|
| `booking.created` | booking | flight | Trigger seat lock |
| `seat-lock.confirmed` | flight | booking | Advance saga |
| `booking.payment-initiated` | booking | payment | Trigger Stripe charge |
| `payment.completed` | payment | booking | Confirm booking |
| `booking.confirmed` | booking | checkin, notification | Enable check-in, send email |
| `baggage.status-updated` | baggage | notification | Bag tracking alerts |

**Figure 3.1 — Event-Driven Architecture (Kafka Choreography)**

![AeroLink Event-Driven Architecture](C:/Users/hanaa/.gemini/antigravity-ide/brain/bae818b8-527f-48ac-b120-cc578241c043/event_driven_architecture_1780653408076.png)

> **📸 Screenshot Placeholder:** *[Insert Kafka UI — topics list here]*

### 3.3 API Gateway

AWS API Gateway serves as the single entry point for all client traffic:

| Feature | Configuration |
|---------|--------------|
| Protocol | HTTP API + WebSocket API |
| Authentication | Cognito JWT Authorizer |
| Rate limiting | 500 requests/second per route |
| WAF | AWS Managed Rule Groups (SQLi, XSS, rate-limit) |
| Backend integration | VPC Link → ALB → EKS pods |
| Custom domain | `api.transnova.online` via Route 53 + ACM |

The API Gateway validates JWT tokens and injects `x-user-id` and `x-user-roles` headers before forwarding to services, offloading authentication from individual microservices.

> **📸 Screenshot Placeholder:** *[Insert AWS API Gateway — routes configuration here]*

### 3.4 API Documentation (Swagger / OpenAPI)

Every microservice exposes interactive Swagger UI at `/docs` and the raw OpenAPI JSON spec at `/docs/json`.

| Service | Local URL |
|---------|----------|
| identity-service | `http://localhost:3001/docs` |
| flight-service | `http://localhost:3002/docs` |
| booking-service | `http://localhost:3003/docs` |
| payment-service | `http://localhost:3004/docs` |
| checkin-service | `http://localhost:3005/docs` |
| baggage-service | `http://localhost:3006/docs` |
| notification-service | `http://localhost:3007/docs` |

Implementation uses `@nestjs/swagger` with the CLI plugin enabled, which auto-generates DTO documentation from TypeScript types and `class-validator` decorators. Controllers are tagged with `@ApiTags` and protected routes annotated with `@ApiBearerAuth`.

The JSON specs can be imported directly into **Postman** for collection-based API testing.

> **📸 Screenshot Placeholder:** *[Insert Swagger UI — full page with endpoints expanded here]*

> **📸 Screenshot Placeholder:** *[Insert Postman — imported collection here]*

### 3.5 Secure Service-to-Service Communication

Services do not call each other's REST APIs directly. All inter-service communication flows through Kafka, providing:

| Property | Benefit |
|----------|--------|
| Temporal decoupling | Producer and consumer need not be online simultaneously |
| Guaranteed delivery | Kafka retains messages for 7 days; consumers resume from last offset |
| SASL/IAM authentication | Each pod authenticates to MSK using its IRSA role — no shared passwords |
| TLS encryption | All broker-to-broker and client-to-broker traffic encrypted |

The only synchronous cross-service call is checkin-service → Lambda QR (via AWS SDK, authenticated through IRSA). This is protected by a circuit breaker with a text-only boarding pass fallback.

---

## 4. Data Security, Compliance and Consistency

### 4.1 Authentication and Authorisation

**Authentication** uses AWS Cognito User Pool with OAuth 2.0:

| Token | Validity | Storage |
|-------|----------|---------|
| Access Token | 60 minutes | Browser memory (Zustand) |
| Refresh Token | 30 days | Browser memory (Zustand) |

The login flow:
1. User submits credentials to `POST /auth/login`
2. identity-service calls Cognito `AdminInitiateAuth`
3. Cognito returns JWT tokens
4. Frontend stores tokens in Zustand state (not localStorage — reduces XSS risk)
5. Subsequent requests include `Authorization: Bearer {token}`
6. API Gateway validates the JWT signature, expiry, and audience before forwarding

**Authorisation** implements RBAC with 9 roles enforced at two levels:

| Level | Mechanism |
|-------|----------|
| API Gateway | JWT claim `custom:roles` checked by Cognito JWT Authorizer |
| Service layer | `@Roles()` decorator + `RolesGuard` in NestJS |

**Roles:** `PASSENGER`, `GATE_AGENT`, `CHECK_IN_STAFF`, `BAGGAGE_HANDLER`, `FLIGHT_OPS`, `FLIGHT_ATTENDANT`, `AIRCRAFT_CREW`, `IMMIGRATION_OFFICER`, `ADMIN`

Own-record enforcement (e.g., a passenger can only view their own bookings) is implemented at the service layer by comparing `user.sub` against the resource owner ID.

> **📸 Screenshot Placeholder:** *[Insert AWS Cognito — User Pool settings here]*

> **📸 Screenshot Placeholder:** *[Insert RBAC permission matrix or Swagger auth flow here]*

### 4.2 Encryption

**At Rest** — AWS KMS with three Customer Managed Keys separated by data classification:

| KMS Key | Purpose | Protects |
|---------|---------|---------|
| `cmk-pci` | Payment card data | Aurora `payment_db`, Stripe secrets |
| `cmk-pii` | Personal identifiable information | Aurora (other DBs), DynamoDB, Redis, MSK |
| `cmk-infra` | Infrastructure data | S3, CloudTrail, EBS, Secrets Manager |

All keys have annual automatic rotation enabled.

**In Transit** — TLS across all connections:

| Connection | Protocol |
|-----------|----------|
| Browser → CloudFront | TLS 1.3 |
| Browser → API Gateway | TLS 1.2 |
| Service → Aurora | TLS 1.2 |
| Service → Redis | TLS 1.2 |
| Service → MSK Kafka | TLS 1.2 + SASL/IAM |
| Service → Secrets Manager | TLS 1.2 (AWS SDK) |

**Secrets Management:**
- All secrets stored in AWS Secrets Manager (not environment variables or code)
- Injected into pods via External Secrets Operator, which syncs Secrets Manager values into Kubernetes Secrets
- IRSA ensures each service can only access its own secrets

> **📸 Screenshot Placeholder:** *[Insert AWS KMS — key list here]*

> **📸 Screenshot Placeholder:** *[Insert AWS Secrets Manager — secrets list here]*

### 4.3 Compliance Considerations

**PCI DSS:**

AeroLink never stores, processes, or transmits full card numbers. Stripe.js tokenises card details on the client side. The server receives only a token (`tok_xxx`) and stores only the last 4 digits and charge ID, encrypted with `cmk-pci`.

| PCI Requirement | Implementation |
|----------------|---------------|
| Never store PAN/CVV | Stripe.js tokenisation on client |
| Encrypt cardholder data | KMS `cmk-pci` for `payment_db` |
| Restrict access | IRSA — only payment-service can decrypt with `cmk-pci` |
| Audit all access | CloudTrail logs all KMS decrypt operations |

**GDPR:**

| Right | Implementation |
|-------|---------------|
| Right to Access | `GET /users/{id}` returns all stored personal data |
| Right to Erasure | **Cryptographic shredding** — each user's PII is encrypted with a unique data key; deleting the key renders all data permanently unreadable |
| Right to Portability | `GET /users/{id}/export` — JSON export |

**Additional Security Layers:**
- WAF v2 on API Gateway and CloudFront (SQL injection, XSS, rate limiting)
- GuardDuty for continuous threat detection (EKS audit logs, S3 data events, malware scanning)
- CloudTrail with 7-year Glacier archival for audit compliance
- Container hardening (non-root, read-only FS, dropped capabilities)

**Figure 4.1 — Security Defense-in-Depth Layers**

![AeroLink Security Defense-in-Depth](C:/Users/hanaa/.gemini/antigravity-ide/brain/bae818b8-527f-48ac-b120-cc578241c043/security_layers_diagram_1780653382819.png)

> **📸 Screenshot Placeholder:** *[Insert AWS WAF — rules overview here]*

> **📸 Screenshot Placeholder:** *[Insert AWS GuardDuty — findings dashboard here]*

---

## 5. Real-Time Data Synchronisation

### 5.1 WebSocket Implementation

AeroLink uses the AWS API Gateway WebSocket API for real-time push communication. When a domain event occurs (e.g., seat locked, baggage scanned), the relevant service publishes to Kafka, and the WebSocket gateway pushes the update to connected clients.

**Connection Flow:**
1. Client opens WSS connection to the WebSocket API endpoint
2. API Gateway validates the JWT token on `$connect`
3. Connection ID is stored (mapped to user ID)
4. Events are pushed to the client as they occur
5. Client automatically reconnects on disconnection with exponential backoff

### 5.2 Live Seat Availability

The flight-service implements **CQRS (Command Query Responsibility Segregation)** for the seat map:

| Model | Storage | Purpose |
|-------|---------|---------|
| **Write model** | Aurora PostgreSQL | Source of truth for seat status |
| **Read model** | Redis | Denormalised seat map for <5ms reads |

When a seat is locked or released:
1. flight-service writes to PostgreSQL
2. Publishes `seat-lock.confirmed` / `seat.availability-updated` to Kafka
3. Kafka consumer updates the Redis projection
4. WebSocket gateway pushes the change to all clients viewing that flight's seat map

**Consistency window:** ~100–200ms between write and Redis projection update. The seat-lock itself uses `Redis SET NX` (atomic compare-and-swap), so even if a stale read shows a seat as available, the lock operation will fail atomically — preventing double-booking.

> **📸 Screenshot Placeholder:** *[Insert WebUI — seat map with real-time status here]*

### 5.3 Live Baggage Tracking

The baggage-service implements a 7-state finite state machine:

```
TAGGED → CHECKED_IN → LOADED → IN_TRANSIT → ARRIVED → DELIVERED
                                                    ↘ MISSING
```

Each state transition:
1. Validated against allowed transitions (e.g., cannot go from `TAGGED` to `ARRIVED`)
2. Written to DynamoDB with a conditional expression
3. Published as `baggage.status-updated` to Kafka
4. notification-service sends an SMS/email to the passenger
5. WebSocket pushes the update to the passenger's baggage tracker UI

> **📸 Screenshot Placeholder:** *[Insert WebUI — baggage tracking page here]*

### 5.4 Event-Driven Synchronisation

All real-time features are driven by Kafka events rather than polling:

| Feature | Trigger Event | Consumer |
|---------|--------------|---------|
| Seat map update | `seat.availability-updated` | WebSocket gateway → browser |
| Booking status | `booking.confirmed` / `booking.cancelled` | WebSocket → passenger |
| Baggage tracking | `baggage.status-updated` | notification-service → SMS/email |
| Flight status | `flight.status-changed` | notification-service + WebSocket |

This ensures consistency: the same event that updates the database also triggers the notification, eliminating the risk of the UI showing stale data while the backend has moved on.

---

## 6. Fault Tolerance and Resilience

### 6.1 Circuit Breaker Pattern

AeroLink implements the circuit breaker pattern in `@aerolink/common-middleware` to prevent cascading failures:

**State Machine:**

| State | Behaviour |
|-------|----------|
| **CLOSED** | Requests pass through; failures counted |
| **OPEN** | Requests fail immediately (no downstream call); cooldown timer running |
| **HALF_OPEN** | Limited test requests allowed; if successful → CLOSED, if failed → OPEN |

**Per-service configuration:**

| Service | Downstream | Threshold | Cooldown | Fallback |
|---------|-----------|-----------|----------|----------|
| payment-service | Stripe API | 3 failures | 60s | Queue for retry, return 503 |
| checkin-service | Lambda QR | 5 failures | 30s | Text-only boarding pass |
| notification-service | AWS SES | 5 failures | 120s | Log notification, retry later |
| notification-service | AWS SNS | 5 failures | 120s | Log notification, retry later |

**Impact:** Without circuit breakers, a Stripe outage would cause 30-second timeouts cascading through payment → booking → API Gateway. With circuit breakers, the failure is detected in <1ms, and the user sees "try again later" within 100ms.

**Retry Policy** works alongside the circuit breaker:
- Max retries: 3
- Backoff: exponential (`1s × 2^attempt + 20% jitter`)
- Max delay cap: 30 seconds
- Non-retryable errors (validation, duplicates) skip retries entirely

> **📸 Screenshot Placeholder:** *[Insert circuit breaker state diagram or admin health endpoint showing CB status here]*

### 6.2 Saga Pattern and Compensating Transactions

The booking flow is a distributed transaction spanning 4 services. Since traditional ACID transactions cannot span service boundaries, AeroLink uses a **choreography-based Saga pattern** with compensating transactions for rollback.

**Happy Path:**

| Step | Service | Action | Event Published |
|------|---------|--------|----------------|
| 1 | booking | Create booking (PENDING) | `booking.created` |
| 2 | flight | Lock seat via Redis `SET NX` | `seat-lock.confirmed` |
| 3 | booking | Update to AWAITING_PAYMENT | `booking.payment-initiated` |
| 4 | payment | Charge via Stripe | `payment.completed` |
| 5 | booking | Update to CONFIRMED | `booking.confirmed` |
| 6 | checkin | Create check-in eligibility | — |
| 7 | notification | Send confirmation email | — |

**Compensation Path — Payment Failure:**

| Step | Action |
|------|--------|
| 1 | payment-service publishes `payment.failed` |
| 2 | booking-service transitions to COMPENSATING |
| 3 | booking-service publishes `booking.seat-released` |
| 4 | flight-service releases the Redis seat lock |
| 5 | booking-service transitions to CANCELLED |
| 6 | notification-service sends failure email |

**Compensation Path — Seat Lock Failure:**

| Step | Action |
|------|--------|
| 1 | flight-service publishes `seat-lock.failed` |
| 2 | booking-service transitions directly to CANCELLED |
| 3 | notification-service sends "seat unavailable" email |

**Why choreography over orchestration:**
- No single point of failure (no orchestrator service)
- Lower coupling — services react to events, not direct commands
- Independent scaling and deployment
- Adding a new step (e.g., loyalty points) requires only subscribing to `booking.confirmed`

**Traceability:** Every event carries a `correlationId` and the booking-service maintains a `sagaHistory` JSON array recording each step, timestamp, and outcome.

**Figure 6.1 — Booking Saga Sequence Diagram (Choreography Pattern)**

![AeroLink Booking Saga Flow](C:/Users/hanaa/.gemini/antigravity-ide/brain/bae818b8-527f-48ac-b120-cc578241c043/booking_saga_flow_1780653298780.png)

### 6.3 Auto-Scaling and Load Balancing

**Pod-level scaling:**

| Service | Trigger | Min → Max Pods |
|---------|---------|---------------|
| identity, flight, booking, checkin | CPU > 70% (HPA) | 2 → 6 |
| payment | CPU > 70% (HPA) | 2 → 4 |
| baggage, notification | Kafka lag (KEDA) | 2 → 6 |
| webui | CPU > 70% (HPA) | 2 → 4 |

**Node-level scaling:**
Cluster Autoscaler monitors pending pods and provisions additional Spot instances (2 → 6 nodes).

**Load Balancing:**
- External: Application Load Balancer distributes traffic across service pods
- Internal: Kubernetes Service (ClusterIP) provides round-robin across pod replicas

### 6.4 High Availability and Disaster Recovery

**Single AZ failure recovery:**
All components auto-failover to the surviving AZ. Total recovery: < 5 minutes.

**Complete region failure:**
Terraform IaC enables re-deployment to a different region:
1. Update `aws_region` in `terraform.tfvars`
2. `terraform apply` — creates entire infrastructure (~25 minutes)
3. Restore data from cross-region backups
4. ArgoCD syncs services automatically

**Backup Strategy:**

| Component | Frequency | Retention |
|-----------|-----------|-----------|
| Aurora | Daily snapshot + continuous PITR | 35 days |
| ElastiCache | Daily snapshot | 7 days |
| DynamoDB | Continuous PITR | 35 days |
| MSK | Log retention | 7 days |
| CloudTrail | Continuous | 7 years (Glacier) |
| Terraform state | On change (S3 versioning) | 30 days |

> **📸 Screenshot Placeholder:** *[Insert AWS EKS — cluster nodes / pods here]*

**Figure 6.2 — AWS VPC Infrastructure (Multi-AZ)**

![AeroLink AWS VPC Infrastructure](C:/Users/hanaa/.gemini/antigravity-ide/brain/bae818b8-527f-48ac-b120-cc578241c043/aws_infrastructure_diagram_1780653354221.png)

---

## 7. Performance and Scalability Testing

### 7.1 Load Testing

Load tests are written using **k6** and cover the full booking flow: register → login → search flights → create booking → check status.

**Test Configuration:**

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| Smoke | 5 | 30 seconds | Baseline validation |
| Load | 0 → 50 → 0 | 9 minutes | Normal traffic simulation |
| Stress | 0 → 200 → 0 | 9 minutes | Find breaking point |
| Spike | 10 → 200 (instant) → 10 | 2.5 minutes | Flash-sale simulation |

**Thresholds:**
- p99 latency < 3,000ms
- p95 latency < 1,500ms
- Error rate < 1%
- Check pass rate > 95%

> **📸 Screenshot Placeholder:** *[Insert k6 terminal output — load test results here]*

> **📸 Screenshot Placeholder:** *[Insert k6 results summary table here]*

### 7.2 Results Analysis

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Request rate (RPS) | > 100 | *[Insert result]* | ⬜ |
| p50 latency | < 200ms | *[Insert result]* | ⬜ |
| p95 latency | < 1,000ms | *[Insert result]* | ⬜ |
| p99 latency | < 2,000ms | *[Insert result]* | ⬜ |
| Error rate | < 1% | *[Insert result]* | ⬜ |

**Per-Endpoint Breakdown:**

| Endpoint | p50 | p95 | RPS | Error % |
|----------|-----|-----|-----|---------|
| `POST /auth/register` | *[Insert]* | *[Insert]* | *[Insert]* | *[Insert]* |
| `POST /auth/login` | *[Insert]* | *[Insert]* | *[Insert]* | *[Insert]* |
| `GET /flights` | *[Insert]* | *[Insert]* | *[Insert]* | *[Insert]* |
| `POST /bookings` | *[Insert]* | *[Insert]* | *[Insert]* | *[Insert]* |
| `GET /bookings/:id` | *[Insert]* | *[Insert]* | *[Insert]* | *[Insert]* |

> **📸 Screenshot Placeholder:** *[Insert performance results chart/graph here]*

### 7.3 Stress Testing Discussion

The stress test ramps from 0 to 200 concurrent users to identify the system's breaking point. Key observations:

- **Expected bottleneck:** Aurora PostgreSQL connection pool (booking and payment services)
- **Kafka behaviour under load:** Consumer lag increases proportionally; KEDA scales notification/baggage consumers
- **Redis performance:** Seat map reads remain < 5ms even under stress due to in-memory nature
- **Circuit breaker activation:** Expected to trip if downstream services (Stripe, SES) cannot keep pace

### 7.4 Performance Improvements

Based on analysis, the following optimisations are implemented or recommended:

| Category | Improvement |
|----------|------------|
| **Database** | Read replicas for search queries; PgBouncer connection pooling; indexes on `passengerId`, `departureDate` |
| **Caching** | Redis cache for flight search (5-min TTL); seat map cache (30s TTL, Kafka-invalidated); CloudFront for static assets (7-day TTL) |
| **Kafka** | Batch producing; tuned `max.poll.records=500` and `fetch.min.bytes=1024` |
| **Application** | Paginated list endpoints (default 20, max 100); Brotli/gzip compression; circuit breakers for fail-fast |

---

## 8. Monitoring and Observability

### 8.1 AWS CloudWatch Integration

| Layer | Tool | Configuration |
|-------|------|--------------|
| **Logs** | Fluent Bit → CloudWatch Logs | Log groups: `/aws/aerolink/dev/*` |
| **Metrics** | CloudWatch Container Insights | EKS pod/node CPU, memory, network |
| **Dashboards** | CloudWatch Dashboard | Custom JSON definition in `infrastructure/observability/` |
| **Alarms** | CloudWatch → SNS → Email | Configured via Terraform |

**CloudWatch Alarms:**

| Alarm | Threshold | Action |
|-------|-----------|--------|
| API Gateway 5xx errors | > 10 in 2 minutes | SNS → email |
| API Gateway p99 latency | > 3 seconds | SNS → email |
| Aurora CPU utilization | > 80% for 3 minutes | SNS → email |
| Aurora free storage | < 5 GB | SNS → email |
| Redis memory usage | > 80% | SNS → email |
| Kafka consumer lag | > 1,000 messages | SNS → email |
| Lambda QR errors | > 5 in 1 minute | SNS → email |

All alarms are defined as Terraform resources (`cloudwatch-alarms.tf`), ensuring they are version-controlled and reproducible.

> **📸 Screenshot Placeholder:** *[Insert CloudWatch Dashboard — metrics overview here]*

> **📸 Screenshot Placeholder:** *[Insert CloudWatch Alarms — list view here]*

### 8.2 Health Check Endpoints

Every service exposes two health endpoints:

| Endpoint | Purpose | Kubernetes Probe |
|----------|---------|-----------------|
| `/api/v1/health/live` | Process is running | Liveness probe (15s initial delay) |
| `/api/v1/health/ready` | Can accept traffic (DB + Kafka connected) | Readiness probe (20s initial delay) |

If the liveness probe fails, Kubernetes restarts the pod. If the readiness probe fails, the pod is removed from the Service load balancer but not restarted, allowing it time to reconnect to dependencies.

> **📸 Screenshot Placeholder:** *[Insert health check endpoint response JSON here]*

### 8.3 Application Logging

Structured JSON logging is implemented via `RequestLoggerInterceptor` from `@aerolink/common-middleware`:

Each log entry includes:
- `timestamp` — ISO 8601
- `level` — INFO, WARN, ERROR
- `correlationId` — traces the request across services
- `service` — originating service name
- `method` + `path` — HTTP method and route
- `statusCode` — response code
- `duration` — request duration in ms

Logs are shipped by Fluent Bit (deployed as a DaemonSet on EKS) to CloudWatch Logs, where they can be queried with CloudWatch Logs Insights.

### 8.4 Distributed Tracing

**OpenTelemetry → AWS X-Ray** provides distributed tracing across the full request lifecycle:

- `initTracing()` in `@aerolink/common-middleware` initialises the OpenTelemetry NodeSDK
- Auto-instrumentation patches: HTTP, Fastify, KafkaJS, `pg` (PostgreSQL), AWS SDK
- Traces are exported via OTLP/HTTP to an in-cluster OpenTelemetry Collector, which forwards to X-Ray
- X-Ray ID generator and propagator ensure compatibility with AWS trace format
- Controlled by `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_TRACES_ENABLED` environment variables

This allows tracing a single booking request as it flows through API Gateway → booking-service → Kafka → flight-service → payment-service → notification-service, with latency breakdown for each hop.

> **📸 Screenshot Placeholder:** *[Insert AWS X-Ray — service map here]*

> **📸 Screenshot Placeholder:** *[Insert AWS X-Ray — trace detail for a booking request here]*

---

## 9. Testing Strategy

### 9.1 Unit Testing

Unit tests use **Jest** with mocked dependencies (Prisma, Kafka, Redis, AWS SDK):

| Service | Test File | Coverage Areas |
|---------|----------|---------------|
| identity-service | `auth.service.spec.ts` | Registration, login, JWT generation, password hashing |
| booking-service | `bookings.service.spec.ts` | Saga start, idempotency, ownership, cancellation/compensation |
| payment-service | `payments.service.spec.ts` | Stripe charge, PCI last-4 storage, idempotency, refund |
| checkin-service | `checkin.service.spec.ts` | Boarding pass issuance, duplicate check-in prevention, board FSM |
| baggage-service | `baggage.service.spec.ts` | 7-state FSM valid/invalid/terminal transitions |
| notification-service | `notifications.service.spec.ts` | SES/SNS routing, DynamoDB persistence |
| flight-service | `seats.service.spec.ts` | Distributed seat lock (Redis SET NX race), release, cache |

**Running tests:**
```bash
npx turbo run test              # All services
npx turbo run test:cov          # With coverage report
npx turbo run test --filter=booking-service  # Single service
```

> **📸 Screenshot Placeholder:** *[Insert terminal — Jest test results with pass/fail summary here]*

### 9.2 Integration Testing

The integration test suite (`tests/integration/booking-saga.test.ts`) validates the end-to-end saga flow against real Docker infrastructure:

1. Start Docker Compose (Postgres, Kafka, Redis)
2. Create a booking via REST
3. Verify Kafka events are produced in correct order
4. Verify saga state transitions: `PENDING → SEAT_LOCKED → AWAITING_PAYMENT → CONFIRMED`
5. Verify compensation path: simulate payment failure → verify seat release

```bash
docker compose up -d
cd tests/integration && npm test
```

> **📸 Screenshot Placeholder:** *[Insert terminal — integration test results here]*

### 9.3 API Testing (Swagger / Postman)

Each service's Swagger UI enables interactive testing. Additionally, OpenAPI specs are importable into Postman.

**Testing Scenarios:**

| Scenario | Steps |
|----------|-------|
| Happy path booking | Register → Login → Search flights → Book → Poll status → Check-in → Get boarding pass |
| Payment failure | Book with Stripe test card `4000000000000002` → Verify CANCELLED status |
| Seat conflict | User A books seat 1A → User B books same seat → Verify B receives `seat-lock.failed` |
| RBAC enforcement | Login as PASSENGER → Attempt admin endpoint → Verify 403 |

**Stripe Test Cards:**

| Card Number | Scenario |
|-------------|----------|
| `4242424242424242` | Successful payment |
| `4000000000000002` | Card declined |
| `4000000000009995` | Insufficient funds |

> **📸 Screenshot Placeholder:** *[Insert Postman — test run results here]*

### 9.4 Performance Testing

Covered in detail in [Section 7](#7-performance-and-scalability-testing). k6 scripts are located in `tests/load/`:

| Script | Purpose |
|--------|---------|
| `booking-flow.js` | Full booking lifecycle (smoke + load + stress) |
| `stress-test.js` | Ramping to 500 VUs |
| `spike-test.js` | Instant 200 VU spike |
| `baggage-scan.js` | Baggage scan throughput |

### 9.5 Test Summary

| Test Type | Tool | Count | Coverage |
|-----------|------|-------|----------|
| Unit tests | Jest | 7 services | Core business logic, saga, FSM, payment |
| Integration tests | Jest + Docker | 1 suite | End-to-end saga flow |
| API tests | Swagger + Postman | 4 scenarios | Happy path, failure, conflict, RBAC |
| Load tests | k6 | 4 scripts | Smoke, load, stress, spike |
| Type checking | TypeScript (`tsc --noEmit`) | All services + WebUI | Compile-time safety |
| Linting | ESLint | All services | Code quality |

---

## 10. CI/CD Pipeline and GitOps Deployment

### 10.1 Continuous Integration (GitHub Actions)

The CI pipeline is defined in `.github/workflows/service-ci.yml` and triggers on push to `main`/`develop` and pull requests to `main`.

**Pipeline Stages:**

| Stage | Description |
|-------|------------|
| **1. Detect Changes** | `dorny/paths-filter` identifies which services have changed files |
| **2. Lint & Test** | Only changed services are linted and tested (matrix strategy) |
| **3. Build & Push** | Docker images built and pushed to ECR (only on `main` branch) |
| **4. Update Helm Values** | Image tag updated in `values.yaml` and committed back to repo |

**Key design decisions:**
- **Selective builds:** Only changed services are built, reducing CI time from ~20 minutes to ~3 minutes for single-service changes
- **OIDC authentication:** GitHub Actions authenticates to AWS via OIDC (preferred) or static keys (fallback)
- **Image tagging:** Short SHA (`${GITHUB_SHA::8}`) for traceability + `latest` tag for convenience
- **Coverage artifacts:** Test coverage reports uploaded as GitHub Actions artifacts

```yaml
# Selective service detection
- uses: dorny/paths-filter@v3
  with:
    filters: |
      booking-service:
        - 'services/booking-service/**'
        - 'packages/**'
```

**Figure 10.1 — CI/CD Pipeline (GitHub Actions + ArgoCD GitOps)**

![AeroLink CI/CD Pipeline](C:/Users/hanaa/.gemini/antigravity-ide/brain/bae818b8-527f-48ac-b120-cc578241c043/cicd_pipeline_diagram_1780653325789.png)

> **📸 Screenshot Placeholder:** *[Insert GitHub Actions — workflow run with all stages here]*

> **📸 Screenshot Placeholder:** *[Insert GitHub Actions — matrix test results here]*

### 10.2 Continuous Deployment (ArgoCD)

ArgoCD implements **GitOps** — the Git repository is the single source of truth for the desired cluster state.

**How it works:**
1. GitHub Actions builds a new Docker image and updates `values.yaml` with the new tag
2. ArgoCD detects the Git commit (polling or webhook)
3. ArgoCD compares the desired state (Helm chart in Git) with the live state (EKS cluster)
4. If different, ArgoCD automatically syncs: renders Helm → applies Kubernetes manifests

**ApplicationSet Configuration:**
A single `ApplicationSet` manages all 9 applications (7 services + webui + platform-init):

| Feature | Configuration |
|---------|--------------|
| Sync policy | Automated with prune and self-heal |
| Retry | 5 attempts with exponential backoff (5s → 3m) |
| Namespace creation | Automatic |
| HPA conflicts | Ignored via `ignoreDifferences` on `/spec/replicas` |

**Deployment Order (Sync Waves):**
1. Wave -2: Platform secrets (External Secrets)
2. Wave -1: Database bootstrap Job (creates 5 databases)
3. Wave 0: Service deployments (init-containers run `prisma db push`)

> **📸 Screenshot Placeholder:** *[Insert ArgoCD UI — application dashboard here]*

> **📸 Screenshot Placeholder:** *[Insert ArgoCD UI — sync status for services here]*

---

## 11. Challenges and Future Improvements

### 11.1 Challenges Faced

| Challenge | Description | Resolution |
|-----------|------------|------------|
| **Saga debugging complexity** | Choreography makes the flow harder to trace than orchestration | Correlation IDs, saga history array, distributed tracing (X-Ray) |
| **Kafka in local vs AWS** | Local Kafka uses plaintext; MSK requires TLS + SASL/IAM | Shared `createKafka()` factory that switches based on `KAFKA_AUTH` env var |
| **Prisma migration on EKS** | No migration files existed; `prisma migrate deploy` failed | Switched to `prisma db push` in init-containers; separate db-bootstrap Job creates databases |
| **Spot instance interruptions** | EKS Spot nodes can be reclaimed by AWS | PodDisruptionBudgets + multi-AZ node distribution + Cluster Autoscaler rapid replacement |
| **Docker image size** | Initial images were >1 GB | Multi-stage builds with Alpine base reduced to ~200 MB |
| **Cost management** | Dev environment costs ~$12/day | `terraform destroy` script; Spot instances; scheduled scaling |

### 11.2 Future Improvements

| Improvement | Benefit |
|------------|---------|
| **Transactional Outbox Pattern** | Eliminates the risk of lost events when a service crashes between DB write and Kafka publish |
| **Multi-region active-active** | Currently single-region; Terraform IaC supports re-deployment but not active-active replication |
| **GraphQL federation** | Would allow the frontend to query across services in a single request |
| **Service mesh (Istio)** | mTLS between pods, traffic shaping, canary deployments |
| **Automated chaos testing** | Introduce LitmusChaos or Chaos Monkey to validate resilience assumptions |
| **Mobile app** | React Native or Flutter companion app using the same API |

---

## 12. Conclusion and Reflections

AeroLink demonstrates a production-grade cloud-native architecture for the airline domain, applying enterprise patterns to solve real distributed computing challenges:

- **Microservices decomposition** separated the booking, payment, check-in, and baggage domains into independently deployable services, each with its own database and scaling profile.
- **Event-driven choreography** via Kafka eliminated synchronous coupling and enabled the saga pattern for distributed transactions with proper compensating transactions.
- **Infrastructure-as-Code** with Terraform (19 modules, ~60 AWS resources) made the entire environment reproducible in a single `terraform apply`.
- **GitOps with ArgoCD** ensured the cluster state always reflects the Git repository, with automated sync and self-healing.
- **Defense-in-depth security** — from WAF at the edge through JWT validation, RBAC enforcement, KMS encryption, to container hardening — addresses PCI DSS and GDPR requirements.

**Key learning outcomes:**
- Distributed transactions require fundamentally different approaches than monolithic ACID — the Saga pattern with compensation is effective but demands careful state machine design
- Observability (structured logging + distributed tracing + metrics) is not optional in microservices — without it, debugging cross-service issues is impractical
- Infrastructure-as-Code dramatically reduces the "it works on my machine" problem, but Terraform state management and module dependency ordering require careful planning
- Event-driven architectures trade consistency for availability — understanding the CAP theorem trade-offs is essential for making pragmatic design decisions

---

## 13. References

1. Richardson, C. (2018). *Microservices Patterns: With Examples in Java*. Manning Publications.
2. Newman, S. (2021). *Building Microservices: Designing Fine-Grained Systems*. 2nd ed. O'Reilly Media.
3. Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media.
4. Amazon Web Services. (2026). *Amazon EKS User Guide*. Available at: https://docs.aws.amazon.com/eks/
5. Amazon Web Services. (2026). *Amazon MSK Developer Guide*. Available at: https://docs.aws.amazon.com/msk/
6. Amazon Web Services. (2026). *AWS Well-Architected Framework*. Available at: https://docs.aws.amazon.com/wellarchitected/
7. HashiCorp. (2026). *Terraform AWS Provider Documentation*. Available at: https://registry.terraform.io/providers/hashicorp/aws/
8. Argo Project. (2026). *Argo CD - Declarative GitOps CD for Kubernetes*. Available at: https://argo-cd.readthedocs.io/
9. Apache Software Foundation. (2026). *Apache Kafka Documentation*. Available at: https://kafka.apache.org/documentation/
10. NestJS. (2026). *NestJS Documentation*. Available at: https://docs.nestjs.com/
11. Prisma. (2026). *Prisma ORM Documentation*. Available at: https://www.prisma.io/docs/
12. Stripe. (2026). *Stripe API Reference*. Available at: https://stripe.com/docs/api
13. OpenTelemetry. (2026). *OpenTelemetry JavaScript SDK*. Available at: https://opentelemetry.io/docs/instrumentation/js/
14. Grafana Labs. (2026). *k6 Load Testing Tool*. Available at: https://k6.io/docs/
15. Fowler, M. (2014). *Circuit Breaker Pattern*. Available at: https://martinfowler.com/bliki/CircuitBreaker.html
16. Nygard, M. (2018). *Release It! Design and Deploy Production-Ready Software*. 2nd ed. Pragmatic Bookshelf.

---

> **Note:** All screenshot placeholders (`📸 Screenshot Placeholder`) should be replaced with actual screenshots from the AWS Console, terminal outputs, application UI, and testing tools before final submission.
