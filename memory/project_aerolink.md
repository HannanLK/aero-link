---
name: project-aerolink
description: AeroLink enterprise airline platform — cloud-native microservices migration project context, deadlines, and key decisions
metadata:
  type: project
---

AeroLink is a cloud-native microservices migration assignment for COMP60010: Enterprise Cloud and Distributed Web Applications. Deadline: 2026-06-05 23:59.

**Why:** Individual assessment worth 50% of module mark. Weighted: Architecture 20%, Implementation 40%, Testing 20%, Presentation 20%.

**Stack decided (pending user sign-off):**
- Backend: NestJS (TypeScript) per service
- Frontend: React 19 + Vite + shadcn/ui + Tailwind v4 (already scaffolded in webui/)
- DB: Aurora PostgreSQL per-service schemas + DynamoDB for baggage
- Messaging: Amazon MSK (Kafka) + Kafka UI
- Cache/Sessions: ElastiCache Redis
- Kubernetes: EKS + Argo CD (GitOps)
- CI: GitHub Actions
- IaC: Terraform (fully destroyable)
- API Gateway: AWS API Gateway v2 (HTTP) with Cognito authorizer
- Observability: CloudWatch + X-Ray primary, Elastic APM secondary
- Load testing: k6

**Services:** identity, flight, booking, payment, checkin, baggage, notification

**How to apply:** All coding decisions should reflect these technology choices. Cost-consciousness is critical (avoid expensive AWS resources, prefer free tier or short-lived).
