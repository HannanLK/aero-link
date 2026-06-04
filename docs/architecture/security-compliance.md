# AeroLink — Security & Compliance Architecture

## Encryption Architecture

### Encryption at Rest

All data at rest is encrypted using **AWS KMS Customer Managed Keys (CMKs)** with key separation by data classification:

```mermaid
graph TB
    subgraph "KMS Key Hierarchy"
        CMK_PCI["🔐 cmk-pci<br/>Payment Card Data<br/>Annual Rotation"]
        CMK_PII["🔐 cmk-pii<br/>Personal Data (PII)<br/>Annual Rotation"]
        CMK_INFRA["🔐 cmk-infra<br/>Infrastructure Data<br/>Annual Rotation"]
    end

    subgraph "Data Stores"
        Aurora["Aurora PostgreSQL<br/>(5 databases)"]
        DDB2["DynamoDB<br/>(2 tables)"]
        Redis2["ElastiCache Redis"]
        MSK3["MSK Kafka<br/>(broker storage)"]
        S3["S3 Buckets"]
        SM2["Secrets Manager"]
        CT2["CloudTrail Logs"]
        EBS["EKS Node EBS"]
    end

    CMK_PCI --> Aurora
    CMK_PII --> Aurora & DDB2 & Redis2 & MSK3
    CMK_INFRA --> S3 & SM2 & CT2 & EBS

    style CMK_PCI fill:#dc3545,color:#fff
    style CMK_PII fill:#ffc107,color:#000
    style CMK_INFRA fill:#198754,color:#fff
```

| Data Store | KMS Key | Encryption Type | Algorithm |
|-----------|---------|----------------|-----------|
| Aurora PostgreSQL (payment_db) | cmk-pci | Server-side | AES-256 |
| Aurora PostgreSQL (others) | cmk-pii | Server-side | AES-256 |
| DynamoDB (baggage, notifications) | cmk-pii | Server-side | AES-256 |
| ElastiCache Redis | cmk-pii | Server-side | AES-256 |
| MSK Kafka (broker disk) | cmk-pii | Server-side | AES-256 |
| S3 (CloudFront logs, CloudTrail) | cmk-infra | Server-side | AES-256 |
| EKS Secrets (etcd) | cmk-infra | Envelope encryption | AES-256 |
| Secrets Manager | cmk-pci / cmk-pii | Envelope encryption | AES-256 |

### Encryption in Transit

All network communication uses **TLS 1.2+** (CloudFront uses TLS 1.3):

```mermaid
graph LR
    Browser["🌐 Browser"] -->|"TLS 1.3"| CF3["CloudFront"]
    CF3 -->|"HTTP<br/>(VPC internal)"| ALB3["ALB"]
    ALB3 -->|"HTTP<br/>(pod network)"| Pods["Service Pods"]
    Pods -->|"TLS"| Aurora2["Aurora"]
    Pods -->|"TLS"| Redis3["Redis"]
    Pods -->|"TLS + SASL/IAM"| MSK4["MSK Kafka"]
    Pods -->|"TLS"| SM3["Secrets Manager"]

    Browser -->|"TLS 1.2"| APIGW3["API Gateway"]
    APIGW3 -->|"VPC Link"| ALB3

    style CF3 fill:#ff9900,color:#fff
    style APIGW3 fill:#ff9900,color:#fff
```

| Connection | Protocol | Minimum Version |
|-----------|----------|----------------|
| Browser → CloudFront | TLS | 1.3 |
| Browser → API Gateway | TLS | 1.2 |
| API Gateway → ALB (VPC Link) | HTTP | N/A (VPC internal) |
| ALB → Service Pods | HTTP | N/A (cluster network) |
| Service → Aurora PostgreSQL | TLS | 1.2 |
| Service → ElastiCache Redis | TLS | 1.2 |
| Service → MSK Kafka | TLS + SASL/IAM | 1.2 |
| Service → Secrets Manager | TLS | 1.2 |
| Service → Lambda QR | TLS (AWS SDK) | 1.2 |

## Authentication & Authorisation (OAuth 2.0)

### Authentication Flow

