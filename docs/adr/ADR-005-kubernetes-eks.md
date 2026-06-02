# ADR-005 — Container Orchestration: Amazon EKS

| Field      | Value |
|------------|-------|
| Status     | Accepted |
| Date       | 2026-05-26 |
| Deciders   | Architecture Team |
| Rubric     | Task 1 (Containerisation, Kubernetes), Task 5 (Fault Tolerance — auto-scaling, HA zones) |

## Context

All nine containerised workloads (7 services + webui + Kafka UI) need orchestration with:
- Argo CD GitOps deployment
- Horizontal pod autoscaling
- Multi-AZ high availability
- IRSA (IAM Roles for Service Accounts) for AWS service access
- Cost-conscious node sizing with a single `terraform destroy` teardown

## Decision

**Amazon EKS** (Kubernetes 1.30) with:
- Managed node group: 2× `t3.medium` **Spot** instances across 2 AZs
- EKS cluster in private subnets; ALB in public subnets

## Alternatives Considered

| Option | Pros | Cons | Rejected Because |
|--------|------|------|-----------------|
| **EKS (chosen)** | Real AWS K8s, Argo CD native, IRSA, multi-AZ managed | $0.10/hr control plane + EC2 nodes | Accepted |
| k3s on EC2 | Cheaper ($0.02/hr for t3.micro) | Not managed K8s; less credibility; harder IRSA setup | Rejected (credibility + IRSA) |
| kind (local) | Free | Not deployed to AWS; cannot demonstrate cloud deployment | Rejected (not cloud) |
| ECS Fargate | Serverless containers, no node management | Not Kubernetes; Argo CD incompatible | Rejected (no K8s) |

## Cost Estimate

| Resource | Hourly | Daily | 10-day total |
|----------|--------|-------|-------------|
| EKS control plane | $0.10 | $2.40 | $24.00 |
| 2× t3.medium Spot (~70% discount) | $0.013×2 = $0.026 | $0.62 | $6.20 |
| NAT Gateway (1 per VPC) | $0.045 | $1.08 | $10.80 |
| MSK (3× kafka.t3.small) | $0.021×3 = $0.063 | $1.51 | $15.10 |
| Aurora PostgreSQL (db.t3.medium) | $0.065 | $1.56 | $15.60 |
| ElastiCache Redis (cache.t3.micro) | $0.017 | $0.41 | $4.10 |
| **Total** | | **~$7.58** | **~$75.80** |

VPC Endpoints eliminate NAT Gateway data charges for AWS-to-AWS traffic. `terraform destroy` removes all resources immediately after the demo.

## EKS Add-ons and Platform Components

All installed via Terraform Helm provider (declarative, destroyable):

```
Cluster Add-ons (managed by EKS):
  vpc-cni          — AWS CNI, pod networking
  coredns          — in-cluster DNS
  kube-proxy       — iptables rules

Platform Add-ons (Helm, managed by Terraform):
  aws-load-balancer-controller  — ALB from Ingress resources
  cluster-autoscaler            — scales node group 2→6 nodes
  metrics-server                — HPA CPU metrics source
  external-secrets              — Secrets Manager → K8s Secret
  keda                          — Kafka-lag-based pod autoscaling
  fluent-bit                    — log forwarding to CloudWatch
  opentelemetry-collector       — trace aggregation to X-Ray + APM
  argo-cd                       — GitOps continuous delivery
  cert-manager                  — in-cluster TLS (mTLS for service mesh lite)
```

## High Availability Configuration

| Resource | HA mechanism |
|----------|-------------|
| EKS nodes | 2 nodes in 2 different AZs; Cluster Autoscaler scales to 6 |
| Application pods | `topologySpreadConstraints: zone` spreads replicas across AZs |
| Aurora PostgreSQL | Multi-AZ: 1 writer + 1 reader; auto-failover < 30 s |
| ElastiCache Redis | Cluster mode with 2 replicas; automatic failover |
| MSK Kafka | 3 brokers across 3 AZs; replication factor 3 |
| ALB | AWS-managed, multi-AZ by default |

## Fault Tolerance Mechanisms

### Horizontal Pod Autoscaler (HPA)
```yaml
# Applied to every service except notification/baggage (KEDA instead)
minReplicas: 2
maxReplicas: 8
targetCPUUtilizationPercentage: 70
```

### KEDA ScaledObject (notification + baggage)
```yaml
triggers:
  - type: kafka
    metadata:
      bootstrapServers: <MSK_BROKERS>
      consumerGroup: aerolink-baggage-group
      topic: aerolink.checkin.completed
      lagThreshold: "50"      # scale up when lag > 50 messages
```

### Pod Disruption Budgets
```yaml
minAvailable: 1   # at least 1 pod always running during rollouts/node drains
```

### Liveness + Readiness Probes
```yaml
livenessProbe:
  httpGet: { path: /health, port: 3000 }
  failureThreshold: 3
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /ready, port: 3000 }
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Circuit Breaker (nestjs-resilience)
Applied to all synchronous REST calls between services (booking-service → flight-service for seat lock):
```
State: CLOSED → OPEN (after 5 failures in 10s) → HALF_OPEN (after 30s) → CLOSED
```

### Network Policies
Zero-trust: each service accepts traffic only from the API Gateway ingress and approved peer services. No pod can communicate with another pod unless explicitly permitted.

## Consequences

- GitOps flow: GitHub Actions builds and pushes images to ECR → commits updated image tag to Helm values → Argo CD detects change → syncs to cluster.
- Every Helm chart includes `deployment.yaml`, `service.yaml`, `ingress.yaml`, `hpa.yaml`, `pdb.yaml`, `serviceaccount.yaml`, `networkpolicy.yaml`, `externalsecret.yaml`.
- Rolling update strategy on all Deployments: `maxUnavailable: 0`, `maxSurge: 1` — zero-downtime deploys.
