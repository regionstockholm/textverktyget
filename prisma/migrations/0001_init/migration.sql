-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "max_output_tokens" INTEGER NOT NULL,
    "use_web_search" BOOLEAN NOT NULL DEFAULT false,
    "use_thinking" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "global_config" (
    "config_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 2,
    "rewrite_plan_tasks" JSONB,
    "runtime_settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "global_config_pkey" PRIMARY KEY ("config_key")
);

-- CreateTable
CREATE TABLE "task_definitions" (
    "id" SERIAL NOT NULL,
    "task_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "output_mode" TEXT NOT NULL DEFAULT 'rewrite',
    "bullet_count" INTEGER,
    "max_chars" INTEGER,
    "target_audience_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rewrite_plan_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordlista_entries" (
    "id" SERIAL NOT NULL,
    "from_word" TEXT NOT NULL,
    "to_word" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "ordlista_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secrets" (
    "name" TEXT NOT NULL,
    "cipher_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "secrets_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "diff" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompt_templates_name_is_active_idx" ON "prompt_templates"("name", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_name_version_key" ON "prompt_templates"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "task_definitions_task_key_key" ON "task_definitions"("task_key");

-- CreateIndex
CREATE INDEX "task_definitions_enabled_sort_order_idx" ON "task_definitions"("enabled", "sort_order");

-- CreateIndex
CREATE INDEX "task_definitions_sort_order_idx" ON "task_definitions"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "ordlista_entries_from_word_key" ON "ordlista_entries"("from_word");
