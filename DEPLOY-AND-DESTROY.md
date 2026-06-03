# AeroLink — Deploy & Destroy Guide (AWS)

A complete, repeatable walkthrough to host AeroLink on AWS and tear it down when
you're done. Everything is automated by two scripts (`infrastructure/deploy.sh`
and `infrastructure/destroy.sh`); this document explains what they do, in order,
and how to verify each stage.

---

## 1. What gets deployed

```
                       Route 53 (transnova.online)
                                │
                          CloudFront (CDN, TLS via ACM)
                                │
                        AWS Load Balancer (ALB)
                                │
        ┌───────────────────────┴────────────────────────┐
        │                  EKS cluster                    │
        │  webui (nginx)   identity  flight  booking …    │  ← Argo CD (GitOps)
        │  init: prisma db push      ensureTopics()       │
        └───────┬───────────────┬───────────────┬─────────┘
                │               │               │
           Aurora PG        ElastiCache       Amazon MSK (Kafka, TLS+IAM)
           DynamoDB         (Redis)           Cognito · KMS · WAF · X-Ray
```

Everything is one Terraform stack (VPC, EKS, Aurora, MSK, ElastiCache,
DynamoDB, ECR, Cognito, API Gateway, CloudFront, WAF, GuardDuty, KMS,
CloudTrail, Route 53, ACM, IAM/OIDC, and the in-cluster add-ons incl. Argo CD).

> **Cost awareness.** This is a real production-grade stack: EKS + 2 nodes +
> Aurora + MSK (2 brokers) + 2 NAT gateways ≈ **$1–1.5 / hour (~$25–35 / day)**.
> Run `destroy.sh` whenever you're not actively using it.

---

## 2. Prerequisites (on your machine)

| Tool | Version | Check |
|------|---------|-------|
| AWS CLI | ≥ 2.x | `aws --version` |
| Terraform | ≥ 1.7 | `terraform version` |
| kubectl | ≥ 1.28 | `kubectl version --client` |
| Helm | ≥ 3.x | `helm version` |
| Docker | running | `docker ps` |
| Node.js | ≥ 22 | `node -v` |

Your credentials and config are already filled in `infrastructure/deploy.env`
(AWS keys, account `705393003949`, region `us-east-1`, DB password, Stripe keys,
domain `transnova.online`, hosted zone `Z0712947GW3PXCFG0HV`).

> ⚠️ **Rotate the AWS access key and Stripe secret after grading** — they were
> shared in plaintext.

---

## 3. Before you deploy — verify the app builds

```bash
./verify-local.sh
```

Must end with `✓ ALL CHECKS PASSED`. This installs deps (Swagger, OTel, the
Kafka IAM signer), generates Prisma clients, builds every service + webui, and
runs the unit tests. **Don't deploy if this fails** — you'd ship broken images.

---

## 4. One-time: SES sender verification

The notification-service sends email from `hannanmunas76@gmail.com`. While your
account is in the SES sandbox you must verify it (you'll get a confirmation
email — click the link):

```bash
aws ses verify-email-identity --email-address hannanmunas76@gmail.com --region us-east-1
```

---

## 5. Deploy

```bash
cd infrastructure
chmod +x deploy.sh destroy.sh load-secrets.sh
./deploy.sh
```

The script runs 11 steps and **pauses for confirmation before every step that
creates billed resources**. What each does:

| Step | Action | Notes |
|------|--------|-------|
| 1 | `aws configure` from deploy.env | prints your caller identity |
| 2 | Create S3 state bucket + DynamoDB lock table | one-time, ~30 s |
| 3 | Confirm `terraform.tfvars` | already filled for transnova.online |
| 4 | `terraform init` + **import your hosted zone** + `plan` | **review the plan** |
| 5 | `terraform apply` | **~15–25 min, the big one** |
| 6 | `aws eks update-kubeconfig` | `kubectl get nodes` should show 2 Ready |
| 7 | Build & push 8 images + webui to ECR | ~10 min |
| 8 | Populate Secrets Manager (`load-secrets.sh`) | DB URLs, JWT, Stripe, Kafka, redis, **aurora-admin-url** |
| 9 | Argo CD syncs all apps | prints the admin password + port-forward cmd |
| 10 | Health-endpoint checks | |
| 11 | Frontend verification | webui is deployed by Argo CD, not S3 |

Resume after an interruption: `./deploy.sh --from 7`.

### What happens inside the cluster (Step 9)

