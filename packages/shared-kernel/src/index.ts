// ─── Value Objects ────────────────────────────────────────────────────────────

export interface Money {
  amount: number;
  currency: string; // ISO 4217
}

export interface FlightNumber {
  value: string; // e.g. "AE-204"
}

// ─── Common DTOs ──────────────────────────────────────────────────────────────

export interface ErrorResponseDto {
  statusCode: number;
  message: string | string[];
  correlationId: string;
  timestamp: string;
  path: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface HealthCheckDto {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  db: 'ok' | 'down';
  redis?: 'ok' | 'down';
  kafka?: 'ok' | 'down';
  timestamp: string;
}

// ─── IATA Codes ───────────────────────────────────────────────────────────────

export function isValidIataCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

// ─── Idempotency ──────────────────────────────────────────────────────────────

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
