import { Logger } from '@nestjs/common';

/**
 * Circuit Breaker States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast without calling the downstream
 * - HALF_OPEN: After cooldown, allows one test request to check if downstream recovered
 *
 * State Machine:
 *   CLOSED --[failure threshold reached]--> OPEN
 *   OPEN   --[cooldown elapsed]----------> HALF_OPEN
 *   HALF_OPEN --[test request succeeds]--> CLOSED
 *   HALF_OPEN --[test request fails]-----> OPEN
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Name for logging (e.g. 'stripe-api', 'ses-email') */
  name: string;
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms to wait before transitioning OPEN → HALF_OPEN (default: 30000) */
  cooldownMs?: number;
  /** Time in ms after which a pending request counts as a failure (default: 10000) */
  timeoutMs?: number;
  /** Number of successful requests in HALF_OPEN before fully closing (default: 2) */
  successThreshold?: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  totalTimeouts: number;
  totalShortCircuits: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttemptTime: Date | null = null;

  // Lifetime metrics
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalTimeouts = 0;
  private totalShortCircuits = 0;

  private readonly logger: Logger;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly timeoutMs: number;
  private readonly successThreshold: number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.logger = new Logger(`CircuitBreaker:${options.name}`);
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.successThreshold = options.successThreshold ?? 2;
  }

  /**
   * Execute a function through the circuit breaker.
   * @param fn The async function to execute
   * @param fallback Optional fallback when circuit is OPEN
   * @throws CircuitBreakerOpenError when circuit is OPEN and no fallback provided
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitBreakerState.OPEN) {
      if (this.nextAttemptTime && new Date() >= this.nextAttemptTime) {
        // Cooldown elapsed → transition to HALF_OPEN
        this.state = CircuitBreakerState.HALF_OPEN;
        this.logger.warn(`Circuit ${this.options.name}: OPEN → HALF_OPEN (testing recovery)`);
      } else {
        // Still in cooldown → fail fast
        this.totalShortCircuits++;
        this.logger.warn(`Circuit ${this.options.name}: OPEN — short-circuiting request`);
        if (fallback) return fallback();
        throw new CircuitBreakerOpenError(this.options.name, this.nextAttemptTime);
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /** Get current circuit breaker metrics */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalTimeouts: this.totalTimeouts,
      totalShortCircuits: this.totalShortCircuits,
    };
  }

  /** Manually reset the circuit breaker to CLOSED */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = null;
    this.logger.log(`Circuit ${this.options.name}: manually reset to CLOSED`);
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.totalTimeouts++;
        reject(new CircuitBreakerTimeoutError(this.options.name, this.timeoutMs));
      }, this.timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = null;
        this.logger.log(`Circuit ${this.options.name}: HALF_OPEN → CLOSED (recovered)`);
      }
    } else {
      // In CLOSED state, reset failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    const errMsg = error instanceof Error ? error.message : String(error);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Test request failed → back to OPEN
      this.state = CircuitBreakerState.OPEN;
      this.successCount = 0;
      this.nextAttemptTime = new Date(Date.now() + this.cooldownMs);
      this.logger.error(`Circuit ${this.options.name}: HALF_OPEN → OPEN (test failed: ${errMsg})`);
    } else if (this.failureCount >= this.failureThreshold) {
      // Failure threshold reached → trip the circuit
      this.state = CircuitBreakerState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.cooldownMs);
      this.logger.error(
        `Circuit ${this.options.name}: CLOSED → OPEN after ${this.failureCount} failures (cooldown: ${this.cooldownMs}ms)`,
      );
    }
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly retryAfter: Date | null,
  ) {
    super(`Circuit breaker '${circuitName}' is OPEN. Retry after ${retryAfter?.toISOString() ?? 'unknown'}.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly timeoutMs: number,
  ) {
    super(`Circuit breaker '${circuitName}' timed out after ${timeoutMs}ms.`);
    this.name = 'CircuitBreakerTimeoutError';
  }
}

/**
 * Pre-configured circuit breaker factory for common AeroLink service patterns.
 */
export class CircuitBreakerFactory {
  private static readonly instances = new Map<string, CircuitBreaker>();

  /** Get or create a circuit breaker for a downstream service */
  static getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.instances.has(name)) {
      this.instances.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.instances.get(name)!;
  }

  /** Get metrics for all circuit breakers (for admin dashboard) */
  static getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, cb] of this.instances) {
      metrics[name] = cb.getMetrics();
    }
    return metrics;
  }

  /** Reset all circuit breakers (for testing) */
  static resetAll(): void {
    for (const cb of this.instances.values()) {
      cb.reset();
    }
  }
}
