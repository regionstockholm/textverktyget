import type { Router } from "express";
import configService from "../../services/config/config-service.js";
import { getPrismaClient } from "../../config/database/prisma-client.js";
import { sendSuccess, sendError } from "../../utils/api/api-responses.js";
import { PROVIDERS, normalizeProviderId, assertProviderConfigured, providerAvailability, validateLlmSettings, type ProviderId } from "../../config/ai/provider-registry.js";
import { generateText } from "../../config/ai/providers/transport.js";
import { listAdminModels, requireModelDefinition } from "../../config/ai/catalog/index.js";

export function registerAdminAiRoutes(router: Router): void {
  const prisma = getPrismaClient();
  router.get("/ai/providers", async (_req, res) => {
    try {
      const providers = await Promise.all((Object.keys(PROVIDERS) as ProviderId[]).map(async provider => ({
        ...providerAvailability(provider), settings: await configService.getProviderConfig(provider),
        models: listAdminModels(provider),
      })));
      const runtime = await configService.getRuntimeSettings();
      sendSuccess(res, { providers, activeProvider: normalizeProviderId(await configService.getActiveProvider()), fallback: runtime.aiFallback, providerRpm: runtime.providerRpm, qualityTemperature: (runtime.quality as { temperature?: number } | undefined)?.temperature ?? 0.3 });
    } catch { sendError(res, 500, "Could not load AI provider settings"); }
  });
  router.get("/ai/providers/:provider/models", async (req, res) => {
    try {
      const provider = normalizeProviderId(String(req.params.provider));
      sendSuccess(res, listAdminModels(provider));
    } catch (error) { sendError(res, 400, error instanceof Error ? error.message : "Could not load the local model catalog"); }
  });
  router.put(["/config/providers/:provider", "/providers/gemini"], async (req, res) => {
    try {
      const provider = normalizeProviderId(String(req.params.provider || "gemini"));
      assertProviderConfigured(provider);
      const settings = validateLlmSettings(provider, req.body);
      const definition = requireModelDefinition(provider, settings.model, settings.modelProfile);
      if (definition.status === "preview" && req.body.allowPreview !== true) throw new Error("Enable preview models explicitly before saving this model");
      const actor = req.header("x-admin-actor") || "admin";
      const qualityTemperature = req.body.qualityTemperature;
      const rpm = req.body.rpm;
      if (rpm !== undefined && (!Number.isInteger(rpm) || rpm < 1 || rpm > 10000)) throw new Error("RPM must be between 1 and 10000");
      const fallbackProvider = req.body.fallbackProvider;
      if (fallbackProvider) {
        const fallback = normalizeProviderId(fallbackProvider);
        assertProviderConfigured(fallback);
        if (fallback === provider) throw new Error("Fallback provider must differ from the active provider");
        const fallbackSettings = await configService.getProviderConfig(fallback);
        if (!fallbackSettings.model) throw new Error("Configure a model for the fallback provider first");
        requireModelDefinition(fallback, fallbackSettings.model, fallbackSettings.modelProfile);
      }
      if (qualityTemperature !== undefined && (typeof qualityTemperature !== "number" || !Number.isFinite(qualityTemperature) || qualityTemperature < 0 || qualityTemperature > 1)) throw new Error("Invalid quality temperature");
      await prisma.$transaction(async tx => {
        await tx.providerConfig.upsert({ where: { provider }, create: { provider, ...settings }, update: settings });
        if (req.body.activate === true) {
          const global = await tx.globalConfig.findUnique({ where: { configKey: "global" } });
          const runtime = { ...((global?.runtimeSettings || {}) as Record<string, unknown>) };
          if (qualityTemperature !== undefined) runtime.quality = { ...((runtime.quality || {}) as Record<string, unknown>), temperature: qualityTemperature };
          if (rpm !== undefined) runtime.providerRpm = { ...((runtime.providerRpm || {}) as Record<string, unknown>), [provider]: rpm };
          if (fallbackProvider !== undefined) runtime.aiFallback = { enabled: Boolean(fallbackProvider), provider: fallbackProvider || null };
          await tx.globalConfig.upsert({ where: { configKey: "global" }, create: { configKey: "global", provider, runtimeSettings: runtime as any, updatedBy: actor }, update: { provider, runtimeSettings: runtime as any, updatedBy: actor } });
        }
        await tx.auditLog.create({ data: { action: "provider.update", actor, entity: "provider_config", entityId: provider, diff: { ...settings, activated: req.body.activate === true } } });
      });
      configService.refresh();
      sendSuccess(res, settings);
    } catch (error) { sendError(res, 400, error instanceof Error ? error.message : "Could not save provider settings"); }
  });
  router.post("/ai/test", async (req, res) => {
    try {
      const provider = normalizeProviderId(req.body?.provider);
      assertProviderConfigured(provider);
      const settings = validateLlmSettings(provider, req.body.settings);
      const started = Date.now();
      await generateText(provider, { ...settings, maxOutputTokens: Math.min(settings.maxOutputTokens, 128), useWebSearch: false, useThinking: false }, "Reply with a short greeting.");
      sendSuccess(res, { provider, model: settings.model, latencyMs: Date.now() - started });
    } catch (error) { sendError(res, 400, error instanceof Error ? error.message : "Connection test failed"); }
  });
}
