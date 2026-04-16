import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveTaskSubmissionConfig,
  type TaskCatalogItem,
} from "../client/core/summarizer/task-catalog.js";

function createTask(
  key: string,
  outputMode: TaskCatalogItem["settings"]["outputMode"],
  bulletCount: number | null = null,
): TaskCatalogItem {
  return {
    key,
    label: key,
    description: null,
    sortOrder: 10,
    settings: {
      outputMode,
      bulletCount,
      maxChars: null,
      targetAudienceEnabled: true,
      rewritePlanEnabled: true,
    },
  };
}

test("deriveTaskSubmissionConfig always includes task key", () => {
  const config = deriveTaskSubmissionConfig(createTask("summary:5", "bullets", 5));
  assert.equal(config.taskKey, "summary:5");
  assert.equal(config.targetAudienceEnabled, true);
});

test("deriveTaskSubmissionConfig preserves target-audience support", () => {
  const config = deriveTaskSubmissionConfig(createTask("easyToRead", "rewrite"));
  assert.equal(config.taskKey, "easyToRead");
  assert.equal(config.targetAudienceEnabled, true);
});

test("deriveTaskSubmissionConfig does not derive legacy paragraph count", () => {
  const config = deriveTaskSubmissionConfig(
    createTask("group-a:four-bullets", "bullets", 4),
  );
  assert.deepEqual(Object.keys(config).sort(), [
    "targetAudienceEnabled",
    "taskKey",
  ]);
});

test("deriveTaskSubmissionConfig keeps custom rewrite task key", () => {
  const config = deriveTaskSubmissionConfig(createTask("group-a:rewrite", "rewrite"));
  assert.equal(config.taskKey, "group-a:rewrite");
});
