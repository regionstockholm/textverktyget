ALTER TABLE "task_definitions" ADD COLUMN "web_search_mode" TEXT NOT NULL DEFAULT 'inherit';
ALTER TABLE "task_definitions" ADD CONSTRAINT "task_definitions_web_search_mode_check" CHECK ("web_search_mode" IN ('inherit', 'off', 'on'));