```mermaid
sequenceDiagram
    participant User as User (Browser)
    participant WebUI as WebUI (React)
    participant APIGW4 as API Gateway
    participant IS3 as identity-service
    participant Cognito2 as AWS Cognito

    User->>WebUI: Enter email + password
    WebUI->>APIGW4: POST /api/v1/auth/login
    APIGW4->>IS3: Forward (public route)
    IS3->>Cognito2: AdminInitiateAuth (USER_SRP_AUTH)
    Cognito2-->>IS3: Access Token + Refresh Token + ID Token
    IS3-->>APIGW4: { accessToken, refreshToken, expiresIn }
    APIGW4-->>WebUI: 200 OK + tokens
    WebUI->>WebUI: Store tokens in Zustand (memory)

    Note over WebUI,APIGW4: Subsequent authenticated requests
    WebUI->>APIGW4: GET /api/v1/bookings<br/>Authorization: Bearer {accessToken}
    APIGW4->>APIGW4: JWT Authorizer validates token
    APIGW4->>IS3: Forward + x-user-id + x-user-roles headers
```

### Token Configuration

| Token | Validity | Storage | Rotation |
|-------|----------|---------|----------|
| Access Token | 60 minutes | Memory (Zustand) | Auto-refresh |
| Refresh Token | 30 days | Memory (Zustand) | On use |
| ID Token | 60 minutes | Not stored | Via Cognito |

### RBAC — Role-Based Access Control

AeroLink implements **9 roles** enforced at two levels:

1. **API Gateway level**: JWT claim `custom:roles` checked by Cognito JWT Authorizer
2. **Service level**: `@Roles()` decorator + `RolesGuard` in NestJS

```mermaid
graph TB
    subgraph "Role Hierarchy"
        ADMIN["ADMIN<br/>(Super Admin)"]
        GATE["GATE_AGENT"]
        FLIGHT_OPS["FLIGHT_OPS"]
        FLIGHT_ATT["FLIGHT_ATTENDANT"]
        AIRCRAFT["AIRCRAFT_CREW"]
        IMMIGRATION["IMMIGRATION_OFFICER"]
        CHECKIN["CHECK_IN_STAFF"]
        BAGGAGE["BAGGAGE_HANDLER"]
        PASSENGER["PASSENGER<br/>(Default)"]
    end

    ADMIN -->|"can do everything"| GATE & FLIGHT_OPS & IMMIGRATION & PASSENGER
```

### Permission Matrix

| Resource | PASSENGER | GATE_AGENT | FLIGHT_OPS | IMMIGRATION | ADMIN |
|----------|-----------|------------|------------|-------------|-------|
| Search flights | ✅ | ✅ | ✅ | ✅ | ✅ |
| Book flight | ✅ | ❌ | ❌ | ❌ | ✅ |
| View own bookings | ✅ | ❌ | ❌ | ❌ | ✅ |
| Web check-in | ✅ | ❌ | ❌ | ❌ | ✅ |
| Track own baggage | ✅ | ❌ | ❌ | ❌ | ✅ |
| Board passengers | ❌ | ✅ | ❌ | ❌ | ✅ |
| Update flight status | ❌ | ❌ | ✅ | ❌ | ✅ |
| Immigration clearance | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ✅ |
| View all bookings | ❌ | ❌ | ❌ | ❌ | ✅ |
| Service health | ❌ | ❌ | ❌ | ❌ | ✅ |
| Assign roles | ❌ | ❌ | ❌ | ❌ | ✅ |

## GDPR Compliance

### Data Subject Rights Implementation

| Right | Implementation |
|-------|---------------|
| **Right to Access** | `GET /users/{id}` — returns all stored personal data |
| **Right to Rectification** | `PUT /users/{id}` — update personal data |
| **Right to Erasure** | `DELETE /users/{id}` — cryptographic shredding via KMS |
| **Right to Portability** | `GET /users/{id}/export` — JSON export of all data |
| **Right to Restriction** | `PATCH /users/{id}/restrict` — flag account as restricted |

### Cryptographic Shredding (Right to Erasure)

Instead of deleting data from every service database (which risks missed records in a microservices architecture), AeroLink uses **cryptographic shredding**:

```mermaid
sequenceDiagram
    participant Admin as Admin
    participant IS4 as identity-service
    participant KMS2 as AWS KMS

    Admin->>IS4: DELETE /users/{id}
    IS4->>IS4: Look up user's per-user KMS data key
    IS4->>KMS2: ScheduleKeyDeletion (7-day pending)
    KMS2-->>IS4: Key deletion scheduled
    IS4->>IS4: Mark user as GDPR_DELETED
    IS4-->>Admin: 204 No Content

    Note over KMS2: After 7 days, key is permanently deleted
    Note over IS4: All data encrypted with that key<br/>becomes permanently unreadable
```

