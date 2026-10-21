ALTER TABLE "provider_configs" ADD COLUMN "model_profile" TEXT;
UPDATE "provider_configs" SET "model_profile" = 'generic-local' WHERE "provider" = 'local';
