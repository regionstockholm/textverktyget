CREATE TABLE "access_logs" (
  "id" SERIAL PRIMARY KEY,
  "session_ref" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "login_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "logout_at" TIMESTAMPTZ(3)
);
CREATE UNIQUE INDEX "access_logs_session_ref_key" ON "access_logs"("session_ref");
CREATE INDEX "access_logs_login_at_id_idx" ON "access_logs"("login_at", "id");
