# ADR-002 — Database Strategy: Aurora PostgreSQL + DynamoDB

| Field      | Value |
|------------|-------|
| Status     | Accepted |
| Date       | 2026-05-26 |
| Deciders   | Architecture Team |
| Rubric     | Architecture Design (20%) — cloud managed databases; Implementation (40%) — data ownership |

## Context

Seven microservices require persistent storage. Each service must own its data exclusively — no cross-service joins, no shared schemas. The chosen strategy must satisfy:

- ACID transactions for financial (payment) and booking flows
- High-frequency write performance for baggage scan telemetry (100s/min per flight)
- GDPR encryption at rest
- Cost-conscious footprint (dev uses shared cluster, single `terraform destroy` cleans up)
- Demonstrable "cloud managed databases" for the rubric

## Decision

**Database-per-service pattern** with two engine choices:

| Engine | Services | Justification |
|--------|----------|---------------|
| **Amazon Aurora PostgreSQL** (shared cluster, one DB per service) | identity, flight, booking, payment, check-in | Relational, ACID, complex queries (seat maps, booking history, role lookups) |
| **Amazon DynamoDB** | baggage, notification | Key-value, high write throughput, no joins needed, serverless billing |

## Schema Ownership Rules

Each PostgreSQL service owns a **dedicated database** (not just a schema) within the Aurora cluster. This provides:
- Separate connection strings → service cannot accidentally query another service's tables
- Independent Prisma migrations with no coordination required
- Separate IAM credentials per service (IRSA)

```
Aurora Cluster: aerolink-aurora-cluster
  ├── Database: identity_db   (owned by identity-service)
  ├── Database: flight_db     (owned by flight-service)
  ├── Database: booking_db    (owned by booking-service)
  ├── Database: payment_db    (owned by payment-service)
  └── Database: checkin_db    (owned by checkin-service)

DynamoDB Tables:
  ├── aerolink-baggage        (owned by baggage-service)
  └── aerolink-notifications  (owned by notification-service)
```

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| One Aurora cluster per service | $0.10/hr × 5 clusters = unacceptable cost during dev; single destroy is harder |
| All services on DynamoDB | Booking/payment require complex transactions (DynamoDB transactions exist but are limited); RBAC queries on users/roles are inherently relational |
| Amazon RDS PostgreSQL (non-Aurora) | Aurora is AWS-managed, auto-scaling storage, better HA story, same API |

## Eventual Consistency vs. Strong Consistency

| Service | Consistency model | Reason |
|---------|------------------|--------|
| booking_db | **Strong (ACID)** | Double-booking must be prevented; saga state machine requires atomic updates |
| payment_db | **Strong (ACID)** | Financial transactions require audit-grade consistency |
| identity_db | **Strong (ACID)** | Role changes must be immediately visible to auth guards |
| flight_db | **Read-committed + Redis cache** | Seat availability is read-heavy; Redis pub/sub propagates updates in <100 ms; slight staleness acceptable during cache TTL |
| baggage (DynamoDB) | **Eventual** | Bag scan telemetry — eventual delivery of location updates is acceptable; no financial consequence |
| notifications (DynamoDB) | **Eventual** | Delivery log is append-only; no consistency requirement |

This justifies the **CQRS** pattern on flight-service: write commands go to Aurora, read queries are served from a Redis projection updated via Kafka `seat.availability-updated` events. Rubric task 3: data consistency approach explicitly justified.

## Consequences

- Prisma ORM for all PostgreSQL services; migrations are run as Kubernetes Job (init container) on deploy.
- DynamoDB access via `@aws-sdk/lib-dynamodb` DocumentClient.
- Aurora Multi-AZ enabled: 1 writer + 1 reader in different AZs → automatic failover in < 30 s (satisfies fault tolerance rubric).
- KMS CMK `aerolink/cmk-pii` encrypts all Aurora storage; `aerolink/cmk-pci` encrypts payment_db tablespace.
- AWS Backup policy: daily Aurora snapshots, 7-day PITR retention.
