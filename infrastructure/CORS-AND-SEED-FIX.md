# AeroLink — Login / Register / Seatmap / Booking Failure — Root Cause & Fix

ArgoCD is healthy and the pods are up, but the browser cannot log in, register,
view the seat map, or complete a booking. The same flows work in `docker compose`.
There are **two independent root causes**. Both are fixed in this change set.

---

## Root cause #1 — CORS preflight is broken at the front door (the visible error)

The network tab shows the smoking gun:

```
POST  https://api.transnova.online/api/v1/auth/register   → CORS error
OPTIONS (preflight) .../auth/register                     → 404
```

Why it happens in prod but not locally:

| | Local (`docker compose`) | Prod (EKS + API Gateway) |
|---|---|---|
| Browser origin | `localhost:5173` | `https://transnova.online` |
| API origin | `localhost:8080` (same nginx) | `https://api.transnova.online` (**cross-origin**) |
| Who answers the `OPTIONS` preflight | nginx: `if ($request_method = OPTIONS) { return 204; }` + ACAO headers | nobody — see below |
| NestJS CORS | not needed (nginx handles it) | **`app.enableCors` was never called** |

In prod the SPA on `transnova.online` calling `api.transnova.online` is
cross-origin, so the browser sends an `OPTIONS` preflight first. Two things broke it:

1. **Every API Gateway route is `ANY`**, which also matches `OPTIONS`. An explicit
   route takes precedence over HTTP-API automatic CORS, so the preflight is
   *forwarded to the backend* instead of being auto-answered by API Gateway.
   - On the public `auth` route the NestJS app has no CORS / no `OPTIONS` handler → **404**.
   - On the protected routes (`flights`, `bookings`, …) the `OPTIONS` first hits the
     **Cognito JWT authorizer**, and the browser never sends `Authorization` on a
     preflight → **401**. *This is why the seat map and booking flow also fail.*
2. The `cors_configuration` block on the HTTP API additionally **strips/overrides
   any CORS headers the backend returns**, so even a correct backend response would
   lose its `Access-Control-Allow-Origin` header.

Net effect: the actual `POST`/`GET` never runs — the browser blocks it as a CORS error.

### Fix #1
- **`app.enableCors(...)` added to all 7 services** (`services/*/src/main.ts`) — the
  app now answers `OPTIONS` with `204` + the right `Access-Control-Allow-*` headers,
  exactly like the local nginx gateway. The allowlist is config-driven:
  - `CORS_ORIGINS` env (comma-separated) is the allowlist in deployed environments;
    it is set per service in Helm `values.yaml` → `env:` (the site URL placeholder).
  - If `CORS_ORIGINS` is unset/empty, services fall back to allowing any
    `localhost`/`127.0.0.1` port — covers local dev and `kubectl port-forward`
    without hardcoding the prod domain in the image.
- **API Gateway (`infrastructure/terraform/modules/api-gateway/main.tf`):**
  - Removed `cors_configuration` so API Gateway stops stripping the backend's CORS headers.
  - Added an **unauthenticated** `OPTIONS /api/v1/{proxy+}` route. A method-specific
    route beats `ANY`, and it carries **no JWT authorizer**, so preflights to
    protected paths (seat map, booking) are no longer rejected with 401.

---

## Root cause #2 — the database schema is never migrated and never seeded in the cluster

You asked to confirm DB connectivity / migrations / seeds. The DB *connection* is
fine (the earlier `aerolink_admin` username fix holds, and `db-bootstrap` creates the
per-service databases). But the databases are **empty — no tables, no demo data**:

- The service `Dockerfile` `CMD` is just `node dist/main`. There is **no
  `prisma migrate` / `db push`** in the entrypoint.
- The Helm `deployment.yaml` had **no `initContainers`** — the `migrations.enabled`
  flag in `values.yaml` existed but was never wired up (and was `false`).
- `db-bootstrap` only runs `CREATE DATABASE` — it never creates tables.
- There is **no seed Job** in the cluster.

In `docker compose` this is handled by the `*-migrate` one-shots (`prisma db push`)
and the `demo-seed` / `flight-seed` containers — none of which were ported to k8s.

Consequence even after CORS is fixed: `register`/`login` hit a missing `users` table,
and the seat map / booking have no flights or seats to show.

### Fix #2
- **Migration init-container** added to every service `deployment.yaml`, gated on
  `.Values.migrations.enabled`. Enabled (`true`) for the 5 Prisma services
  (identity, flight, booking, payment, checkin); left `false` for baggage (DynamoDB)
  and notification. It runs `prisma db push` before the app starts — an exact mirror
  of the compose `*-migrate` step:
  - calls the **absolute** binary `/app/node_modules/.bin/prisma` (NOT `npx prisma`,
    which can trigger a registry fetch in the pruned image and crash with exit 1);
  - sets `HOME=/tmp` so prisma can write its engine cache as non-root UID 1000
    (compose used `user: root` for the same reason).
  - `prisma` is a runtime dependency, so the binary survives `npm prune --omit=dev`.
