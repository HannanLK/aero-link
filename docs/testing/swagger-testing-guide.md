# AeroLink — Swagger API Testing Guide

## Overview

Every AeroLink microservice exposes **Swagger UI** at `/docs` for interactive API testing. This guide walks through how to authenticate and test each service's API endpoints.

## Accessing Swagger UI

### Local Development
Start the services and navigate to each service's Swagger endpoint:

| Service | Swagger URL | Port |
|---------|------------|------|
| identity-service | http://localhost:3001/docs | 3001 |
| flight-service | http://localhost:3002/docs | 3002 |
| booking-service | http://localhost:3003/docs | 3003 |
| payment-service | http://localhost:3004/docs | 3004 |
| checkin-service | http://localhost:3005/docs | 3005 |
| baggage-service | http://localhost:3006/docs | 3006 |
| notification-service | http://localhost:3007/docs | 3007 |

### Production (via API Gateway)
Each service's Swagger is accessible through the domain:
- `https://api.transnova.online/api/v1/docs` (identity-service via NGINX routing)

### Raw OpenAPI Spec
The raw JSON spec for programmatic use (e.g., Postman import):
- `http://localhost:3001/docs/json`
- `http://localhost:3002/docs/json`
- etc.

## Step-by-Step Testing Workflow

### Step 1: Register a User

1. Open **identity-service** Swagger: `http://localhost:3001/docs`
2. Expand `POST /api/v1/auth/register`
3. Click **"Try it out"**
4. Enter the request body:
```json
{
  "email": "test@example.com",
  "password": "Test@1234!pass",
  "firstName": "John",
  "lastName": "Smith"
}
```
5. Click **"Execute"**
6. Verify response: `201 Created` with user object

### Step 2: Login and Get JWT Token

1. Expand `POST /api/v1/auth/login`
2. Click **"Try it out"**
3. Enter:
```json
{
  "email": "test@example.com",
  "password": "Test@1234!pass"
}
```
4. Click **"Execute"**
5. Copy the `accessToken` from the response

### Step 3: Authenticate Swagger UI

1. Click the **🔒 Authorize** button (top-right of Swagger UI)
2. In the "Value" field, enter: `Bearer <your_access_token>`
3. Click **"Authorize"** → **"Close"**
4. All subsequent requests will include the JWT token

### Step 4: Test Protected Endpoints

Now you can test any authenticated endpoint. For example:

#### Search Flights
1. Open **flight-service** Swagger: `http://localhost:3002/docs`
2. Authorize with the token from Step 3
3. Expand `GET /api/v1/flights`
4. Set parameters:
   - `origin`: `LHR`
   - `destination`: `DXB`
   - `departureDate`: `2026-07-01`
5. Click **"Execute"**

#### Create a Booking
1. Open **booking-service** Swagger: `http://localhost:3003/docs`
2. Authorize with the token
3. Expand `POST /api/v1/bookings`
4. Enter:
```json
{
  "flightId": "<flight-id-from-search>",
  "seatNumber": "12A",
  "totalAmount": 450.00,
  "currency": "USD"
}
```
5. Add header: `Idempotency-Key: <unique-uuid>`
6. Click **"Execute"**

## Demo Credentials

These users are seeded automatically with `docker compose up`:

| Email | Password | Roles | Use For Testing |
|-------|----------|-------|-----------------|
| `admin@aerolink.app` | `Demo@2024` | ADMIN + PASSENGER | Admin dashboard, user management |
| `passenger@aerolink.app` | `Demo@2024` | PASSENGER | Booking, check-in, baggage |
| `gateagent@aerolink.app` | `Demo@2024` | GATE_AGENT | Gate agent boarding |
| `flightops@aerolink.app` | `Demo@2024` | FLIGHT_OPS | Flight status updates |
| `immigration@aerolink.app` | `Demo@2024` | IMMIGRATION_OFFICER | Immigration clearance |

## Importing to Postman

1. Open any service's raw spec: `http://localhost:3001/docs/json`
2. Copy the URL
3. In Postman: **File → Import → Link** → paste the URL
4. Postman auto-generates a collection with all endpoints
5. Set up environment variable `baseUrl` = `http://localhost:3001`
6. Set up `accessToken` variable for auth header

## API Testing Scenarios

### Scenario 1: Complete Booking Flow (Happy Path)

```
1. POST /auth/register     → Create user
2. POST /auth/login        → Get JWT
3. GET  /flights           → Search flights
4. POST /bookings          → Create booking (triggers saga)
5. GET  /bookings/{id}     → Poll status (AWAITING_SEAT_LOCK → CONFIRMED)
6. POST /checkin           → Web check-in
7. GET  /checkin/{id}/pass → Get boarding pass QR
```

### Scenario 2: Payment Failure (Compensation Path)

```
1. POST /auth/login        → Get JWT
2. POST /bookings          → Create booking with Stripe test card 4000000000000002
3. GET  /bookings/{id}     → Status should be CANCELLED (payment.failed)
```

### Scenario 3: Seat Conflict (Concurrent Booking)

```
1. User A: POST /bookings { seatNumber: "1A" } → CONFIRMED
2. User B: POST /bookings { seatNumber: "1A" } → CANCELLED (seat-lock.failed)
```

### Scenario 4: Admin Operations

```
1. POST /auth/login (admin@aerolink.app) → Get admin JWT
2. GET  /users                           → List all users
3. POST /users/{id}/roles { role: "GATE_AGENT" } → Assign role
4. GET  /health                          → Check service health
```

## Stripe Test Cards

Use these Stripe test card numbers for payment testing:

| Card Number | Scenario |
|-------------|----------|
| `4242424242424242` | Successful payment |
| `4000000000000002` | Card declined |
| `4000000000009995` | Insufficient funds |
| `4000000000000069` | Expired card |
| `4000000000000127` | Incorrect CVC |

## Troubleshooting

| Issue | Solution |
|-------|---------|
| 401 Unauthorized | Token expired — re-login and re-authorize |
| 403 Forbidden | Wrong role — login with an account that has the required role |
| 404 Not Found | Check the service port — each service has its own Swagger |
| CORS Error | If testing from browser, use Swagger UI directly |
| Connection Refused | Ensure `docker compose up -d` and `npm run dev` are running |
