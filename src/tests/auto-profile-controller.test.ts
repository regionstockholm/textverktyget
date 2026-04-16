import test from "node:test";
import assert from "node:assert/strict";
import {
  createAutoProfileControllerState,
  evaluateAutoProfileTransition,
  resolveAutoProfileConfig,
  type AutoProfileMetrics,
} from "../services/summarize/auto-profile-controller.js";

function createMetrics(overrides: Partial<AutoProfileMetrics> = {}): AutoProfileMetrics {
  return {
    requestCount: 30,
    successRate: 0.95,
    busyRate: 0,
    transientRate: 0,
    p95Ms: 9000,
    queueUtilization: 0.2,
    queueRunning: 2,
    queueQueued: 1,
    ...overrides,
  };
}

function createAutoConfig() {
  return resolveAutoProfileConfig({
    autoProfile: {
      enabled: true,
      mode: "auto",
      currentProfile: "quality",
      minDwellSeconds: 0,
      cooldownSeconds: 0,
      windows: {
        minSamples: 20,
        escalateConsecutive: 2,
        relaxConsecutive: 3,
      },
      thresholds: {
        toBalanced: {
          busyRate: 0.05,
          queueUtil: 0.6,
          p95Ms: 18000,
          transientRate: 0.05,
        },
        toStress: {
          busyRate: 0.15,
          queueUtil: 0.8,
          p95Ms: 30000,
          transientRate: 0.12,
        },
        toQuality: {
          busyRate: 0.02,
          queueUtil: 0.3,
          p95Ms: 12000,
          transientRate: 0.02,
        },
      },
    },
  });
}

test("auto profile escalates from quality to balanced after consecutive windows", () => {
  const resolved = createAutoConfig();
  let state = createAutoProfileControllerState("quality");
  const overloadedMetrics = createMetrics({ busyRate: 0.2 });

  const first = evaluateAutoProfileTransition(state, resolved, overloadedMetrics, 1000);
  assert.equal(first.transitionTo, null);
  assert.equal(first.nextState.escalateStreak, 1);

  state = first.nextState;
  const second = evaluateAutoProfileTransition(
    state,
    resolved,
    overloadedMetrics,
    2000,
  );
  assert.equal(second.transitionTo, "balanced");
});

test("auto profile escalates from balanced to stress on sustained pressure", () => {
  const resolved = createAutoConfig();
  let state = createAutoProfileControllerState("balanced");
  const stressMetrics = createMetrics({ busyRate: 0.3, p95Ms: 45000 });

  const first = evaluateAutoProfileTransition(state, resolved, stressMetrics, 1000);
  assert.equal(first.transitionTo, null);
  assert.equal(first.nextState.escalateStreak, 1);

  state = first.nextState;
  const second = evaluateAutoProfileTransition(state, resolved, stressMetrics, 2000);
  assert.equal(second.transitionTo, "stress");
});

test("auto profile relaxes from stress to balanced after recovery windows", () => {
  const resolved = createAutoConfig();
  let state = createAutoProfileControllerState("stress");
  const recoveredMetrics = createMetrics({
    busyRate: 0.01,
    queueUtilization: 0.1,
    transientRate: 0,
    p95Ms: 8000,
  });

  const first = evaluateAutoProfileTransition(state, resolved, recoveredMetrics, 1000);
  assert.equal(first.transitionTo, null);
  assert.equal(first.nextState.relaxStreak, 1);

  state = first.nextState;
  const second = evaluateAutoProfileTransition(state, resolved, recoveredMetrics, 2000);
  assert.equal(second.transitionTo, null);
  assert.equal(second.nextState.relaxStreak, 2);

  state = second.nextState;
  const third = evaluateAutoProfileTransition(state, resolved, recoveredMetrics, 3000);
  assert.equal(third.transitionTo, "balanced");
});

test("manual mode always enforces manual profile", () => {
  const resolved = resolveAutoProfileConfig({
    autoProfile: {
      enabled: true,
      mode: "manual",
      manualProfile: "stress",
      currentProfile: "quality",
    },
  });
  const state = createAutoProfileControllerState("quality");

  const decision = evaluateAutoProfileTransition(
    state,
    resolved,
    createMetrics(),
    1000,
  );

  assert.equal(decision.transitionTo, "stress");
  assert.equal(decision.reason, "manual_override");
});

