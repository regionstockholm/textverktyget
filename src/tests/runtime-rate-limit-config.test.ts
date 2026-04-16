import test from "node:test";
import assert from "node:assert/strict";
import { resolveRuntimeApiRateLimitConfig } from "../utils/api/rate-limits.js";
import { resolveRuntimeGlobalRateLimit } from "../middleware/api-rate-limiter.js";

test("resolveRuntimeApiRateLimitConfig reads valid runtime overrides", () => {
  const resolved = resolveRuntimeApiRateLimitConfig({
    apiRateLimit: {
      windowMs: 120000,
      standard: 40,
      progress: 240,
      quality: 15,
      summarize: 8,
      fileUpload: 3,
    },
  });

  assert.equal(resolved.windowMs, 120000);
  assert.equal(resolved.standard, 40);
  assert.equal(resolved.progress, 240);
  assert.equal(resolved.quality, 15);
  assert.equal(resolved.summarize, 8);
  assert.equal(resolved.fileUpload, 3);
});

test("resolveRuntimeGlobalRateLimit falls back on invalid values", () => {
  const resolved = resolveRuntimeGlobalRateLimit({
    globalRateLimit: {
      windowMs: -1,
      max: 0,
    },
  });

  assert.equal(resolved.windowMs > 0, true);
  assert.equal(resolved.max > 0, true);
});
