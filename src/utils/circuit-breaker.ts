export type CircuitBreakerState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
}

export interface CircuitBreakerSnapshot {
  state: CircuitBreakerState;
  failureCount: number;
  retryAt: number;
}

export interface CircuitBreaker {
  allowRequest(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  getSnapshot(): CircuitBreakerSnapshot;
}

export function createCircuitBreaker(
  options: CircuitBreakerOptions,
): CircuitBreaker {
  const threshold = Math.max(1, options.failureThreshold);
  const cooldownMs = Math.max(1, options.cooldownMs);

  let state: CircuitBreakerState = "closed";
  let failureCount = 0;
  let retryAt = 0;
  let halfOpenInFlight = 0;

  function allowRequest(): boolean {
    const now = Date.now();

    if (state === "open") {
      if (now < retryAt) {
        return false;
      }

      state = "half_open";
      halfOpenInFlight = 0;
    }

    if (state === "half_open") {
      if (halfOpenInFlight > 0) {
        return false;
      }

      halfOpenInFlight = 1;
      return true;
    }

    return true;
  }

  function recordSuccess(): void {
    state = "closed";
    failureCount = 0;
    retryAt = 0;
    halfOpenInFlight = 0;
  }

  function recordFailure(): void {
    const now = Date.now();

    if (state === "half_open") {
      state = "open";
      retryAt = now + cooldownMs;
      halfOpenInFlight = 0;
      failureCount = threshold;
      return;
    }

    failureCount++;
    if (failureCount >= threshold) {
      state = "open";
      retryAt = now + cooldownMs;
      halfOpenInFlight = 0;
    }
  }

  function getSnapshot(): CircuitBreakerSnapshot {
    return {
      state,
      failureCount,
      retryAt,
    };
  }

  return {
    allowRequest,
    recordSuccess,
    recordFailure,
    getSnapshot,
  };
}
