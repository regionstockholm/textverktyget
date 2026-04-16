import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("prisma schema exists", () => {
  const schemaPath = path.resolve(process.cwd(), "prisma", "schema.prisma");
  assert.equal(fs.existsSync(schemaPath), true);
});

test("prisma schema includes TaskDefinition model", () => {
  const schemaPath = path.resolve(process.cwd(), "prisma", "schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf8");
  assert.equal(schemaContent.includes("model TaskDefinition"), true);
});

test("task definition migration exists", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "prisma",
    "migrations",
    "20260226_task_definition_catalog",
    "migration.sql",
  );
  assert.equal(fs.existsSync(migrationPath), true);
});

test("translation removal migration exists", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "prisma",
    "migrations",
    "20260228_remove_translation_output_mode",
    "migration.sql",
  );
  assert.equal(fs.existsSync(migrationPath), true);
});
