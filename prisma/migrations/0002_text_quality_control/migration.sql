-- CreateTable
CREATE TABLE IF NOT EXISTS "text_quality_control" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "original_text" TEXT NOT NULL,
    "processed_text" TEXT NOT NULL,
    "prompt_used" TEXT,
    "processing_options" TEXT,
    "rewrite_plan_draft" TEXT,
    "score" DOUBLE PRECISION,
    "iteration" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "text_quality_control_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_text_quality_session" ON "text_quality_control"("session_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_text_quality_status" ON "text_quality_control"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_text_quality_created_at" ON "text_quality_control"("created_at");
