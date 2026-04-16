import test from "node:test";
import assert from "node:assert/strict";
import {
  clearOrdlistaEntries,
  createOrdlistaEntry,
  listOrdlistaEntries,
} from "../services/ordlista/ordlista-service.js";
import { applyWordListReplacements } from "../utils/text/word-list-replacer.js";
import { ensureDatabaseAvailable } from "./helpers/database-availability.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

test("ordlista replacements apply to text", { skip: !hasDatabase }, async (t) => {
  if (!(await ensureDatabaseAvailable(t))) {
    return;
  }

  try {
    await clearOrdlistaEntries();
    await createOrdlistaEntry({
      fromWord: "påbörja",
      toWord: "börja",
      updatedBy: "test-admin",
    });

    const entries = await listOrdlistaEntries();
    const replacements = entries.map((entry) => ({
      term: entry.fromWord,
      replacement: entry.toWord,
    }));

    const input = "Vi ska påbörja arbetet.";
    const output = applyWordListReplacements(input, replacements);
    assert.equal(output.includes("börja"), true);
    assert.equal(output.includes("påbörja"), false);
  } finally {
    await clearOrdlistaEntries();
  }
});

test("ordlista clear disables replacements", { skip: !hasDatabase }, async (t) => {
  if (!(await ensureDatabaseAvailable(t))) {
    return;
  }

  await clearOrdlistaEntries();
  const entries = await listOrdlistaEntries();
  const replacements = entries.map((entry) => ({
    term: entry.fromWord,
    replacement: entry.toWord,
  }));
  const input = "påbörja";
  const output = applyWordListReplacements(input, replacements);
  assert.equal(output, input);
});