- **`infrastructure/seed-job.yaml`** — a `flight-seed` Job (flights + seats, reusing
  the existing `seed-flights.js`) and a `demo-seed` Job (5 demo users + roles), to be
  applied once the services are healthy.

---

## Remediation — deploy order (run from repo root)

CORS must be fixed in the **images first**, then the gateway, then data.

```bash
# ── 1. Rebuild + push all 7 service images (CORS is compiled into the bundle). ──
# Build context is the REPO ROOT (the Dockerfiles COPY package*.json, packages/,
# and services/<svc>/). Run from the repo root.
ACCOUNT=432004895948
REGION=us-east-1
REGISTRY=${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com
TAG=$(git rev-parse --short HEAD)         # immutable tag (recommended); also push :latest

aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $REGISTRY

for s in identity flight booking payment checkin baggage notification; do
  REPO=$REGISTRY/aerolink-dev/${s}-service
  echo "── building ${s}-service ──"
  docker build -f services/${s}-service/Dockerfile -t $REPO:$TAG -t $REPO:latest .
  docker push $REPO:$TAG
  docker push $REPO:latest
done
```

```bash
# ── 2. Land the Helm/manifest changes (initContainer + migrations.enabled). ────
# These are GIT-driven via ArgoCD — a bare `rollout restart` will NOT add the
# init-container. Commit, push, and let Argo sync (or sync manually):
git add services/*/src/main.ts services/*/helm \
        infrastructure/terraform/modules/api-gateway/main.tf infrastructure/seed-job.yaml
git commit -m "fix(prod): app CORS + OPTIONS route + prisma-migrate init + seed jobs"
git push

argocd app sync -l app.kubernetes.io/part-of=aerolink   # or: kubectl -n argocd patch app ... sync
# Argo applies the new pod spec (with prisma-migrate initContainer) and, because
# imagePullPolicy=Always, pulls the new image. Force a re-pull if you only moved :latest:
kubectl -n aerolink rollout restart deploy
kubectl -n aerolink get pods            # initContainer prisma-migrate -> Completed, app 1/1

# ── 3. Apply the API Gateway change (drops cors_configuration, adds OPTIONS). ──
cd infrastructure/terraform/environments/dev
terraform apply -target=module.api_gateway
cd -

# ── 4. Seed data (once services are Healthy). ─────────────────────────────────
kubectl -n aerolink apply -f infrastructure/seed-job.yaml
kubectl -n aerolink wait --for=condition=complete job/flight-seed job/demo-seed --timeout=300s
kubectl -n aerolink logs job/demo-seed            # prints the demo credentials
```

## Verify end-to-end

```bash
# Preflight now returns 2xx WITH CORS headers (was 404/401):
curl -i -X OPTIONS https://api.transnova.online/api/v1/auth/register \
  -H 'Origin: https://transnova.online' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
# expect: HTTP/2 204  +  access-control-allow-origin: https://transnova.online

# Register works (or 409 if already seeded):
curl -i -X POST https://api.transnova.online/api/v1/auth/register \
  -H 'Origin: https://transnova.online' -H 'Content-Type: application/json' \
  -d '{"email":"t@t.com","password":"Demo@2024","firstName":"T","lastName":"T"}'

# Seat map returns data (needs a bearer token + a seeded flightId):
curl -s https://api.transnova.online/api/v1/flights/search?origin=SIN\&destination=KUL\&date=$(date +%F) \
  -H "Authorization: Bearer <token>"
```

Then in the browser: register → login → search SIN→KUL → open seat map → book →
pay. All four broken flows should now complete.

**Demo logins (after `demo-seed`)** — password `Demo@2024`:
`admin@aerolink.app`, `passenger@aerolink.app`, `gateagent@aerolink.app`,
`flightops@aerolink.app`, `immigration@aerolink.app`.

---

## Files changed

| File | Change |
|---|---|
| `services/*/src/main.ts` (×7) | `app.enableCors(...)`, `CORS_ORIGINS`-driven allowlist with localhost fallback |
| `services/*/helm/values.yaml` (×7) | `CORS_ORIGINS` env placeholder = site URL(s) |
| `infrastructure/terraform/modules/api-gateway/main.tf` | remove `cors_configuration`; add unauth `OPTIONS /api/v1/{proxy+}` route |
| `services/*/helm/templates/deployment.yaml` (×7) | `prisma-migrate` initContainer (gated on `migrations.enabled`) |
| `services/{identity,flight,booking,payment,checkin}/helm/values.yaml` | `migrations.enabled: true` |
| `infrastructure/seed-job.yaml` (new) | `flight-seed` + `demo-seed` Jobs |