Argo CD applies things in sync-wave order so the data layer is ready before the
apps boot:

1. `platform-init` ExternalSecret (wave **-2**) → pulls the Aurora admin URL.
2. `db-bootstrap` Job (wave **-1**) → `CREATE DATABASE` for the 5 service DBs.
3. Service apps (wave **0**) → each Prisma service's init-container runs
   `prisma db push` to create its schema; producers call `ensureTopics()` to
   create the Kafka topics on MSK (auto-create is disabled there).

---

## 6. Verify it's live

```bash
# Argo CD — every app should be Synced / Healthy
kubectl -n argocd get applications

# Pods
kubectl -n aerolink get pods

# Health through the API
API=$(cd infrastructure/terraform/environments/dev && terraform output -raw api_gateway_url)
curl $API/api/v1/health/live

# Distributed tracing — trigger a booking, then open AWS Console → X-Ray
# Frontend
open https://transnova.online        # (or just visit in a browser)
```

Swagger UI for any service (port-forward then browse):

```bash
kubectl -n aerolink port-forward deploy/booking-service 3003:3000
# http://localhost:3003/docs
```

Demo logins are seeded by the identity service (`admin@aerolink.app` /
`Demo@2024`, etc. — see README).

---

## 7. DNS / certificate notes

Your registrar already points `transnova.online` at the hosted zone's
nameservers, and `deploy.sh` **imports** that zone (Step 4) instead of creating
a duplicate. Terraform adds the `api.` / root alias records and an ACM
certificate validated via DNS. First-time certificate validation + CloudFront
propagation can take **15–40 min** — if `https://transnova.online` doesn't load
immediately, give it time and re-check `kubectl -n aerolink get ingress`.

---

## 8. Destroy (stop all billing)

```bash
cd infrastructure
./destroy.sh
```

Type `destroy` to confirm. The script:

1. Deletes the in-cluster Ingress/LoadBalancer services **first** and waits ~90 s
   so the AWS Load Balancer Controller removes the ALB (otherwise the VPC
   destroy hangs on leftover network interfaces).
2. Removes the **hosted zone from Terraform state** so your domain + nameservers
   are **preserved** for next time (DNS records inside it are still cleaned).
3. Runs `terraform destroy` (~10–15 min) — deletes EKS, Aurora, MSK,
   ElastiCache, NAT gateways, CloudFront, etc.
4. Sweeps for any orphaned load balancers and deletes them.

Variants:

```bash
./destroy.sh           # keeps the Terraform state bucket (so you can redeploy fast)
./destroy.sh --nuke    # also deletes the state bucket + lock table (full clean)
```

After destroy:

- **KMS keys** enter a 7-day deletion window (a few cents, unavoidable).
- The **hosted zone** remains (intentional — your registrar still points to it).
- Confirm **$0 ongoing** in AWS Cost Explorer the next day.

### Redeploying later

Because the state bucket and hosted zone are preserved, a fresh deploy is just
`./deploy.sh` again (it re-imports the zone automatically and rebuilds
everything). Use `--nuke` only if you want a truly blank slate.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `terraform apply` fails on Route 53 zone "already exists" | The import in Step 4 didn't run — `terraform import module.route53.aws_route53_zone.main Z0712947GW3PXCFG0HV` then re-apply. |
| Pods stuck `Init:0/1` | Waiting on the `db-bootstrap` Job or External Secrets. Check `kubectl -n aerolink logs job/db-bootstrap` and `kubectl -n aerolink get externalsecret`. |
| Service `CrashLoopBackOff` with Kafka errors | MSK IAM auth — confirm the pod's ServiceAccount has the IRSA role and `KAFKA_AUTH=iam` is set. Watch `ensureTopics` log line. |
| `https://transnova.online` not loading | ACM/CloudFront still propagating (up to 40 min), or ALB not ready — `kubectl -n aerolink get ingress`. |
| `terraform destroy` hangs on VPC / subnets | A leftover ALB. `destroy.sh` handles this, but if run manually delete k8s ingress first. |
| ECR push denied | Re-run `aws ecr get-login-password ... | docker login` (token expires hourly). |

---

## 10. Quick reference

```bash
./verify-local.sh                 # build + test locally (do first)
cd infrastructure && ./deploy.sh  # deploy to AWS (resume: --from N)
./destroy.sh                      # tear down (keep zone + state)
./destroy.sh --nuke               # tear down everything
```
