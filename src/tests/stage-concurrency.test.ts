import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveStageConcurrencyConfig,
  runWithStageConcurrency,
} from "../services/summarize/stage-concurrency.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("resolveStageConcurrencyConfig reads runtime overrides", () => {
  const config = resolveStageConcurrencyConfig({
    stageConcurrency: {
      analysis: 5,
      rewrite: 7,
      critic: 3,
    },
  });

  assert.equal(config.analysis, 5);
  assert.equal(config.rewrite, 7);
  assert.equal(config.critic, 3);
});

test("runWithStageConcurrency enforces stage limit", async () => {
  const runtimeSettings = {
    stageConcurrency: {
      analysis: 1,
    },
  };

  let running = 0;
  let maxRunning = 0;

  const first = runWithStageConcurrency("analysis", runtimeSettings, async () => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await wait(40);
    running -= 1;
    return "first";
  });

  const second = runWithStageConcurrency("analysis", runtimeSettings, async () => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await wait(5);
    running -= 1;
    return "second";
  });

  const results = await Promise.all([first, second]);

  assert.deepEqual(results, ["first", "second"]);
  assert.equal(maxRunning, 1);
});
