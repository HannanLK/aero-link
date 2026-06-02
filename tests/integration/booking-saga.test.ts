/**
 * Booking Saga Integration Test
 *
 * Tests the full choreography: POST /bookings → Kafka → seat-lock → payment → CONFIRMED
 * Requires a running environment with all services + Kafka.
 *
 * Set API_BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD env vars.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.TEST_USER_EMAIL ?? 'integration@test.local';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? 'Test1234!';

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 30_000;

async function pollUntil<T>(fn: () => Promise<T>, predicate: (v: T) => boolean): Promise<T> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await fn();
    if (predicate(result)) return result;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Polling timed out');
}

describe('Booking Saga — Happy Path', () => {
  let accessToken: string;
  let flightId: string;
  let bookingId: string;

  beforeAll(async () => {
    const loginRes = await axios.post(`${BASE_URL}/api/v1/auth/login`, { email: EMAIL, password: PASSWORD });
    accessToken = loginRes.data.accessToken;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];
    const searchRes = await axios.get(
      `${BASE_URL}/api/v1/flights/search?origin=SIN&destination=KUL&date=${date}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(searchRes.data.data.length).toBeGreaterThan(0);
    flightId = searchRes.data.data[0].id;
  }, 15_000);

  it('creates a booking and it reaches CONFIRMED status', async () => {
    const idempotencyKey = uuidv4();
    const bookingRes = await axios.post(
      `${BASE_URL}/api/v1/bookings`,
      { flightId, seatNumber: '12A', totalAmount: 150.0 },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': uuidv4(),
        },
      },
    );

    expect(bookingRes.status).toBe(202);
    bookingId = bookingRes.data.id;
    expect(bookingId).toBeDefined();

    // Poll for saga completion
    const finalStatus = await pollUntil(
      async () => {
        const res = await axios.get(`${BASE_URL}/api/v1/bookings/${bookingId}/status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return res.data;
      },
      (data) => ['CONFIRMED', 'CANCELLED'].includes(data.status),
    );

    expect(finalStatus.status).toBe('CONFIRMED');
    expect(finalStatus.sagaHistory).toContainEqual(expect.objectContaining({ step: 'SEAT_LOCKED' }));
    expect(finalStatus.sagaHistory).toContainEqual(expect.objectContaining({ step: 'PAYMENT_CONFIRMED' }));
  }, 45_000);

  it('returns the same booking for a duplicate idempotency key', async () => {
    const idempotencyKey = uuidv4();

    const first = await axios.post(
      `${BASE_URL}/api/v1/bookings`,
      { flightId, seatNumber: '13B', totalAmount: 150.0 },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': uuidv4(),
        },
      },
    );
    const second = await axios.post(
      `${BASE_URL}/api/v1/bookings`,
      { flightId, seatNumber: '13B', totalAmount: 150.0 },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': uuidv4(),
        },
      },
    );

    expect(first.data.id).toBe(second.data.id);
  }, 15_000);
});
