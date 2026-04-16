import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../utils/rate-limiter.js";

test("createRateLimiter validates requests per minute", () => {
  assert.throws(() => createRateLimiter(0), /at least 1/);
  assert.throws(() => createRateLimiter(1001), /must not exceed 1000/);
});

test("rate limiter tracks request count in process", async () => {
  const limiter = createRateLimiter(1000, {
    scope: "test.scope",
    groupId: "test-group",
  });

  assert.equal(limiter.getRequestCount(), 0);
  await limiter.checkLimit();
  await limiter.checkLimit();
  assert.equal(limiter.getRequestCount(), 2);
});

test("rate limiter reset clears local counters", async () => {
  const limiter = createRateLimiter(1000);
  await limiter.checkLimit();
  assert.equal(limiter.getRequestCount(), 1);
  limiter.reset();
  assert.equal(limiter.getRequestCount(), 0);
});
