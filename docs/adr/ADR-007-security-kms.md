# ADR-007 — Security and Encryption: KMS + Compliance Model

| Field      | Value |
|------------|-------|
| Status     | Accepted |
| Date       | 2026-05-26 |
| Rubric     | Task 3 — Data Security, Compliance (GDPR, PCI-DSS, encryption at rest and in transit) |

## Context

AeroLink processes:
- **PII** — passenger names, email addresses, passport numbers, dates of birth
- **PCI-DSS data** — payment card metadata, transaction records
- **Operational data** — flight schedules, baggage tracking (lower sensitivity)

Regulatory requirements:
- **GDPR** (EU): right to erasure (crypto-shredding), data minimisation, breach notification
- **PCI-DSS v4.0**: cardholder data protection (Req 3), access control (Req 7), audit logging (Req 10), encryption in transit (Req 4)

## Decision

**Three Customer-Managed KMS Keys (CMKs)** with automatic annual rotation, used to encrypt every data store. **TLS 1.2+ everywhere** for encryption in transit.

## KMS Key Architecture

```
AWS KMS
├── aerolink/cmk-pci      ← payment_db, payment service secrets
├── aerolink/cmk-pii      ← identity_db, flight_db, booking_db,
│                            checkin_db, ElastiCache, MSK,
│                            CloudWatch Logs (/aerolink/*/identity|booking|checkin)
└── aerolink/cmk-infra    ← EKS etcd secrets, ECR images,
                             S3 (logs, assets), aurora (baggage schemas),
                             non-PII CloudWatch Logs
```

| CMK | Key Policy | Who can use |
|-----|-----------|-------------|
| `cmk-pci` | IAM role `aerolink-payment-irsa` only | payment-service pod (IRSA) |
| `cmk-pii` | IAM roles for identity, booking, checkin, flight | Per-service IRSA roles |
| `cmk-infra` | EKS node role, ECR, S3 | Infrastructure roles only |

Annual key rotation is enabled on all CMKs. Rotation creates a new backing key while existing encrypted data remains decryptable — transparent to applications.

## GDPR Crypto-Shredding

When a customer exercises the **Right to Erasure** (GDPR Article 17):
1. Identity-service marks the user as `DELETED` and removes PII fields from `identity_db`
2. A `user.deletion-requested` event is published to Kafka
3. booking-service pseudonymises the passenger name in historical bookings (replaces with `DELETED_USER`)
4. **The `cmk-pii` key is NOT rotated** — crypto-shredding is achieved by deleting the specific data, not the key (key deletion would affect all other users encrypted with the same key)
5. For field-level crypto-shredding: passport numbers are encrypted with a **per-user data key** (envelope encryption via KMS `GenerateDataKey`). Deleting the user's data key renders the ciphertext unrecoverable

## PCI-DSS Controls

| PCI-DSS Requirement | AeroLink Control |
|--------------------|-----------------|
| Req 3: Protect stored cardholder data | payment_db encrypted with `cmk-pci`; card numbers stored as last-4 only; full PAN never logged |
| Req 4: Encrypt transmission | TLS 1.2+ on all API Gateway, ALB, MSK, Aurora endpoints |
| Req 7: Restrict access by business need | IRSA: payment-service pod is the only principal with `cmk-pci:Decrypt` permission |
| Req 8: Identify and authenticate access | Cognito + JWT; service account JWTs for service-to-service |
| Req 10: Track and monitor access | CloudTrail logs all KMS API calls; CloudWatch Logs archive; 90-day retention |
| Req 12: Maintain information security policy | This ADR + RBAC matrix constitutes the documented policy |

## Encryption in Transit

| Channel | Mechanism |
|---------|-----------|
| Browser ↔ CloudFront | TLS 1.3 (ACM certificate) |
| CloudFront ↔ ALB | TLS 1.2 (ACM certificate, origin protocol HTTPS only) |
| ALB ↔ EKS pods | TLS 1.2 (cert-manager self-signed, upgraded to ACM in prod) |
| Pod ↔ Aurora PostgreSQL | SSL enforced (`ssl=true` in Prisma connection string) |
| Pod ↔ ElastiCache Redis | TLS enabled on cluster; `rediss://` protocol |
| Pod ↔ MSK Kafka | TLS with IAM authentication (`sasl.mechanism=AWS_MSK_IAM`) |
| Pod ↔ Secrets Manager / SSM | HTTPS via VPC Interface Endpoint |
| Pod ↔ DynamoDB | HTTPS via VPC Gateway Endpoint |

## Secrets Management

```
AWS Secrets Manager
├── /aerolink/dev/identity-service/db-password
├── /aerolink/dev/booking-service/db-password
├── /aerolink/dev/payment-service/db-password  ← encrypted with cmk-pci
├── /aerolink/dev/payment-service/stripe-api-key  ← encrypted with cmk-pci
├── /aerolink/dev/shared/jwt-public-key
└── /aerolink/dev/shared/kafka-brokers

Flow: Secrets Manager → External Secrets Operator → K8s Secret → Pod env var
      (never in git, never in Docker image, never in CI logs)
```

## IAM Least Privilege (IRSA)

Each EKS pod is bound to a Kubernetes ServiceAccount annotated with an IAM role ARN. The IAM role grants only the minimum permissions:

```
payment-service-role:
  kms:Decrypt, kms:GenerateDataKey  → arn:cmk-pci only
  secretsmanager:GetSecretValue     → arn:/aerolink/dev/payment-service/* only
  xray:PutTraceSegments
  logs:CreateLogStream, logs:PutLogEvents

baggage-service-role:
  dynamodb:PutItem, GetItem, UpdateItem, Query  → arn:aerolink-baggage table only
  kms:Decrypt                                   → arn:cmk-pii only
  xray:PutTraceSegments
  logs:CreateLogStream, logs:PutLogEvents
```

No service has `*` actions or `*` resources. Principle of least privilege is demonstrably enforced in Terraform IAM module.

## Consequences

- KMS key ARNs are passed as Terraform outputs and consumed by RDS, ElastiCache, MSK, EKS, and S3 module `var.kms_key_arn`.
- CloudTrail is enabled for all AWS regions with log file integrity validation.
- GuardDuty monitors VPC Flow Logs and CloudTrail for anomalous behaviour.
- WAF blocks OWASP Top 10 patterns at the edge before any application code executes.
