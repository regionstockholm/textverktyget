import test from "node:test";
import assert from "node:assert/strict";
import { createCircuitBreaker } from "../utils/circuit-breaker.js";

test("circuit breaker opens after threshold failures", () => {
  const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });

  assert.equal(breaker.allowRequest(), true);
  breaker.recordFailure();
  assert.equal(breaker.allowRequest(), true);

  breaker.recordFailure();
  assert.equal(breaker.allowRequest(), false);

  const snapshot = breaker.getSnapshot();
  assert.equal(snapshot.state, "open");
});

test("circuit breaker closes after successful half-open probe", async () => {
  const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 40 });

  breaker.recordFailure();
  assert.equal(breaker.allowRequest(), false);

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(breaker.allowRequest(), true);

  breaker.recordSuccess();
  assert.equal(breaker.allowRequest(), true);
  assert.equal(breaker.getSnapshot().state, "closed");
});
