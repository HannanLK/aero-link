# AeroLink — Recovery Runbook

## Root cause

Every service pod is in `CrashLoopBackOff` because the database URL stored in AWS
Secrets Manager uses the **wrong Postgres username**.

| Where | Value | Correct? |
|-------|-------|----------|
| Aurora cluster (`modules/rds-aurora/main.tf` → `master_username`) | `aerolink_admin` | source of truth |
| `deploy.env` → `DB_MASTER_USERNAME` (used by `load-secrets.sh` to build every `db-url`) | `aerolink` ❌ | **wrong** |

`load-secrets.sh` wrote `postgresql://aerolink:...@aurora:5432/<db>` into every
`/aerolink/dev/*/db-url` secret. External Secrets synced that into the pods, and
Prisma failed at startup with:

> Authentication failed against database server… the provided database credentials
> for `aerolink` are not valid.

That is the chain behind issue #1 (app down). Issue #2 (Argo CD / 502 / NXDOMAIN)
is downstream: with all backends `Degraded` and `platform-init` `OutOfSync`, the
ALB never gets healthy targets, so CloudFront returns 502 and
`argocd.transnova.online` has no DNS record yet.

The `exit 254` failures in STEP 8 are a **separate, independent problem**: a `254`
from the AWS CLI is a service/auth error, and it hit all 12 secrets uniformly →
the AWS access keys in `deploy.env` were rotated/expired or lack
`secretsmanager`/`kms` permissions. The old script hid the real error with
`>/dev/null 2>&1`; you could not see it. (`deploy.env` even says "rotate the AWS
keys after grading.")

## What was changed in the repo

1. **`infrastructure/deploy.env`** — `DB_MASTER_USERNAME` is now `aerolink_admin`.
2. **`infrastructure/load-secrets.sh`** — now (a) derives the DB user from
   `terraform output aurora_master_username` with a fallback to `deploy.env` so it
   can never drift again, (b) runs `aws sts get-caller-identity` up front and stops
   with a clear message if creds are bad, and (c) prints the real AWS error on a
   failed `put`/`create` instead of swallowing it.
3. **`infrastructure/terraform/.../dev/outputs.tf`** — added an
   `aurora_master_username` output (the single source of truth for the script).

No application code or container images need rebuilding — the fix is purely the
secret value, so no `git push` to the Argo CD repo is required.

## Remediation — run on your machine (Git Bash)

```bash
cd infrastructure

# 0. Confirm AWS creds work. If this errors (exit 254), regenerate the access key
#    in IAM and update deploy.env BEFORE continuing.
source deploy.env
aws sts get-caller-identity

# 1. Rewrite every secret with the correct username. You should now see
#    "Using DB user: aerolink_admin" and OK lines (or the real error text).
bash load-secrets.sh

# 2. Force External Secrets to re-pull immediately (otherwise up to 1h refresh).
kubectl -n aerolink annotate externalsecret --all force-sync="$(date +%s)" --overwrite
# verify the synced k8s secret now has the right user:
kubectl -n aerolink get secret identity-service-secrets \
  -o jsonpath='{.data.DATABASE_URL}' | base64 -d; echo   # -> postgresql://aerolink_admin:...

# 3. Re-sync platform-init FIRST so the db-bootstrap Job creates the per-service DBs.
kubectl -n argocd patch app platform-init --type merge -p '{"operation":{"sync":{}}}'
kubectl -n aerolink wait --for=condition=complete job/db-bootstrap --timeout=180s
kubectl -n aerolink logs job/db-bootstrap

# 4. Restart the services so they pick up the corrected DATABASE_URL
#    (envFrom: secretRef does NOT auto-reload running pods).
kubectl -n aerolink rollout restart deploy
kubectl -n aerolink get pods -w     # wait for Running / 1/1

# 5. Confirm a backend is healthy.
kubectl -n aerolink logs deploy/identity-service --tail=20
```

## After the pods are healthy — fix the front door (502 / Argo CD NXDOMAIN)

```bash
# Does the webui ingress have an ALB address? Empty ADDRESS = ALB not provisioned.
kubectl -n aerolink get ingress
kubectl -n argocd  get ingress argocd-server

# If ADDRESS is blank, inspect the AWS Load Balancer Controller:
kubectl -n kube-system get pods | grep aws-load-balancer
kubectl -n kube-system logs deploy/aws-load-balancer-controller --tail=80
```

Most common ALB-not-provisioned causes to check in that log:
- public subnets missing the `kubernetes.io/role/elb = 1` tag (ALB can't be placed);
- the controller's IRSA role missing `elasticloadbalancing:*` permissions;
- the ingress `certificate-arn` ACM cert not yet `ISSUED`.

For `argocd.transnova.online` returning `DNS_PROBE_FINISHED_NXDOMAIN`: once the
ingress has an ALB hostname, a Route 53 A/ALIAS record for `argocd.transnova.online`
must point at it. If external-dns isn't running, add the record (or re-run
`terraform apply`) so the name resolves.

The STEP 10 health checks (`/api/v1/health/live` → 500, `/api/v1/flights/health/live`
→ 401) should clear once the services are Running and the ALB has healthy targets.
If the `401` persists on a health route, the API Gateway route for that path has a
JWT authorizer attached that should not be on a public health endpoint — remove it
from that route.

## Verify success
```bash
kubectl -n aerolink get pods                       # all Running, 0 restarts climbing
kubectl -n argocd get applications                 # all Synced + Healthy
curl -fsS https://transnova.online -o /dev/null -w 'HTTP %{http_code}\n'   # expect 200
```
