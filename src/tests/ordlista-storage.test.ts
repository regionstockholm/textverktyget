import test from "node:test";
import assert from "node:assert/strict";
import {
  clearOrdlistaEntries,
  createOrdlistaEntry,
  deleteOrdlistaEntry,
  listOrdlistaEntries,
} from "../services/ordlista/ordlista-service.js";
import { ensureDatabaseAvailable } from "./helpers/database-availability.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);
test("ordlista storage CRUD works", { skip: !hasDatabase }, async (t) => {
  if (!(await ensureDatabaseAvailable(t))) {
    return;
  }

  const fromWord = `Term-${Date.now()}`;
  const fromWordTwo = `${fromWord}-two`;

  try {
    const created = await createOrdlistaEntry({
      fromWord,
      toWord: "Replacement",
      updatedBy: "test-admin",
    });
    assert.equal(created.fromWord, fromWord);

    const list = await listOrdlistaEntries();
    assert.ok(list.some((entry) => entry.id === created.id));

    await deleteOrdlistaEntry(created.id);
    const afterDelete = await listOrdlistaEntries();
    assert.ok(afterDelete.every((entry) => entry.id !== created.id));

    await createOrdlistaEntry({
      fromWord: fromWordTwo,
      toWord: "Replacement",
      updatedBy: "test-admin",
    });
    const clearedCount = await clearOrdlistaEntries();
    assert.ok(clearedCount >= 1);
  } finally {
    await clearOrdlistaEntries();
  }
});
