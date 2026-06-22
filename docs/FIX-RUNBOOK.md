# AeroLink — Fix Runbook

This document records the root-cause fixes already applied to the repo and the
exact commands **you** run on your Windows machine (Git Bash + Docker Desktop +
AWS CLI + Terraform) to bring the app up locally, get tests/CI green, and
redeploy to AWS clean.

The sandbox that applied these code fixes is offline, so anything needing
Docker, the network, or AWS credentials is listed here for you to run.

---

## 1. What was changed in the code (already done)

### 1.1 Prisma client clobber (the big one)
Every service has its own `schema.prisma`, but none set an `output`, so every
`prisma generate` overwrote the **same** `node_modules/.prisma/client`. Only the
last-generated service's models survived, which is why booking/flight/payment/
checkin failed with `has no exported member 'BookingStatus'` /
`Property 'booking' does not exist on PrismaService`, and identity crashed with
`Cannot find module dist/main` (its build failed to emit when another service
won the race).

Fix applied:
- Each `services/*/prisma/schema.prisma` now has `output = "./generated/client"`
  so each client lands in its own `services/<svc>/prisma/generated/client`.
- All 13 `@prisma/client` imports were repointed to the per-service path
  (`../../prisma/generated/client` etc.).
- Each service's `dev` script now runs `prisma generate &&` before
  `nest start --watch` (so the host `npm run dev` path can't start before the
  client exists). `build` and `test` already ran generate first.
- The 5 Dockerfiles no longer `COPY .../node_modules/.prisma` (the client now
  travels inside the already-copied `prisma/` folder).
- `services/*/prisma/generated/` is gitignored (build output).

### 1.2 notification-service crash (`AWS_REGION does not exist`)
The constructor called `config.getOrThrow('AWS_REGION')` unconditionally, so it
crashed locally even though `.env` sets `NOTIFICATION_DRIVER=log` (AWS not needed
locally). The service now honours `NOTIFICATION_DRIVER=log`: no SES/SNS/DynamoDB
clients are created and notifications are written to stdout. AWS mode is
unchanged. The unit-test mock was updated with a `get()` stub.

### 1.3 destroy.sh "hides in seconds"
`read "Type 'destroy'"` aborted instantly when launched without a terminal.
`destroy.sh` now reads the prompt from `/dev/tty` and supports non-interactive
teardown: `./destroy.sh --yes` or `CONFIRM=destroy ./destroy.sh`.

---

## 2. Run it locally (end-to-end)

> Intended local path is the full Docker stack (includes Kafka UI on :8090).
> Use this, **not** a bare `npm run dev`, for the demo.

```bash
# from repo root, in Git Bash
docker compose -f docker-compose.full.yml up -d --build
docker compose -f docker-compose.full.yml ps          # all healthy?
# webui dev server
cd webui && npm install && npm run dev
```

Open:
- Webui:        http://localhost:5173
- API Gateway:  http://localhost:8080/api/v1
- Kafka UI:     http://localhost:8090   (topics appear once services produce)

Demo users (password `Demo@2024`): `admin@aerolink.app`, `passenger@aerolink.app`, …

### If you prefer running services on the host (not Docker)
```bash
npm install
npm run packages:build          # build @aerolink/* shared packages first
# bring up infra deps only:
docker compose up -d             # postgres, redis, kafka, zookeeper
# run migrations per service (creates tables), then:
npm run dev:local                # generates prisma clients + starts all services
```
Each Prisma service needs its DB migrated once, e.g.:
```bash
cd services/identity-service && npx prisma migrate deploy && cd ../..
# repeat for booking/flight/payment/checkin (each has its own DATABASE_URL in .env)
```

### Verify
- Register + login from the webui (was "registration failed" — caused by identity
  not starting; fixed by 1.1).
- Search + book a flight (saga runs across booking/flight/payment via Kafka).
- Swagger per service: `http://localhost:<port>/api/v1/docs`.
- Kafka UI: topics listed once a booking flows through.

---

## 3. Tests + CI

```bash
npm run build      # turbo build all (runs prisma generate per service)
npm test           # turbo test all
```
GitHub Actions: the `pr-checks` `type-check` job runs `npx turbo run build`,
which failed only because of the Prisma clobber — it should pass now. Push to a
branch / open a PR and confirm `lint-all`, `type-check`, and `Service CI` go
green. Required repo secrets for the deploy jobs: `AWS_ACCOUNT_ID`, and either
`AWS_TERRAFORM_ROLE_ARN` / `AWS_DEPLOY_ROLE_ARN` (OIDC) **or**
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

---

## 4. AWS — clean slate (chosen option)

The earlier manual `terraform apply` (run from PowerShell) **failed partway** on
the API Gateway `health` route and left inconsistent state: repo-root
`terraform.tfstate` is empty (0 resources) while
`infrastructure/terraform/environments/dev/errored.tfstate` holds ~244 resources.
So real AWS resources likely exist but aren't tracked by the S3 backend
`deploy.sh` expects. The API Gateway bug itself is already fixed in
`modules/api-gateway/main.tf` (no `{proxy}` in the integration URI).

### 4.1 First, see what actually exists
```bash
cd infrastructure/terraform/environments/dev
terraform show errored.tfstate | grep -E "^# " | sort | head -80   # what the failed run created
# cross-check live resources by tag/name in your account:
aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName,'aerolink')].LoadBalancerName"
aws eks list-clusters
```
**Paste this output back to me and I'll confirm import-vs-delete before you destroy anything.**

### 4.2 Destroy the orphans (clean slate)
If the resources are the failed run's and you want them gone:
```bash
cd infrastructure/terraform/environments/dev
cp errored.tfstate terraform.tfstate          # use the state that knows the resources (LOCAL backend)
terraform init -migrate-state                  # or plain `terraform init` if no backend block
terraform destroy                              # review, then approve
```
Then sweep anything Terraform didn't track (ALBs/ENIs/SGs left by the LB
controller) using the AWS console filtered by the `aerolink-dev` tag, or
`infrastructure/destroy.sh --yes` (now non-interactive-safe).

### 4.3 Re-deploy fresh
```bash
cd infrastructure
# deploy.env (gitignored) holds AWS creds + TF_STATE_BUCKET/TF_LOCK_TABLE/DOMAIN_NAME — already present.
./deploy.sh 2>&1 | tee deploy.log     # tee so the window output is captured even if it exits
```
`deploy.sh` is guided (pauses before billed steps): creds → S3/Dynamo state →
init/plan → apply → kubeconfig → build+push 8 images to ECR → secrets →
ArgoCD sync → health checks → frontend verify. Run interactively so the
confirmations work; `--from N` resumes at a step.

### 4.4 Teardown when done
```bash
cd infrastructure
./destroy.sh           # interactive (type 'destroy')
# or non-interactive:
./destroy.sh --yes
```

---

## 5. Open verification checklist
- [ ] `npm run build` clean (all services emit dist).
- [ ] `npm test` green.
- [ ] Local register/login/book works via webui.
- [ ] Swagger reachable per service and via API Gateway `/docs`.
- [ ] Kafka UI shows topics after a booking.
- [ ] GitHub Actions green on a PR.
- [ ] `terraform apply` completes with 0 errors; health endpoints return 200.
- [ ] `destroy.sh` removes everything; AWS Cost Explorer shows ~0 next day.
