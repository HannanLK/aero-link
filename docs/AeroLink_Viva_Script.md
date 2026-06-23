# AeroLink — Viva Speaking Script

**Mohamed Hanaan Mohamed Munas · CB011253 · COMP60010**
Target: ~13 minutes talk + demo, then Q&A. 18 slides.

**Before you start:** have two windows ready — (1) the slide deck, (2) the running app (`docker compose up`, web UI open at the landing page) plus one browser tab on a Swagger page e.g. `http://localhost:3003/docs` (booking-service). Keep the demo logins handy: `passenger@aerolink.app` / `Demo@2024` and `admin@aerolink.app` / `Demo@2024`.

**Legend:** 🗣️ = what to say · 🖥️ = what to show · ⏱️ = rough time.

---

## Slide 1 — Title ⏱️ 0:30
🗣️ "Good morning. I'm Hanaan, CB011253. My project is **AeroLink** — a cloud-native, distributed airline operations platform. The core idea: take what would traditionally be one large monolithic airline system and rebuild it as seven loosely-coupled microservices on AWS, coordinated by an event-driven Kafka backbone. Over the next twelve minutes I'll walk through the architecture, the implementation, security, real-time sync, resilience and testing — and I'll show the running system as I go."

🖥️ Slides only. Have the app already running in the background.

---

## Slide 2 — Agenda / rubric map ⏱️ 0:30
🗣️ "I've structured the talk to follow the assessment criteria: architecture design, the implementation — which is the bulk of the work — testing and results, and then this presentation itself. The strip along the bottom is the order I'll move in."

🗣️ *(one line that scores points)* "Throughout, I'll be explicit about what is fully wired versus what is provisioned-but-not-yet-connected — I'd rather be precise than oversell."

---

## Slide 3 — Why move off the monolith? ⏱️ 0:45
🗣️ "The motivation. In a monolith, all these airline functions share one process and one database. That means you can't scale check-in independently of booking, every release redeploys everything, and a fault in one subsystem cascades to unrelated ones. AeroLink's response is on the right: model the airline domain as bounded contexts, couple them through domain events rather than direct calls, and run them on managed AWS services. That directly targets the four requirements in the brief — high availability, scalability, fault tolerance and real-time sync."

---

## Slide 4 — AeroLink at a glance ⏱️ 0:45
🗣️ "At a glance: seven NestJS microservices, an event backbone of sixteen-plus Kafka topics plus a dead-letter queue, the entire AWS environment defined as nineteen Terraform modules, and nine RBAC roles. On the left is the passenger journey it delivers end-to-end; on the right, the stack it's built on."

🖥️ **First demo moment.** Switch to the app landing page. "This is the live web client — Emirates-style search, one-way/return/multi-city." Do a quick flight search to show results, then come back to slides. *(Keep it under 30 seconds.)*

---

## Slide 5 — Five-layer architecture ⏱️ 1:15  *(Architecture 20%)*
🗣️ "Task one, the architecture. I organised the estate into five layers. **Edge** — CloudFront, WAF, Route 53 for TLS, DDoS protection and static assets. **API** — API Gateway with an ALB. **Compute** — an EKS cluster on Spot nodes running the service pods. **Data** — Aurora, Redis, DynamoDB and Kafka. And **Security** as a cross-cutting layer — KMS, Cognito, Secrets Manager, GuardDuty."

🗣️ *(trace the right panel)* "A request flows top to bottom: browser, into CloudFront or API Gateway, JWT validated, across a VPC Link to the ALB inside EKS, to the owning service pod, which reads its store and emits a Kafka event. That last step is what makes the system reactive."

---

## Slide 6 — Service decomposition ⏱️ 1:00  *(Architecture 20%)*
🗣️ "Here are the seven services. The key principle on the right: each service owns its own data store and writes only to it, exposes a versioned REST API, and shares only three internal packages — event schemas, middleware and a shared kernel. I enforce the boundary in code — there's a CI rule that fails the build if one service imports another's source. So this isn't just a diagram; it's structurally guaranteed."

🗣️ *(point to stores)* "Notice the persistence is polyglot — Aurora for transactional services, Redis for the flight read-model, DynamoDB for baggage and notifications. I chose the store per access pattern, not one database for everything."

---

## Slide 7 — Data, HA & scaling ⏱️ 1:00  *(Architecture 20%)*
🗣️ "Expanding on data, availability and scale. Stateful components are replicated across two availability zones with automatic failover — Aurora writer plus a cross-AZ reader, Redis primary plus replica, a Kafka broker per zone. Single-AZ failure recovers in under five minutes."

🗣️ "Scaling happens at three levels: HPA scales pods on CPU for HTTP services; KEDA scales the baggage and notification consumers on **Kafka lag**, because their load is event-volume not request-volume; and the Cluster Autoscaler adds Spot nodes underneath."

