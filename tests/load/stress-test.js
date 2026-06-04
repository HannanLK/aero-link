import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8080/api/v1';

// Custom metrics
const bookingErrors = new Counter('booking_errors');
const bookingDuration = new Trend('booking_saga_duration', true);

export const options = {
  scenarios: {
    // Stress test: gradually ramp up to find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },    // Warm up
        { duration: '2m', target: 100 },   // Normal load
        { duration: '2m', target: 200 },   // Above normal
        { duration: '2m', target: 300 },   // Stress level
        { duration: '2m', target: 400 },   // High stress
        { duration: '1m', target: 500 },   // Breaking point
        { duration: '2m', target: 500 },   // Hold at peak
        { duration: '2m', target: 0 },     // Recovery
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],           // < 10% error rate at peak
    http_req_duration: ['p(95)<5000'],        // p95 < 5s even under stress
    booking_errors: ['count<100'],            // Less than 100 total failures
  },
};

export default function () {
  const uniqueId = `stress-${__VU}-${__ITER}-${Date.now()}`;

  // Step 1: Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'passenger@aerolink.app',
    password: 'Demo@2024',
  }), { headers: { 'Content-Type': 'application/json' } });

  if (!check(loginRes, { 'login succeeded': (r) => r.status === 200 })) {
    bookingErrors.add(1);
    sleep(1);
    return;
  }

  const token = loginRes.json('accessToken');
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Step 2: Search flights
  const searchRes = http.get(`${BASE_URL}/flights?origin=LHR&destination=DXB&date=2026-07-01`, {
    headers: authHeaders,
  });

  check(searchRes, {
    'search returned results': (r) => r.status === 200,
  });

  sleep(0.5);

  // Step 3: Attempt booking (concurrent seat contention test)
  const seats = ['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C', '4A'];
  const randomSeat = seats[Math.floor(Math.random() * seats.length)];

  const bookingStart = Date.now();
  const bookRes = http.post(`${BASE_URL}/bookings`, JSON.stringify({
    flightId: 'stress-test-flight-001',
    seatNumber: randomSeat,
    totalAmount: 450.00,
    currency: 'USD',
  }), {
    headers: {
      ...authHeaders,
      'Idempotency-Key': uniqueId,
    },
  });

  const bookingEnd = Date.now();
  bookingDuration.add(bookingEnd - bookingStart);

  if (!check(bookRes, {
    'booking accepted': (r) => r.status === 201 || r.status === 200 || r.status === 409,
  })) {
    bookingErrors.add(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stress-test-summary.json': JSON.stringify(data, null, 2),
  };
}
