# AeroLink — High-Level System Architecture

## System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["🌐 Browser / Mobile"]
    end

    subgraph "Edge Layer (AWS)"
        CF["☁️ CloudFront CDN<br/>TLS 1.3 + WAF"]
        APIGW["🔌 API Gateway (HTTP)<br/>JWT Auth + Rate Limiting"]
        WSGW["📡 WebSocket Gateway<br/>Real-time Events"]
    end

    subgraph "DNS & Certificates"
        R53["📌 Route 53<br/>transnova.online"]
        ACM["🔒 ACM Certificates<br/>*.transnova.online"]
    end

    subgraph "Compute Layer — EKS Cluster"
        ALB["⚖️ Application Load Balancer"]
        
        subgraph "Service Mesh (Kubernetes Pods)"
            IS["👤 identity-service<br/>Auth + RBAC"]
            FS["✈️ flight-service<br/>Flights + CQRS Seats"]
            BS["📋 booking-service<br/>Saga Orchestration"]
            PS["💳 payment-service<br/>Stripe + PCI"]
            CS["✅ checkin-service<br/>Boarding Pass + QR"]
            BgS["🧳 baggage-service<br/>7-State FSM"]
            NS["📧 notification-service<br/>SES + SNS"]
            WUI["🖥️ webui<br/>React 19 + Vite"]
        end

        subgraph "Platform Components"
            ARGO["🔄 Argo CD<br/>GitOps Sync"]
            ESO["🔑 External Secrets<br/>Operator"]
            FB["📋 Fluent Bit<br/>Log Shipping"]
            OTEL["📊 OpenTelemetry<br/>Distributed Tracing"]
            CA["📈 Cluster Autoscaler"]
            KEDA["⚡ KEDA<br/>Event-Driven Scaling"]
            MS["📏 Metrics Server"]
        end
    end

    subgraph "Data Layer"
        Aurora["🐘 Aurora PostgreSQL<br/>Multi-AZ (Writer + Reader)<br/>5 Databases"]
        Redis["⚡ ElastiCache Redis<br/>Multi-AZ<br/>CQRS Read Model + Session Cache"]
        DDB["📦 DynamoDB<br/>Baggage + Notifications"]
        MSK["📨 Amazon MSK (Kafka)<br/>3 Brokers, 15 Topics<br/>TLS + SASL/IAM"]
    end

    subgraph "Serverless"
        Lambda["⚡ Lambda QR<br/>QR Code + Barcode Generator"]
    end

    subgraph "Security & Compliance"
        KMS["🔐 KMS<br/>3 CMKs: PCI, PII, Infra"]
        SM["🗝️ Secrets Manager<br/>DB URLs, JWT, Stripe"]
        Cognito["👥 Cognito<br/>User Pool + OAuth 2.0"]
        WAF2["🛡️ WAF v2<br/>Managed Rules"]
        GD["🔍 GuardDuty<br/>Threat Detection"]
        CT["📜 CloudTrail<br/>Audit Logging"]
    end

    subgraph "Observability"
        CW["📊 CloudWatch<br/>Logs + Metrics + Alarms"]
        XRAY["🔎 X-Ray<br/>Distributed Traces"]
        SNS2["📬 SNS<br/>Alert Notifications"]
    end

    Browser -->|"HTTPS"| CF
    Browser -->|"WSS"| WSGW
    CF -->|"Origin"| ALB
    CF -.->|"DNS"| R53
    APIGW -->|"VPC Link"| ALB
    WSGW -->|"VPC Link"| ALB

    ALB --> IS & FS & BS & PS & CS & BgS & NS & WUI

    IS --> Aurora
    IS --> Cognito
    FS --> Aurora & Redis
    BS --> Aurora
    PS --> Aurora
    CS --> Aurora & Lambda
    BgS --> DDB
    NS --> DDB

    IS & FS & BS & PS & CS & BgS & NS <-->|"Kafka Events"| MSK

    ESO --> SM
    SM --> KMS

    FB --> CW
    OTEL --> XRAY
    CW --> SNS2

    style CF fill:#ff9900,color:#fff
    style APIGW fill:#ff9900,color:#fff
    style ALB fill:#ff9900,color:#fff
    style Aurora fill:#3b48cc,color:#fff
    style Redis fill:#dc382d,color:#fff
    style MSK fill:#ff9900,color:#fff
    style Lambda fill:#ff9900,color:#fff
    style KMS fill:#dd3333,color:#fff
    style Cognito fill:#ff9900,color:#fff
