# ADR-006 — API Gateway and Authentication: AWS API Gateway v2 + Cognito

| Field      | Value |
|------------|-------|
| Status     | Accepted |
| Date       | 2026-05-26 |
| Rubric     | Task 2 (API Gateway, OAuth 2.0, JWT), Task 3 (RBAC, secure service-to-service) |

## Context

A single secure entry point is required for all client traffic. It must:
- Enforce OAuth 2.0 JWT authentication before requests reach EKS
- Route HTTP requests to microservices based on path prefix
- Support WebSocket for real-time seat map updates
- Integrate with WAF for OWASP protection
- Expose a custom domain via ACM and Route 53

## Decision

**AWS API Gateway v2 (HTTP API)** with a **Cognito JWT Authorizer** for authentication.

## Architecture

```
Client ──HTTPS──► CloudFront (WAF) ──► API Gateway v2 ──► ALB ──► EKS pods
                                            │
                                     JWT Authorizer
                                            │
                                       Cognito User Pool
                                       (validates JWT)
```

**WebSocket route:** API Gateway v2 WebSocket API → ALB → flight-service WebSocket gateway (NestJS `@WebSocketGateway`)

## Cognito Setup

| Component | Config |
|-----------|--------|
| User Pool | `aerolink-users` — manages customer accounts |
| App Client | SPA client (no client secret, PKCE flow) |
| Custom attributes | `custom:roles` — stores comma-separated role string (`CUSTOMER,FLIGHT_ATTENDANT`) |
| JWT validity | Access token: 1 hour; Refresh token: 30 days |
| Hosted UI | Enabled — markers can test OAuth2 login flow directly |
| MFA | Optional TOTP (demonstrated for `AIRLINE_ADMIN` role) |

## OAuth 2.0 Flow

```
1. Browser redirects to Cognito Hosted UI
2. User logs in with email + password
3. Cognito issues access_token (JWT) + refresh_token
4. Browser stores access_token in memory (NOT localStorage — XSS mitigation)
5. Every API request: Authorization: Bearer <access_token>
6. API Gateway JWT Authorizer validates:
   - Signature (Cognito public key via JWKS)
   - Expiry (exp claim)
   - Audience (aud claim = App Client ID)
7. API Gateway injects x-user-id and x-user-roles headers
8. NestJS RolesGuard reads x-user-roles → enforces RBAC
```

## Service-to-Service Authentication

Internal service-to-service calls (e.g. checkin-service calling booking-service to validate a booking) use **service account JWTs**:
- A dedicated Cognito App Client for each service (client credentials flow)
- Issued JWTs contain `custom:roles: SERVICE_ACCOUNT`
- The `RolesGuard` allows `SERVICE_ACCOUNT` on internal-only endpoints
- Calls never leave the VPC (ALB resolves to private IP via internal Route 53)

## API Gateway Routes

| Route | Target Service | Auth |
|-------|---------------|------|
| `POST /auth/*` | identity-service | None (public) |
| `GET /flights*` | flight-service | JWT required |
| `POST /bookings*`, `GET /bookings*` | booking-service | JWT required |
| `POST /payments*` | payment-service | JWT required (CUSTOMER, AIRLINE_ADMIN) |
| `POST /checkin*`, `GET /checkin*` | checkin-service | JWT required |
| `POST /baggage*`, `GET /baggage*` | baggage-service | JWT required |
| `GET /notifications*` | notification-service | JWT required |
| `WS $connect`, `WS $disconnect`, `WS $default` | flight-service (WS GW) | JWT in query param |

## Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **AWS API GW v2 + Cognito (chosen)** | Native AWS, managed JWT validation, WebSocket support, WAF integration | Limited transformation capabilities | Accepted |
| Kong Gateway on EKS | Plugin ecosystem, code-gen from OpenAPI | Extra deployment complexity, no managed HA | Rejected (complexity) |
| AWS API GW v1 (REST) | More features (request transforms) | WebSocket not supported; higher cost per request | Rejected (WebSocket) |
| Nginx Ingress only | Zero cost | No JWT validation at edge; all auth logic in services | Rejected (security) |

## Consequences

- API Gateway stage URL is the base URL in all OpenAPI specs and Postman environment.
- CORS configuration: `Access-Control-Allow-Origin: https://aerolink.app` only.
- Request throttling: 1000 req/s burst, 500 req/s sustained per stage (prevents cascade during load testing).
- API Gateway access logs → CloudWatch (request ID = correlation ID for tracing).
