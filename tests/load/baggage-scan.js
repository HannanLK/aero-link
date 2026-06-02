import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.API_BASE_URL || 'https://api.aerolink.app';

export const options = {
  scenarios: {
    baggage_handlers: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.005'],
  },
};

function loginAs(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return res.json('accessToken');
}

export default function () {
  const token = loginAs(__ENV.BAGGAGE_HANDLER_EMAIL, __ENV.BAGGAGE_HANDLER_PASSWORD);
  if (!token) return;

  const barcode = `BAG-${randomString(8).toUpperCase()}`;

  const res = http.get(
    `${BASE_URL}/baggage/${barcode}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  // 404 is acceptable for random barcodes in load test
  check(res, { 'baggage lookup responds': (r) => [200, 404].includes(r.status) });
  sleep(0.5);
}
