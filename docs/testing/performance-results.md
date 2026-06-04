# AeroLink — Performance Testing Results & Analysis

## Test Environment

| Property | Value |
|----------|-------|
| **Test Date** | 2026-06-04 |
| **Environment** | AWS EKS (us-east-1) / Local Docker |
| **EKS Nodes** | 2× t3.medium (Spot) |
| **Aurora** | db.t3.medium (Writer + Reader) |
| **MSK** | 2× kafka.t3.small |
| **Redis** | 2× cache.t3.micro |
| **Test Tool** | k6 v0.49+ |
| **Test Duration** | 5 minutes per scenario |

## Test Scenarios

### 1. Load Test — Steady State

**Objective**: Validate the system handles expected normal traffic without degradation.

| Parameter | Value |
|-----------|-------|
| Virtual Users (VUs) | 50 |
| Ramp-up | 30 seconds |
| Duration | 5 minutes |
| Scenario | Full booking flow (search → book → check status) |

**Results**:

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| Request rate (RPS) | > 100 | _TBD_ | ⬜ |
| p50 latency | < 200ms | _TBD_ | ⬜ |
| p95 latency | < 1,000ms | _TBD_ | ⬜ |
| p99 latency | < 2,000ms | _TBD_ | ⬜ |
| Error rate | < 1% | _TBD_ | ⬜ |
| Successful bookings | > 95% | _TBD_ | ⬜ |

### 2. Stress Test — Breaking Point

**Objective**: Determine the system's maximum capacity before degradation.

| Parameter | Value |
|-----------|-------|
| Virtual Users (VUs) | 10 → 500 (ramped) |
| Ramp-up | 5 minutes |
| Hold at peak | 2 minutes |
| Ramp-down | 1 minute |

**Results**:

| Metric | Value |
|--------|-------|
| Breaking point (VUs) | _TBD_ |
| Max sustainable RPS | _TBD_ |
| First error at VUs | _TBD_ |
| Error rate at peak | _TBD_ |
| Recovery time | _TBD_ |

### 3. Spike Test — Sudden Traffic Burst

**Objective**: Validate the system recovers from sudden traffic spikes (e.g., flash sale).

| Parameter | Value |
|-----------|-------|
| Baseline VUs | 10 |
| Spike VUs | 200 (instant) |
| Spike duration | 30 seconds |
| Recovery observation | 2 minutes |

**Results**:

| Metric | Value |
|--------|-------|
| Pre-spike p95 latency | _TBD_ |
| During-spike p95 latency | _TBD_ |
| Post-spike p95 latency | _TBD_ |
| Error rate during spike | _TBD_ |
| Auto-scale triggered? | _TBD_ |
| Recovery time | _TBD_ |

### 4. Endurance Test — Sustained Load

**Objective**: Detect memory leaks, connection pool exhaustion, and gradual degradation.

| Parameter | Value |
|-----------|-------|
| Virtual Users | 30 |
| Duration | 30 minutes |
| Monitoring | Memory, CPU, DB connections |

**Results**:

| Metric | Start | End | Trend |
|--------|-------|-----|-------|
| Memory usage | _TBD_ | _TBD_ | ⬜ Stable / 📈 Growing |
| CPU usage | _TBD_ | _TBD_ | ⬜ Stable / 📈 Growing |
| DB connections | _TBD_ | _TBD_ | ⬜ Stable / 📈 Growing |
| p95 latency | _TBD_ | _TBD_ | ⬜ Stable / 📈 Growing |

## Per-Endpoint Latency Breakdown

| Endpoint | Method | p50 | p95 | p99 | RPS | Error Rate |
|----------|--------|-----|-----|-----|-----|------------|
| `/auth/login` | POST | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/auth/register` | POST | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/flights` | GET | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/flights/:id/seat-map` | GET | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/bookings` | POST | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/bookings/:id` | GET | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/checkin` | POST | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `/baggage/:id` | GET | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Kafka Throughput Analysis

| Topic | Messages/sec | Avg Latency (produce) | Consumer Lag | Partition Balance |
|-------|-------------|----------------------|--------------|-------------------|
| `booking.created` | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `seat-lock.confirmed` | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `payment.completed` | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| `booking.confirmed` | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Running the Tests

### Prerequisites
```bash
# Install k6 (if not already installed)
# Windows:
choco install k6
# macOS:
brew install k6
```

### Execute Tests
```bash
# Load test (50 VUs, 5 min)
k6 run tests/load/booking-flow.js

# Stress test (10-500 VUs)
k6 run tests/load/stress-test.js

# Baggage scan test
k6 run tests/load/baggage-scan.js

# Full suite with result capture
cd tests/load
API_BASE_URL=http://localhost:8080/api/v1 ./run-load-tests.sh all
```

### View Results
```bash
# Generate Markdown summary
node tests/load/summarise.mjs tests/load/k6-results/<timestamp>/
```

## Performance Improvement Recommendations

### 1. Database Query Optimization
- **Add indexes** on frequently queried columns (e.g., `booking.passengerId`, `flight.departureDate`)
- **Use read replicas** for search queries (Aurora reader endpoint)
- **Connection pooling** with PgBouncer to reduce connection overhead

### 2. Caching Strategy
- **Redis cache** for flight search results (TTL: 5 minutes)
- **Redis cache** for seat maps (TTL: 30 seconds, invalidated on Kafka event)
- **CloudFront cache** for static assets (TTL: 7 days)

### 3. Kafka Optimization
- **Batch producing** — group multiple events per producer request
- **Increase partitions** to 6 for high-throughput topics
- **Tune consumer**: `max.poll.records=500`, `fetch.min.bytes=1024`

### 4. Application-Level
- **Pagination** — all list endpoints paginated (default: 20, max: 100)
- **Compression** — Brotli/gzip response compression
- **Circuit breakers** — fail fast on downstream failures (< 1ms vs 30s timeout)

### 5. Infrastructure Scaling
- **HPA CPU target**: Reduce from 70% → 60% for faster scaling response
- **Cluster Autoscaler**: Pre-warm with scheduled scaling before peak hours
- **Aurora auto-scaling readers**: Add read replicas during peak load
