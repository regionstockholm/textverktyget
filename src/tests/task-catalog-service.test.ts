import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskKeyBaseFromLabel,
  buildReorderedTaskKeys,
  validateTaskKey,
} from "../services/tasks/task-catalog-service.js";

test("buildTaskKeyBaseFromLabel creates normalized slug", () => {
  assert.equal(
    buildTaskKeyBaseFromLabel("  Förvaltnings ärende: Test!  "),
    "forvaltnings-arende-test",
  );
  assert.equal(buildTaskKeyBaseFromLabel("***"), "task");
});

test("validateTaskKey accepts known legacy keys", () => {
  const summaryKey = validateTaskKey("summary:3");
  const rewriteKey = validateTaskKey("easyToRead");

  assert.equal(summaryKey.valid, true);
  assert.equal(summaryKey.key, "summary:3");
  assert.equal(rewriteKey.valid, true);
  assert.equal(rewriteKey.key, "easyToRead");
});

test("validateTaskKey rejects invalid keys", () => {
  const emptyKey = validateTaskKey("   ");
  const invalidChars = validateTaskKey("bad/key");
  const trailingColon = validateTaskKey("summary:");

  assert.equal(emptyKey.valid, false);
  assert.equal(invalidChars.valid, false);
  assert.equal(trailingColon.valid, false);
});

test("buildReorderedTaskKeys prioritizes given keys and keeps remaining order", () => {
  const result = buildReorderedTaskKeys(
    ["summary:3", "no-change", "easyToRead", "politicalDocuments"],
    ["easyToRead", "summary:3"],
  );

  assert.deepEqual(result, [
    "easyToRead",
    "summary:3",
    "no-change",
    "politicalDocuments",
  ]);
});

test("buildReorderedTaskKeys rejects unknown and duplicate keys", () => {
  assert.throws(
    () => buildReorderedTaskKeys(["summary:3", "no-change"], ["missing"]),
    /Unknown task key/,
  );
  assert.throws(
    () =>
      buildReorderedTaskKeys(["summary:3", "no-change"], ["summary:3", "summary:3"]),
    /Duplicate task key/,
  );
});
