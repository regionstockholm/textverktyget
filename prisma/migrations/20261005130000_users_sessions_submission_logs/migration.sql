CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

CREATE TABLE "user_sessions" (
  "sid" VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);
CREATE INDEX "idx_user_sessions_expire" ON "user_sessions"("expire");

CREATE TABLE "submission_logs" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "submission_logs_created_at_id_idx" ON "submission_logs"("created_at", "id");

CREATE TABLE "submission_log_settings" (
  "key" TEXT PRIMARY KEY,
  "retention_days" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "submission_log_retention_minimum" CHECK ("retention_days" IS NULL OR "retention_days" >= 30)
);
