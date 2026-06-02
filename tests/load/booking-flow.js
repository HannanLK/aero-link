import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.API_BASE_URL || 'https://api.aerolink.app';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      tags: { scenario: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      tags: { scenario: 'stress' },
      startTime: '10m',
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<3000', 'p(95)<1500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
};

function register() {
  const email = `loadtest+${randomString(8)}@aerolink-test.com`;
  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email,
      password: 'LoadTest1!',
      firstName: 'Load',
      lastName: 'Test',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'register 201': (r) => r.status === 201 });
  return email;
}

function login(email) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password: 'LoadTest1!' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  return res.json('accessToken');
}

function searchFlights(token) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().split('T')[0];

  const res = http.get(
    `${BASE_URL}/flights/search?origin=SIN&destination=KUL&date=${date}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  check(res, { 'search 200': (r) => r.status === 200 });
  const data = res.json('data');
  return Array.isArray(data) && data.length > 0 ? data[0].id : null;
}

function createBooking(token, flightId) {
  const idempotencyKey = randomString(32);
  const res = http.post(
    `${BASE_URL}/bookings`,
    JSON.stringify({ flightId, seatNumber: `${Math.floor(Math.random() * 30) + 1}A`, totalAmount: 150.0 }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': randomString(16),
      },
    },
  );
  check(res, { 'booking 202': (r) => r.status === 202 });
  return res.json('id');
}

export default function () {
  const email = register();
  const token = login(email);
  if (!token) return;

  const flightId = searchFlights(token);
  if (flightId) {
    const bookingId = createBooking(token, flightId);
    if (bookingId) {
      sleep(2);
      const statusRes = http.get(
        `${BASE_URL}/bookings/${bookingId}/status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      check(statusRes, { 'status 200': (r) => r.status === 200 });
    }
  }

  sleep(1);
}