**How it works**: Each user's PII is encrypted with a unique data encryption key (DEK) derived from the KMS CMK. When the user requests deletion, we schedule the DEK for deletion. After the 7-day cooling-off period, the key is permanently destroyed and all associated PII becomes cryptographically irrecoverable.

## PCI DSS Compliance

### Cardholder Data Handling

```mermaid
graph LR
    Browser2["Browser"] -->|"Card number<br/>(Stripe.js tokenises)"| StripeJS["Stripe.js<br/>(client-side)"]
    StripeJS -->|"Token (tok_xxx)"| PaySvc["payment-service"]
    PaySvc -->|"Token"| StripeAPI["Stripe API"]
    PaySvc -->|"Last 4 digits only"| AuroraDB["Aurora<br/>payment_db"]

    style StripeJS fill:#635bff,color:#fff
    style StripeAPI fill:#635bff,color:#fff
```

| PCI DSS Requirement | AeroLink Implementation |
|--------------------|------------------------|
| Never store full card number | Stripe.js tokenises on client — server never sees PAN |
| Encrypt cardholder data | KMS CMK (cmk-pci) encrypts payment_db at rest |
| Restrict access to cardholder data | IRSA role for payment-service only — no other service can access cmk-pci |
| Log and monitor all access | CloudTrail logs all KMS decrypt operations |
| Regularly test security | GuardDuty continuous threat detection |
| Maintain security policy | ADR-007 documents security decisions |

### Data Stored vs Not Stored

| Data | Stored? | Where | Encrypted With |
|------|---------|-------|----------------|
| Full card number (PAN) | ❌ Never | — | — |
| Card expiry | ❌ Never | — | — |
| CVV | ❌ Never | — | — |
| Last 4 digits | ✅ | Aurora payment_db | cmk-pci |
| Stripe charge ID | ✅ | Aurora payment_db | cmk-pci |
| Transaction amount | ✅ | Aurora payment_db | cmk-pci |

## Security Layers

```mermaid
graph TB
    subgraph "Layer 1: Edge"
        WAF3["AWS WAF v2<br/>SQL injection, XSS, rate limiting"]
        CF4["CloudFront<br/>TLS 1.3, DDoS protection"]
    end

    subgraph "Layer 2: API"
        APIGW5["API Gateway<br/>JWT validation, throttling (500 rps)"]
        CORS["CORS<br/>Only transnova.online + localhost:5173"]
    end

    subgraph "Layer 3: Application"
        JWT["JWT Auth<br/>Cognito-issued, 60-min expiry"]
        RBAC2["RBAC Guard<br/>9 roles enforced per endpoint"]
        VALID["Input Validation<br/>class-validator + Zod"]
        RATE["Rate Limiting<br/>Per-user throttling"]
    end

    subgraph "Layer 4: Data"
        KMS3["KMS Encryption<br/>3 CMKs: PCI, PII, Infra"]
        SM4["Secrets Manager<br/>No secrets in env vars or code"]
        IAM2["IAM IRSA<br/>Least-privilege per service"]
    end

    subgraph "Layer 5: Audit"
        CT3["CloudTrail<br/>All API calls logged"]
        GD2["GuardDuty<br/>Continuous threat detection"]
        CW2["CloudWatch<br/>Log analysis + alarms"]
    end
```

## Container Security

| Control | Implementation |
|---------|---------------|
| Non-root user | All containers run as UID 1000 |
| Read-only filesystem | `readOnlyRootFilesystem: true` |
| Drop capabilities | `drop: ALL` — no Linux capabilities |
| IMDSv2 only | Instance metadata requires session token |
| Image scanning | ECR image scanning on push |
| Network policy | Kubernetes NetworkPolicy restricts pod-to-pod |

## Threat Detection (GuardDuty)

Amazon GuardDuty is enabled for continuous monitoring:

| Detection Type | What It Monitors |
|---------------|-----------------|
| EKS Audit Log Analysis | Suspicious Kubernetes API calls |
| S3 Protection | Unusual data access patterns |
| Malware Protection | Scans EBS volumes for malware |
| Runtime Monitoring | Container-level threat detection |

Findings are forwarded to **SNS → email** for immediate notification.