🗣️ *(honesty point — examiners like this)* "One honest caveat: the Terraform can recreate the whole estate in another region, but I'm not running it active-active. I call that out explicitly because the brief asks specifically about multi-region."

---

## Slide 8 — REST APIs & API Gateway ⏱️ 1:00  *(Implementation 40%)*
🗣️ "Task two, the distributed application. Every service exposes a versioned REST API with a global validation pipe, pagination, idempotency keys so retries never duplicate, and a correlation ID that's carried all the way into the events a request triggers. One deliberate design choice: creating a booking returns **202 Accepted**, not 201 — because the work continues as a saga, and the client polls for status."

🖥️ **Second demo moment.** Switch to a Swagger tab, e.g. booking-service `/docs`. "Every service self-documents with OpenAPI — here are the booking endpoints." Scroll briefly.

🗣️ *(the transparency box)* "On the gateway — the API Gateway and its Cognito JWT authorizer are fully provisioned in Terraform. In the running app, authentication is currently done with tokens from the identity service, with identity forwarded to downstream services via headers. Edge Cognito auth and the WebSocket routes are provisioned but not yet wired into application logic — those are on my roadmap."

---

## Slide 9 — Event-driven architecture & saga ⏱️ 1:15  *(Implementation 40%)*
🗣️ "This is the heart of the system. Services coordinate by **choreography** — each publishes facts about its domain and subscribes to the facts it cares about. There's no central orchestrator, so no single point of failure. Sixteen topics plus a dead-letter queue, and every message is validated against a shared Zod envelope, so producers and consumers agree on the contract."

🗣️ *(walk the numbered flow)* "Follow the booking saga: POST returns 202; booking publishes `booking.created`; flight locks the seat and confirms; booking initiates payment; payment completes; booking emits `booking.confirmed`, which check-in and notification both react to. And critically — if payment or the seat-lock fails, **compensating events roll the saga back**. That's how I get a transaction across service boundaries without a distributed lock on everything."

🖥️ *(optional)* If you have a Kafka UI or logs, you can tab to it and say "you can see these events flowing here," then return.

---

## Slide 10 — Security & compliance ⏱️ 1:00  *(Implementation 40%)*
🗣️ "Task three, security — defence in depth. **Authentication**: bcrypt at cost twelve, short-lived 15-minute JWTs held in memory to limit XSS exposure. **Authorisation**: nine RBAC roles, plus resource-ownership checks — a valid token for one passenger cannot read another's booking. **Encryption**: three separate customer-managed KMS keys for PCI, PII and infrastructure, all auto-rotating, TLS everywhere, secrets via Secrets Manager and IRSA."

🗣️ *(compliance — say it crisply)* "For **PCI-DSS**, I keep the platform out of scope: Stripe tokenises the card on the client, and I store only a Stripe reference and the last four digits. Card numbers never touch my system. For **GDPR**, erasure is by cryptographic shredding — discard the subject's key and their data is unrecoverable."

🖥️ *(optional)* Log in as `admin`, show the `/admin` dashboard; then mention "a passenger role can't reach this route" — RBAC in action.

---

## Slide 11 — Data consistency ⏱️ 0:50  *(Implementation 40%)*
🗣️ "The consistency question. You can't have one ACID transaction across services, so I use eventual consistency and add strong guarantees only where a stale read would be incorrect. The booking is a saga. Seat selection — where a stale read could double-book — is protected by an **atomic Redis SET-NX lock**: only one booking can acquire a given seat key, and that lock, not the read model, is the authoritative arbiter. Idempotency keys make retries safe, and the CQRS read model rebuilds from the write model on each event."

---

## Slide 12 — Real-time synchronisation ⏱️ 1:00  *(Implementation 40%)*
🗣️ "Task four, real-time. Everything is event-driven, not polled — the same Kafka event that updates the database is what pushes to the client, so the UI can't drift from the backend. Live seat availability uses CQRS with a roughly 100–200 millisecond convergence window. And baggage is modelled as an explicit seven-state machine — each transition is validated against an allowed-transitions table, written to DynamoDB with a conditional expression, and published as an event the notification service turns into an SMS or email. Modelling it as a state machine makes illegal sequences impossible."

🖥️ **Third demo moment.** Open the baggage tracker (`/baggage`) or the flight tracker (`/track`) to show live movement, then return.

---

## Slide 13 — Fault tolerance & resilience ⏱️ 1:00  *(Implementation 40%)*
🗣️ "Task five, resilience. A **circuit breaker** wraps risky downstreams — three states: closed, open, half-open. The payoff is on the left: without it, a Stripe outage would cascade thirty-second timeouts through payment, booking and the gateway. With it, the failure is detected in under a millisecond and the user sees 'try again later' in about a hundred. **Retries** use capped exponential backoff with jitter and skip non-retryable errors like validation. Plus the auto-scaling and multi-AZ failover from earlier, and a Terraform-based DR path for full region loss."

