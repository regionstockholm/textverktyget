ALTER TABLE "provider_configs" ADD COLUMN "context_window" INTEGER,
  ADD COLUMN "task_model" TEXT, ADD COLUMN "background_model" TEXT;
UPDATE "global_config" SET "provider" = 'gemini' WHERE "provider" = 'gemini-2.5-flash';
INSERT INTO "provider_configs" ("provider", "model", "temperature", "max_output_tokens", "use_web_search", "use_thinking", "context_window", "task_model", "background_model", "updated_at")
SELECT 'openai', 'gpt-4o', 0.7, 16384, false, false, 128000, 'gpt-5.4', 'gpt-4o', NOW()
WHERE EXISTS (SELECT 1 FROM "global_config" WHERE "provider" = 'openai')
ON CONFLICT ("provider") DO NOTHING;
