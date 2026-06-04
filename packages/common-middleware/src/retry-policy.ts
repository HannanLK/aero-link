import { Logger } from '@nestjs/common';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Jitter factor 0-1 to randomize delay (default: 0.2) */
  jitterFactor?: number;
  /** Function to determine if an error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Name for logging */
  operationName?: string;
}

/**
 * Execute an async function with exponential backoff retry.
 *
 * Delay formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 *
 * Example:
 *   retryWithBackoff(() => stripeClient.charges.create(params), {
 *     maxRetries: 3,
 *     operationName: 'stripe-charge',
 *     isRetryable: (e) => e.type === 'StripeConnectionError',
 *   });
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitterFactor = 0.2,
    isRetryable = () => true,
    operationName = 'operation',
  } = options;

  const logger = new Logger(`Retry:${operationName}`);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errMsg = error instanceof Error ? error.message : String(error);

      if (attempt >= maxRetries || !isRetryable(error)) {
        logger.error(`${operationName} failed after ${attempt + 1} attempt(s): ${errMsg}`);
        throw error;
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = exponentialDelay * jitterFactor * Math.random();
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      logger.warn(
        `${operationName} attempt ${attempt + 1}/${maxRetries + 1} failed: ${errMsg}. ` +
        `Retrying in ${Math.round(delay)}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Decorator for NestJS service methods — adds retry with backoff.
 * Usage:
 *   @Retryable({ maxRetries: 3, operationName: 'stripe-charge' })
 *   async chargeCard(...) { ... }
 */
export function Retryable(options: RetryOptions = {}): MethodDecorator {
  return (_target, propertyKey, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const opName = options.operationName ?? String(propertyKey);

    descriptor.value = async function (...args: unknown[]) {
      return retryWithBackoff(() => originalMethod.apply(this, args), {
        ...options,
        operationName: opName,
      });
    };

    return descriptor;
  };
}