---

## Slide 14 — Testing & results ⏱️ 1:00  *(Testing 20%)*
🗣️ "Task six and the testing strategy. Four levels: unit with Jest; integration with Jest and Docker Compose; API tests via Swagger and Postman; and performance with k6. The chart is my stress profile ramping to five hundred virtual users."

🗣️ *(emphasise the integration test — it's the strongest evidence)* "The one I'd highlight is the integration test on the right. It drives the real booking saga against real infrastructure — creates a booking over REST, asserts the events fire in the right order, verifies the status progression, and deliberately triggers a payment failure to confirm the seat lock is released. That proves the cross-service contract, which mocked unit tests simply can't."

🖥️ *(optional)* Tab to a terminal and run/scroll the integration test output if it's quick; otherwise just show the test file.

---

## Slide 15 — CI/CD & IaC ⏱️ 0:45  *(Implementation 40%)*
🗣️ "Delivery is fully automated. CI on GitHub Actions detects which services changed, lints and tests only those, builds and pushes images to ECR, and bumps the Helm tag. Deployment is GitOps — Argo CD continuously reconciles the cluster to what's in Git, so there's no manual deploy step. And the whole AWS estate is nineteen Terraform modules, which is also what makes the DR region-redeploy possible."

---

## Slide 16 — Monitoring & observability ⏱️ 0:45  *(Implementation 40%)*
🗣️ "Task seven, observability — the three pillars plus health checks. CloudWatch collects metrics with alarms defined as version-controlled Terraform. Liveness and readiness probes let Kubernetes self-heal correctly. Logs are structured JSON keyed by correlation ID, so I can follow one request across every pod it touches. And OpenTelemetry auto-instruments HTTP, Kafka, Postgres and the AWS SDK for distributed tracing, linked back to those logs by the same correlation ID."

---

## Slide 17 — Challenges, limitations & future work ⏱️ 0:45
🗣️ "Being upfront about boundaries: edge Cognito authentication, the live WebSocket channel, and active-active multi-region are provisioned or reproducible but not fully wired in. The roadmap closes those gaps and adds a native mobile client and real GDS integration. The important point is that the event-driven design makes extension cheap — adding loyalty points, for instance, is just a new service subscribing to `booking.confirmed`. Nothing existing has to change."

---

## Slide 18 — Conclusion ⏱️ 0:30
🗣️ "To summarise: AeroLink delivers across all four areas — a five-layer cloud-native architecture, a substantial event-driven implementation, a layered test strategy that proves the cross-service contract, and disciplined engineering that combines cloud-native tooling with distributed-systems principles. Thank you — I'm happy to take questions or demo any part live."

🖥️ Leave the app running so you can jump into any flow an examiner asks about.

---

# Likely viva questions — quick answers

- **Why choreography over orchestration?** No single point of failure, lower coupling, services scale and deploy independently, and new steps just subscribe to an event. Trade-off: harder to see the whole flow — which is why every event carries a correlation ID and booking keeps a saga-history array.
- **How do you prevent double-booking?** Atomic Redis `SET NX` on the seat key — only one booking acquires it; the lock is authoritative even if the read model briefly lags. 15-minute TTL auto-releases abandoned locks.
- **What happens if payment fails mid-saga?** A `payment.failed` event triggers compensation — the booking is cancelled and the seat lock released. Eventual consistency, not a global rollback.
- **Is it really multi-region?** Honestly, no — it's region-*reproducible* via Terraform, not active-active. I call that out as a limitation rather than overclaim.
- **Why 202 on booking?** The work is asynchronous across a saga, so I acknowledge receipt and let the client poll, rather than block an HTTP request on a multi-service workflow.
- **How is service-to-service traffic secured?** Services don't call each other's REST APIs — they communicate over Kafka with TLS in transit, a customer-managed KMS key at rest, and IRSA so each pod authenticates with short-lived identity-based credentials.
- **How do you stay PCI-compliant?** Card data is tokenised by Stripe on the client; I store only a Stripe reference and last-four, encrypted under a dedicated PCI key. Card numbers never reach the platform.
- **What's your weakest area / what would you do next?** Wire the WebSocket channel and edge Cognito auth into the live app, then move to active-active multi-region.

---

# Timing summary
Architecture (slides 5–7) ≈ 3:15 · Implementation (8–16) ≈ 8:00 · Testing (14) within that · Intro+close ≈ 2:00.
**Total ≈ 13 min.** If you're short on time, compress slides 15 and 16 to one line each and keep the demo moments — examiners weight a working system heavily.
