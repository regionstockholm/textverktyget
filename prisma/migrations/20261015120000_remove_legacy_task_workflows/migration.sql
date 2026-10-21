-- Tasks are entirely prompt-driven; no output-mode or task-name-specific workflow.
ALTER TABLE "task_definitions" DROP COLUMN "output_mode";

UPDATE "global_config"
SET "runtime_settings" = "runtime_settings" - 'easyToReadWorkflow' - 'easyToReadLayout',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "runtime_settings" IS NOT NULL;

UPDATE "global_config"
SET "runtime_settings" = jsonb_set("runtime_settings", '{repair}', ("runtime_settings"->'repair') - 'easyToRead'),
    "updated_at" = CURRENT_TIMESTAMP
WHERE jsonb_typeof("runtime_settings"->'repair') = 'object';
