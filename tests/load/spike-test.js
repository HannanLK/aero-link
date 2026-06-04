import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8080/api/v1';

// Custom metrics
const spikeErrors = new Counter('spike_errors');
const errorRate = new Rate('spike_error_rate');

export const options = {
  scenarios: {
    // Spike test: sudden burst of traffic
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },   // Baseline (low traffic)
        { duration: '1m', target: 10 },    // Hold baseline
        { duration: '5s', target: 200 },   // SPIKE! Instant jump to 200 VUs
        { duration: '30s', target: 200 },  // Hold spike
        { duration: '5s', target: 10 },    // Drop back to baseline
        { duration: '2m', target: 10 },    // Recovery observation
        { duration: '30s', target: 0 },    // Wind down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.15'],           // < 15% error rate during spike
    http_req_duration: ['p(95)<8000'],        // p95 < 8s (lenient for spike)
    spike_error_rate: ['rate<0.20'],          // Custom error tracking
  },
};

export default function () {
  // Mix of read-heavy and write operations to simulate real traffic

  const operation = Math.random();

  if (operation < 0.6) {
    // 60% — Read operations (flight search)
    const res = http.get(`${BASE_URL}/flights?origin=LHR&destination=DXB`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const success = check(res, {
      'search OK': (r) => r.status === 200,
    });
    errorRate.add(!success);
    if (!success) spikeErrors.add(1);

  } else if (operation < 0.8) {
    // 20% — Auth operations
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: 'passenger@aerolink.app',
      password: 'Demo@2024',
    }), { headers: { 'Content-Type': 'application/json' } });
    const success = check(res, {
      'login OK': (r) => r.status === 200,
    });
    errorRate.add(!success);
    if (!success) spikeErrors.add(1);

  } else if (operation < 0.9) {
    // 10% — Health checks (simulates monitoring)
    const res = http.get(`${BASE_URL}/health/live`);
    const success = check(res, {
      'health OK': (r) => r.status === 200,
    });
    errorRate.add(!success);
    if (!success) spikeErrors.add(1);

  } else {
    // 10% — Write operations (booking attempt)
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: 'passenger@aerolink.app',
      password: 'Demo@2024',
    }), { headers: { 'Content-Type': 'application/json' } });

    if (loginRes.status === 200) {
      const token = loginRes.json('accessToken');
      const res = http.post(`${BASE_URL}/bookings`, JSON.stringify({
        flightId: 'spike-test-flight',
        seatNumber: `${Math.floor(Math.random() * 30) + 1}${['A','B','C','D','E','F'][Math.floor(Math.random() * 6)]}`,
        totalAmount: 350.00,
        currency: 'USD',
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': `spike-${__VU}-${__ITER}-${Date.now()}`,
        },
      });
      const success = check(res, {
        'booking accepted': (r) => r.status === 201 || r.status === 200 || r.status === 409,
      });
      errorRate.add(!success);
      if (!success) spikeErrors.add(1);
    }
  }

  sleep(0.5 + Math.random() * 1.5); // Random think time 0.5-2s
}

export function handleSummary(data) {
  return {
    'spike-test-summary.json': JSON.stringify(data, null, 2),
  };
}
