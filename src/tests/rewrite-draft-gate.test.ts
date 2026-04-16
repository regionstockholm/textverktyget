import test from "node:test";
import assert from "node:assert/strict";
import {
  getRewritePlanTaskKey,
  isEasyToReadTask,
  resolveEasyToReadLayoutConfig,
  resolveEasyToReadQualityDimensionThresholds,
  resolveEasyToReadWorkflowConfig,
  shouldRunRewriteDraft,
} from "../config/ai/summarize-handler.js";
import type { ProcessingOptions } from "../config/ai/ai-service-types.js";

function createOptions(
  taskKey?: string,
  rewritePlanEnabled?: boolean,
): ProcessingOptions {
  return {
    taskKey,
    paragraphCount: "ingress",
    targetAudience: "invånare",
    checkboxContent: "klarspråk",
    rewritePlanEnabled,
  };
}

test("getRewritePlanTaskKey returns trimmed taskKey", () => {
  assert.equal(
    getRewritePlanTaskKey(createOptions("  group-a:four-bullets  ")),
    "group-a:four-bullets",
  );
});

test("getRewritePlanTaskKey returns null without taskKey", () => {
  assert.equal(getRewritePlanTaskKey(createOptions()), null);
});

test("shouldRunRewriteDraft requires taskKey", () => {
  assert.equal(shouldRunRewriteDraft(createOptions()), false);
});

test("shouldRunRewriteDraft respects rewritePlanEnabled false", () => {
  assert.equal(
    shouldRunRewriteDraft(createOptions("group-a:four-bullets", false)),
    false,
  );
});

test("shouldRunRewriteDraft enables when taskKey exists", () => {
  assert.equal(
    shouldRunRewriteDraft(createOptions("group-a:four-bullets", true)),
    true,
  );
});

test("isEasyToReadTask identifies easyToRead by task key", () => {
  assert.equal(isEasyToReadTask(createOptions("easyToRead", true)), true);
  assert.equal(isEasyToReadTask(createOptions("summary:ingress", true)), false);
});

test("resolveEasyToReadWorkflowConfig defaults to disabled", () => {
  const config = resolveEasyToReadWorkflowConfig({});
  assert.deepEqual(config, {
    enabled: false,
    useRewriteDraft: false,
  });
});

test("resolveEasyToReadWorkflowConfig reads runtime flags", () => {
  const config = resolveEasyToReadWorkflowConfig({
    easyToReadWorkflow: {
      enabled: true,
      useRewriteDraft: true,
    },
  });

  assert.deepEqual(config, {
    enabled: true,
    useRewriteDraft: true,
  });
});

test("resolveEasyToReadQualityDimensionThresholds returns undefined for non-easyToRead", () => {
  const thresholds = resolveEasyToReadQualityDimensionThresholds(
    {
      repair: {
        easyToRead: {
          plainLanguageMinSubscore: 9,
          taskFitMinSubscore: 9,
        },
      },
    },
    createOptions("summary:ingress", true),
  );

  assert.equal(thresholds, undefined);
});

test("resolveEasyToReadQualityDimensionThresholds reads runtime easyToRead overrides", () => {
  const thresholds = resolveEasyToReadQualityDimensionThresholds(
    {
      repair: {
        easyToRead: {
          plainLanguageMinSubscore: 9,
          taskFit: 8,
        },
      },
    },
    createOptions("easyToRead", true),
  );

  assert.deepEqual(thresholds, {
    plainLanguage: 9,
    taskFit: 8,
  });
});

test("resolveEasyToReadLayoutConfig defaults to enabled for easyToRead", () => {
  const config = resolveEasyToReadLayoutConfig({}, createOptions("easyToRead", true));

  assert.deepEqual(config, {
    enabled: true,
    maxLineChars: 48,
    maxLinesPerParagraph: 4,
  });
});

test("resolveEasyToReadLayoutConfig reads runtime overrides", () => {
  const config = resolveEasyToReadLayoutConfig(
    {
      easyToReadLayout: {
        enabled: true,
        maxLineChars: 52,
        maxLinesPerParagraph: 3,
      },
    },
    createOptions("easyToRead", true),
  );

  assert.deepEqual(config, {
    enabled: true,
    maxLineChars: 52,
    maxLinesPerParagraph: 3,
  });
});

test("resolveEasyToReadLayoutConfig disables for non-easyToRead tasks", () => {
  const config = resolveEasyToReadLayoutConfig(
    {
      easyToReadLayout: {
        enabled: true,
        maxLineChars: 52,
        maxLinesPerParagraph: 3,
      },
    },
    createOptions("summary:ingress", true),
  );

  assert.deepEqual(config, {
    enabled: false,
    maxLineChars: 48,
    maxLinesPerParagraph: 4,
  });
});