test("manual override takes precedence even when auto profile is disabled", () => {
  const resolved = resolveAutoProfileConfig({
    autoProfile: {
      enabled: false,
      mode: "manual",
      manualProfile: "balanced",
      currentProfile: "quality",
    },
  });
  const state = createAutoProfileControllerState("quality");

  const decision = evaluateAutoProfileTransition(
    state,
    resolved,
    createMetrics({ requestCount: 1, busyRate: 0.8 }),
    1000,
  );

  assert.equal(decision.transitionTo, "balanced");
  assert.equal(decision.reason, "manual_override");
});

test("auto mode ignores transitions when sample volume is too low", () => {
  const resolved = createAutoConfig();
  const state = createAutoProfileControllerState("quality");
  const metrics = createMetrics({ requestCount: 5, busyRate: 0.5 });

  const decision = evaluateAutoProfileTransition(state, resolved, metrics, 1000);
  assert.equal(decision.transitionTo, null);
  assert.equal(decision.nextState.escalateStreak, 0);
});

test("auto profile allows escalation even inside dwell window", () => {
  const resolved = createAutoConfig();
  resolved.minDwellMs = 10 * 60 * 1000;

  const state = {
    ...createAutoProfileControllerState("quality"),
    lastTransitionAtMs: 1000,
    escalateStreak: 1,
  };

  const decision = evaluateAutoProfileTransition(
    state,
    resolved,
    createMetrics({ busyRate: 0.2 }),
    2000,
  );

  assert.equal(decision.transitionTo, "balanced");
});

test("auto profile blocks recovery inside dwell window", () => {
  const resolved = createAutoConfig();
  resolved.minDwellMs = 10 * 60 * 1000;

  const state = {
    ...createAutoProfileControllerState("stress"),
    lastTransitionAtMs: 1000,
    relaxStreak: 2,
  };

  const decision = evaluateAutoProfileTransition(
    state,
    resolved,
    createMetrics({ busyRate: 0.01, p95Ms: 7000, queueUtilization: 0.1 }),
    2000,
  );

  assert.equal(decision.transitionTo, null);
});

test("quality escalate streak resets when pressure clears", () => {
  const resolved = createAutoConfig();
  const overloaded = createMetrics({ busyRate: 0.2 });
  const healthy = createMetrics({ busyRate: 0.0, queueUtilization: 0.1, p95Ms: 8000 });

  let state = createAutoProfileControllerState("quality");
  const first = evaluateAutoProfileTransition(state, resolved, overloaded, 1000);
  assert.equal(first.nextState.escalateStreak, 1);

  state = first.nextState;
  const second = evaluateAutoProfileTransition(state, resolved, healthy, 2000);
  assert.equal(second.transitionTo, null);
  assert.equal(second.nextState.escalateStreak, 0);
});

test("stress recovery requires all recovery dimensions to pass", () => {
  const resolved = createAutoConfig();
  let state = createAutoProfileControllerState("stress");

  const almostRecovered = createMetrics({
    busyRate: 0.01,
    queueUtilization: 0.1,
    transientRate: 0.01,
    p95Ms: 13000,
  });

  const decision = evaluateAutoProfileTransition(state, resolved, almostRecovered, 1000);
  assert.equal(decision.transitionTo, null);
  assert.equal(decision.nextState.relaxStreak, 0);

  state = decision.nextState;
  const recovered = createMetrics({
    busyRate: 0.01,
    queueUtilization: 0.1,
    transientRate: 0.01,
    p95Ms: 11000,
  });
  const second = evaluateAutoProfileTransition(state, resolved, recovered, 2000);
  assert.equal(second.nextState.relaxStreak, 1);
});

test("balanced does not escalate to stress on latency-only spike", () => {
  const resolved = createAutoConfig();
  let state = createAutoProfileControllerState("balanced");

  const latencyOnlySpike = createMetrics({
    busyRate: 0,
    queueUtilization: 0,
    transientRate: 0,
    p95Ms: 45000,
  });

  const first = evaluateAutoProfileTransition(
    state,
    resolved,
    latencyOnlySpike,
    1000,
  );
  assert.equal(first.transitionTo, null);
  assert.equal(first.nextState.escalateStreak, 0);

  state = first.nextState;
  const second = evaluateAutoProfileTransition(
    state,
    resolved,
    latencyOnlySpike,
    2000,
  );
  assert.equal(second.transitionTo, null);
  assert.equal(second.nextState.escalateStreak, 0);
});

test("default stress profile keeps quality evaluation enabled", () => {
  const resolved = resolveAutoProfileConfig({
    autoProfile: {
      enabled: true,
    },
  });

  assert.equal(
    (resolved.profileSettings.stress.quality as { enabled?: boolean }).enabled,
    true,
  );
});