```

## AWS Infrastructure Diagram

```mermaid
graph TB
    subgraph "AWS Account 432004895948 — us-east-1"
        subgraph "VPC 10.0.0.0/16"
            subgraph "Public Subnets"
                PS1["10.0.1.0/24<br/>us-east-1a"]
                PS2["10.0.2.0/24<br/>us-east-1b"]
                NAT1["NAT Gateway"]
                NAT2["NAT Gateway"]
            end
            subgraph "Private Subnets (EKS Nodes)"
                PRS1["10.0.10.0/24<br/>us-east-1a"]
                PRS2["10.0.11.0/24<br/>us-east-1b"]
                EKS["EKS Cluster<br/>2-6 t3.medium Spot Nodes"]
            end
            subgraph "Database Subnets (Isolated)"
                DBS1["10.0.20.0/24<br/>us-east-1a"]
                DBS2["10.0.21.0/24<br/>us-east-1b"]
                RDS["Aurora PostgreSQL<br/>Writer + Reader"]
                REDIS2["ElastiCache Redis<br/>Primary + Replica"]
                MSK2["MSK Kafka<br/>3 Brokers"]
            end
        end

        IGW["Internet Gateway"]
        ALB2["Application<br/>Load Balancer"]
        CF2["CloudFront<br/>Distribution"]
        APIGW2["API Gateway<br/>HTTP + WebSocket"]
    end

    Internet["🌐 Internet"] --> IGW --> PS1 & PS2
    Internet --> CF2 --> ALB2
    Internet --> APIGW2 -->|"VPC Link"| PRS1 & PRS2
    PS1 & PS2 --> ALB2
    NAT1 --> IGW
    NAT2 --> IGW
    PRS1 --> NAT1
    PRS2 --> NAT2
    EKS --> RDS & REDIS2 & MSK2

    style EKS fill:#ff9900,color:#fff
    style RDS fill:#3b48cc,color:#fff
    style REDIS2 fill:#dc382d,color:#fff
    style MSK2 fill:#ff9900,color:#fff
```

## Network Security Groups

| Security Group | Inbound | Source | Purpose |
|---------------|---------|--------|---------|
| `eks-cluster-sg` | 443 | API server | Control plane communication |
| `eks-node-sg` | All | Self | Pod-to-pod communication |
| `eks-node-sg` | 1025-65535 | `eks-cluster-sg` | Control plane → nodes |
| `msk-sg` | 9098 | `eks-node-sg` | Kafka TLS from EKS |
| `aurora-sg` | 5432 | `eks-node-sg` | PostgreSQL from EKS |
| `redis-sg` | 6379 | `eks-node-sg` | Redis from EKS |
| `apigw-sg` | All outbound | `0.0.0.0/0` | API Gateway VPC Link |

## Service Communication Matrix

```mermaid
graph LR
    subgraph "Synchronous (REST)"
        CS2["checkin-service"] -->|"InvokeFunction"| LQ["Lambda QR"]
        PS2["payment-service"] -->|"HTTPS"| Stripe["Stripe API"]
        NS2["notification-service"] -->|"HTTPS"| SES["AWS SES"]
        NS2 -->|"HTTPS"| SNS3["AWS SNS"]
    end

    subgraph "Asynchronous (Kafka)"
        BS2["booking-service"] -->|"booking.created"| FS2["flight-service"]
        FS2 -->|"seat-lock.confirmed"| BS2
        BS2 -->|"booking.payment-initiated"| PS2
        PS2 -->|"payment.completed"| BS2
        BS2 -->|"booking.confirmed"| CS2 & NS2
        BgS2["baggage-service"] -->|"baggage.status-updated"| NS2
        IS2["identity-service"] -->|"identity.registered"| NS2
    end
```

## Data Flow — Booking Saga

```mermaid
sequenceDiagram
    participant P as Passenger
    participant BS as booking-service
    participant K as Kafka (MSK)
    participant FS as flight-service
    participant PS as payment-service
    participant CS as checkin-service
    participant NS as notification-service

    P->>BS: POST /bookings
    BS->>BS: Create booking (AWAITING_SEAT_LOCK)
    BS->>K: publish booking.created

    K->>FS: consume booking.created
    FS->>FS: Lock seat (Redis SET NX)
    alt Seat available
        FS->>K: publish seat-lock.confirmed
    else Seat taken
        FS->>K: publish seat-lock.failed
        K->>BS: consume seat-lock.failed
        BS->>BS: Mark CANCELLED
        BS->>K: publish booking.cancelled
        K->>NS: consume booking.cancelled
        NS->>P: Email: booking failed
    end

    K->>BS: consume seat-lock.confirmed
    BS->>BS: Update (AWAITING_PAYMENT)
    BS->>K: publish booking.payment-initiated

    K->>PS: consume payment-initiated
    PS->>PS: Charge via Stripe
    alt Payment succeeds
        PS->>K: publish payment.completed
    else Payment fails
        PS->>K: publish payment.failed
        K->>BS: consume payment.failed
        BS->>BS: Mark COMPENSATING
        BS->>K: publish booking.seat-released
        K->>FS: consume seat-released
        FS->>FS: Release seat lock
    end

    K->>BS: consume payment.completed
    BS->>BS: Mark CONFIRMED
    BS->>K: publish booking.confirmed

    K->>CS: consume booking.confirmed
    CS->>CS: Create check-in record

    K->>NS: consume booking.confirmed
    NS->>P: Email: booking confirmation + receipt
```
