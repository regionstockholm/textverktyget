import { readRuntimeInteger } from "../../../utils/runtime-number.js";
import {
  DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
  DEFAULT_GEMINI_QE_TEMPERATURE,
  DEFAULT_RUNTIME_API_QUALITY,
  DEFAULT_RUNTIME_API_STANDARD,
  DEFAULT_RUNTIME_API_SUMMARIZE,
  DEFAULT_RUNTIME_API_UPLOAD,
  DEFAULT_RUNTIME_API_WINDOW_MS,
  DEFAULT_RUNTIME_AUTO_COOLDOWN_SECONDS,
  DEFAULT_RUNTIME_AUTO_DRY_RUN,
  DEFAULT_RUNTIME_AUTO_ENABLED,
  DEFAULT_RUNTIME_AUTO_ESCALATE_CONSECUTIVE,
  DEFAULT_RUNTIME_AUTO_EVALUATE_SECONDS,
  DEFAULT_RUNTIME_AUTO_MANUAL_PROFILE,
  DEFAULT_RUNTIME_AUTO_MIN_DWELL_SECONDS,
  DEFAULT_RUNTIME_AUTO_MIN_SAMPLES,
  DEFAULT_RUNTIME_AUTO_MODE,
  DEFAULT_RUNTIME_AUTO_RELAX_CONSECUTIVE,
  DEFAULT_RUNTIME_AUTO_WINDOW_SECONDS,
  DEFAULT_RUNTIME_GLOBAL_MAX,
  DEFAULT_RUNTIME_GLOBAL_WINDOW_MS,
  DEFAULT_RUNTIME_PROVIDER_RPM_GEMINI,
  DEFAULT_RUNTIME_PROVIDER_RPM_OPENAI,
  DEFAULT_RUNTIME_QUEUE_CONCURRENT,
  DEFAULT_RUNTIME_QUEUE_RETRY_AFTER,
  DEFAULT_RUNTIME_QUEUE_SIZE,
  DEFAULT_RUNTIME_QUEUE_WAIT_MS,
  DEFAULT_RUNTIME_REPAIR_BUDGET,
  DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE,
  DEFAULT_RUNTIME_RETRY_PROVIDER_MAX,
  DEFAULT_RUNTIME_RETRY_QUALITY_MAX,
  DEFAULT_RUNTIME_STAGE_ANALYSIS,
  DEFAULT_RUNTIME_STAGE_CRITIC,
  DEFAULT_RUNTIME_STAGE_REWRITE,
  DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB,
} from "../admin_constants.js";
import type { AdminContext } from "../admin_context.js";
import type { GeminiConfig, GlobalConfig, RuntimeSettings } from "../admin_types.js";
import {
  cloneRuntimeSettings,
  getRuntimeObject,
  parseIntegerField,
  readRecord,
  readRuntimeBoolean,
  readRuntimeQualityTemperature,
  resolveRuntimeSettings,
} from "../admin_utils.js";

export type RuntimeSettingsPanel = {
  init(): void;
  applyConfig(globalConfig?: GlobalConfig, geminiConfig?: GeminiConfig): void;
  getRuntimeSettings(): RuntimeSettings;
  setRuntimeSettingsEditor(value: unknown): void;
  saveRuntimeSettingsValue(runtimeSettings: RuntimeSettings): Promise<RuntimeSettings>;
  updateRuntimeSettings(
    update: (runtimeSettings: RuntimeSettings) => void,
  ): Promise<RuntimeSettings>;
};

type RuntimeSource = Record<string, unknown>;

export function initRuntimeSettingsPanel(
  context: AdminContext,
): RuntimeSettingsPanel {
  const { refs, request, state, feedback } = context;
  const { setStatus, showHint, showButtonHint } = feedback;

  const setRetryCurrentLabel = (value: unknown): void => {
    setValueLabel(refs.globalRetryCurrent, "Nuvarande", value);
  };

  const setRetrySelectedLabel = (value: unknown): void => {
    setValueLabel(refs.globalRetrySelected, "Vald", value);
  };

  const setQualityAttemptsCurrentLabel = (value: unknown): void => {
    setValueLabel(refs.globalQualityAttemptsCurrent, "Nuvarande", value);
  };

  const setQualityAttemptsSelectedLabel = (value: unknown): void => {
    setValueLabel(refs.globalQualityAttemptsSelected, "Vald", value);
  };

  const setRepairBudgetCurrentLabel = (value: unknown): void => {
    setValueLabel(refs.globalRepairBudgetCurrent, "Nuvarande", value);
  };

  const setRepairBudgetSelectedLabel = (value: unknown): void => {
    setValueLabel(refs.globalRepairBudgetSelected, "Vald", value);
  };

  const setRuntimeRepairMinSubscoreCurrent = (value: unknown): void => {
    const clamped = clampInteger(value, DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE, 1, 10);
    refs.runtimeRepairMinSubscore.value = String(clamped);
    refs.runtimeRepairMinSubscoreCurrent.textContent = `Nuvarande: ${clamped}`;
  };

  const setRuntimeRepairMinSubscoreSelected = (value: unknown): void => {
    const clamped = clampInteger(value, DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE, 1, 10);
    refs.runtimeRepairMinSubscoreSelected.textContent = `Vald: ${clamped}`;
  };

  const setRuntimeUploadMaxSizeCurrent = (value: unknown): void => {
    const clamped = clampInteger(value, DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB, 1, 100);
    refs.runtimeUploadMaxSizeMb.value = String(clamped);
    refs.runtimeUploadMaxSizeMbCurrent.textContent = `Nuvarande: ${clamped} MB`;
  };

  const setRuntimeUploadMaxSizeSelected = (value: unknown): void => {
    const clamped = clampInteger(value, DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB, 1, 100);
    refs.runtimeUploadMaxSizeMbSelected.textContent = `Vald: ${clamped} MB`;
  };

  const setGeminiTemperature = (value: unknown): void => {
    const formatted = formatTemperature(value, 0.7);
    refs.geminiTemp.value = formatted;
    refs.geminiTempValue.textContent = `Nuvarande: ${formatted}`;
  };

  const setGeminiTemperatureSelected = (value: unknown): void => {
    refs.geminiTempSelected.textContent = `Vald: ${formatTemperature(value, 0.7)}`;
  };

  const setGeminiQeTemperature = (value: unknown): void => {
    const formatted = formatTemperature(value, DEFAULT_GEMINI_QE_TEMPERATURE);
    refs.geminiQeTemp.value = formatted;
    refs.geminiQeTempValue.textContent = `Nuvarande: ${formatted}`;
  };

  const setGeminiQeTemperatureSelected = (value: unknown): void => {
    refs.geminiQeTempSelected.textContent = `Vald: ${formatTemperature(
      value,
      DEFAULT_GEMINI_QE_TEMPERATURE,
    )}`;
  };

  const setRuntimeSettingsFields = (runtimeSettings: RuntimeSettings): void => {
    const sources = getRuntimeSources(runtimeSettings);
    setProviderRateLimits(sources.providerRpm);
    setGlobalRateLimits(sources.globalRateLimit);
    setApiRateLimits(sources.apiRateLimit);
    setQueueFields(sources.summarizeQueue);
    setUploadFields(sources.uploadSettings);
    setStageFields(sources.stageConcurrency);
    setRetryAndRepairFields(sources.retrySettings, sources.repairSettings);
    setAutoProfileFields(sources.autoProfile, sources.autoWindows);
    setEasyReadWorkflowFields(sources.easyToReadWorkflow);
  };

  const buildRuntimeSettingsFromFields = (): RuntimeSettings => {
    const next = cloneRuntimeSettings(state.runtimeSettings);
    writeProviderRateLimits(next);
    writeGlobalRateLimits(next);
    writeApiRateLimits(next);
    writeQueueFields(next);
    writeUploadFields(next);
    writeStageFields(next);
    writeRetryAndRepairFields(next);
    writeAutoProfileFields(next);
    return next;
  };

  const setRuntimeSettingsEditor = (value: unknown): void => {
    const runtimeSettings = resolveRuntimeSettings(value);
    state.runtimeSettings = runtimeSettings;
    setRuntimeSettingsFields(runtimeSettings);
    refs.runtimeSettingsJson.value = JSON.stringify(runtimeSettings, null, 2);

    const qualityTemperature = readRuntimeQualityTemperature(runtimeSettings);
    setGeminiQeTemperature(qualityTemperature);
    setGeminiQeTemperatureSelected(qualityTemperature);
  };

  const applyConfig = (
    globalConfig?: GlobalConfig,
    geminiConfig?: GeminiConfig,
  ): void => {
    applyGeminiConfig(geminiConfig);
    applyGlobalConfig(globalConfig);
  };

  const getRuntimeSettings = (): RuntimeSettings => state.runtimeSettings;

  const saveRuntimeSettingsValue = async (
    runtimeSettings: RuntimeSettings,
  ): Promise<RuntimeSettings> => {
    const data = await request<{ runtimeSettings?: RuntimeSettings }>(
      "PUT",
      "/admin/runtime-settings",
      { runtimeSettings },
    );
    const saved = data?.runtimeSettings ?? runtimeSettings;
    setRuntimeSettingsEditor(saved);
    return saved;
  };

  const updateRuntimeSettings = async (
    update: (runtimeSettings: RuntimeSettings) => void,
  ): Promise<RuntimeSettings> => {
    const runtimeSettings = cloneRuntimeSettings(state.runtimeSettings);
    update(runtimeSettings);
    return saveRuntimeSettingsValue(runtimeSettings);
  };

  const saveGlobalConfig = async (): Promise<void> => {
    let globalSaved = false;
    try {
      setStatus("Sparar global konfiguration...");

      const provider = refs.globalProvider.value;
      const retryCount = readBoundedInput(
        refs.globalRetry,
        "Antal retries måste vara mellan 1 och 10.",
        1,
        10,
        refs.saveGlobalButton,
      );
      const qualityMaxAttempts = readBoundedInput(
        refs.globalQualityAttempts,
        "Kvalitetsvarv måste vara mellan 1 och 10.",
        1,
        10,
        refs.saveGlobalButton,
      );
      const repairBudget = readBoundedInput(
        refs.globalRepairBudget,
        "Polering per varv måste vara mellan 1 och 10.",
        1,
        10,
        refs.saveGlobalButton,
      );

      if (
        retryCount === null ||
        qualityMaxAttempts === null ||
        repairBudget === null
      ) {
        return;
      }

      const data = await request<GlobalConfig>("PUT", "/admin/config/global", {
        provider,
        retryCount,
      });
      globalSaved = true;

      await updateRuntimeSettings((runtimeSettings) => {
        getRuntimeObject(runtimeSettings, "retry").qualityMaxAttempts =
          qualityMaxAttempts;
        getRuntimeObject(runtimeSettings, "repair").budget = repairBudget;
      });

      const savedRetry = data?.retryCount ?? retryCount;
      refs.globalRetry.value = String(savedRetry);
      setRetryCurrentLabel(savedRetry);
      setRetrySelectedLabel(savedRetry);
      refs.globalQualityAttempts.value = String(qualityMaxAttempts);
      setQualityAttemptsCurrentLabel(qualityMaxAttempts);
      setQualityAttemptsSelectedLabel(qualityMaxAttempts);
      refs.globalRepairBudget.value = String(repairBudget);
      setRepairBudgetCurrentLabel(repairBudget);
      setRepairBudgetSelectedLabel(repairBudget);
      setStatus("Global konfiguration sparad.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveGlobalButton, "Sparat.", "success");
    } catch (error) {
      if (globalSaved) {
        setStatus(
          "Global konfiguration sparades, men runtime-inställningar för försök kunde inte sparas.",
        );
        showButtonHint(refs.saveGlobalButton, "Delvis sparat.", "error");
        return;
      }
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara global konfiguration.",
      );
      showButtonHint(refs.saveGlobalButton, "Fel.", "error");
    }
  };

  const saveRuntimeSettingsFields = async (): Promise<void> => {
    try {
      setStatus("Sparar nyckelinställningar...");
      const runtimeSettings = buildRuntimeSettingsFromFields();
      await saveRuntimeSettingsValue(runtimeSettings);
      setStatus("Nyckelinställningar sparade.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveRuntimeSettingsFieldsButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara nyckelinställningar.",
      );
      showButtonHint(refs.saveRuntimeSettingsFieldsButton, "Fel.", "error");
    }
  };

  const saveRuntimeSettings = async (): Promise<void> => {
    try {
      setStatus("Sparar runtime-inställningar...");
      const runtimeSettings = parseRuntimeSettingsEditor();
      if (!runtimeSettings) {
        return;
      }

      await saveRuntimeSettingsValue(runtimeSettings);
      setStatus("Runtime-inställningar sparade.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveRuntimeSettingsButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara runtime-inställningar.",
      );
      showButtonHint(refs.saveRuntimeSettingsButton, "Fel.", "error");
    }
  };

  const saveGeminiConfig = async (): Promise<void> => {
    let providerSaved = false;
    try {
      setStatus("Sparar Gemini-konfiguration...");
      const payload = readGeminiConfigPayload();
      if (!payload) {
        return;
      }

      const data = await request<GeminiConfig>(
        "PUT",
        "/admin/providers/gemini",
        payload.provider,
      );
      providerSaved = true;

      await updateRuntimeSettings((runtimeSettings) => {
        getRuntimeObject(runtimeSettings, "quality").temperature =
          payload.qualityTemperature;
      });

      applySavedGeminiConfig(data);
      setStatus("Gemini-konfiguration sparad.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveGeminiButton, "Sparat.", "success");
    } catch (error) {
      setGeminiSaveError(providerSaved, error);
    }
  };

  const init = (): void => {
    refs.saveGlobalButton.addEventListener("click", () => {
      saveGlobalConfig();
    });
    refs.saveRuntimeSettingsFieldsButton.addEventListener("click", () => {
      saveRuntimeSettingsFields();
    });
    refs.saveRuntimeSettingsButton.addEventListener("click", () => {
      saveRuntimeSettings();
    });
    refs.saveGeminiButton.addEventListener("click", () => {
      saveGeminiConfig();
    });
    refs.geminiTemp.addEventListener("input", () => {
      setGeminiTemperatureSelected(refs.geminiTemp.value);
    });
    refs.geminiQeTemp.addEventListener("input", () => {
      setGeminiQeTemperatureSelected(refs.geminiQeTemp.value);
    });
    refs.globalRetry.addEventListener("input", () => {
      setRetrySelectedLabel(refs.globalRetry.value);
    });
    refs.globalQualityAttempts.addEventListener("input", () => {
      setQualityAttemptsSelectedLabel(refs.globalQualityAttempts.value);
    });
    refs.globalRepairBudget.addEventListener("input", () => {
      setRepairBudgetSelectedLabel(refs.globalRepairBudget.value);
    });
    refs.runtimeRepairMinSubscore.addEventListener("input", () => {
      setRuntimeRepairMinSubscoreSelected(refs.runtimeRepairMinSubscore.value);
    });
    refs.runtimeUploadMaxSizeMb.addEventListener("input", () => {
      setRuntimeUploadMaxSizeSelected(refs.runtimeUploadMaxSizeMb.value);
    });
  };

  function setValueLabel(
    element: HTMLElement,
    prefix: "Nuvarande" | "Vald",
    value: unknown,
  ): void {
    const text = value === null || value === undefined || String(value).trim() === ""
      ? "-"
      : String(value);
    element.textContent = `${prefix}: ${text}`;
  }

  function clampInteger(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(max, Math.max(min, Math.round(safeValue)));
  }

  function formatTemperature(value: unknown, fallback: number): string {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(1, Math.max(0, safeValue)).toFixed(1);
  }

  function setInputValue(
    input: HTMLInputElement,
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ): void {
    input.value = String(readRuntimeInteger(value, fallback, min, max));
  }

  function getRuntimeSources(runtimeSettings: RuntimeSettings) {
    const autoProfile = readRecord(runtimeSettings.autoProfile);
    return {
      providerRpm: readRecord(runtimeSettings.providerRpm),
      globalRateLimit: readRecord(runtimeSettings.globalRateLimit),
      apiRateLimit: readRecord(runtimeSettings.apiRateLimit),
      summarizeQueue: readRecord(runtimeSettings.summarizeQueue),
      uploadSettings: readRecord(runtimeSettings.upload),
      stageConcurrency: readRecord(runtimeSettings.stageConcurrency),
      retrySettings: readRecord(runtimeSettings.retry),
      repairSettings: readRecord(runtimeSettings.repair),
      autoProfile,
      autoWindows: readRecord(autoProfile.windows),
      easyToReadWorkflow: readRecord(runtimeSettings.easyToReadWorkflow),
    };
  }

  function setProviderRateLimits(source: RuntimeSource): void {
    setInputValue(
      refs.runtimeProviderRpmGemini,
      source.gemini,
      DEFAULT_RUNTIME_PROVIDER_RPM_GEMINI,
      1,
      10000,
    );
    setInputValue(
      refs.runtimeProviderRpmOpenai,
      source.openai,
      DEFAULT_RUNTIME_PROVIDER_RPM_OPENAI,
      1,
      10000,
    );
  }

  function setGlobalRateLimits(source: RuntimeSource): void {
    setInputValue(
      refs.runtimeGlobalWindowMs,
      source.windowMs,
      DEFAULT_RUNTIME_GLOBAL_WINDOW_MS,
      1000,
      60 * 60 * 1000,
    );
    setInputValue(refs.runtimeGlobalMax, source.max, DEFAULT_RUNTIME_GLOBAL_MAX, 1, 1000);
  }

  function setApiRateLimits(source: RuntimeSource): void {
    setInputValue(
      refs.runtimeApiWindowMs,
      source.windowMs,
      DEFAULT_RUNTIME_API_WINDOW_MS,
      1000,
      60 * 60 * 1000,
    );
    setInputValue(refs.runtimeApiStandard, source.standard, DEFAULT_RUNTIME_API_STANDARD, 1, 10000);
    setInputValue(refs.runtimeApiQuality, source.quality, DEFAULT_RUNTIME_API_QUALITY, 1, 10000);
    setInputValue(refs.runtimeApiSummarize, source.summarize, DEFAULT_RUNTIME_API_SUMMARIZE, 1, 10000);
    setInputValue(refs.runtimeApiUpload, source.fileUpload, DEFAULT_RUNTIME_API_UPLOAD, 1, 10000);
  }

  function setQueueFields(source: RuntimeSource): void {
    setInputValue(refs.runtimeQueueConcurrent, source.maxConcurrentJobs, DEFAULT_RUNTIME_QUEUE_CONCURRENT, 1, 200);
    setInputValue(refs.runtimeQueueSize, source.maxQueueSize, DEFAULT_RUNTIME_QUEUE_SIZE, 1, 5000);
    setInputValue(refs.runtimeQueueWaitMs, source.maxWaitMs, DEFAULT_RUNTIME_QUEUE_WAIT_MS, 1000, 300000);
    setInputValue(refs.runtimeQueueRetryAfter, source.retryAfterSeconds, DEFAULT_RUNTIME_QUEUE_RETRY_AFTER, 1, 300);
  }

  function setUploadFields(source: RuntimeSource): void {
    const uploadMaxSize = readRuntimeInteger(
      source.maxFileSizeMB,
      DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB,
      1,
      100,
    );
    setRuntimeUploadMaxSizeCurrent(uploadMaxSize);
    setRuntimeUploadMaxSizeSelected(uploadMaxSize);
  }

  function setStageFields(source: RuntimeSource): void {
    setInputValue(refs.runtimeStageAnalysis, source.analysis, DEFAULT_RUNTIME_STAGE_ANALYSIS, 1, 200);
    setInputValue(refs.runtimeStageRewrite, source.rewrite, DEFAULT_RUNTIME_STAGE_REWRITE, 1, 200);
    setInputValue(refs.runtimeStageCritic, source.critic, DEFAULT_RUNTIME_STAGE_CRITIC, 1, 200);
  }

  function setRetryAndRepairFields(
    retrySettings: RuntimeSource,
    repairSettings: RuntimeSource,
  ): void {
    setInputValue(
      refs.runtimeRetryProviderMax,
      retrySettings.providerMaxRetries,
      DEFAULT_RUNTIME_RETRY_PROVIDER_MAX,
      0,
      20,
    );

    const retryFallback = Number.parseInt(refs.globalRetry.value, 10);
    const qualityMaxAttempts = readRuntimeInteger(
      retrySettings.qualityMaxAttempts,
      Number.isInteger(retryFallback) && retryFallback >= 1
        ? retryFallback
        : DEFAULT_RUNTIME_RETRY_QUALITY_MAX,
      1,
      10,
    );
    refs.globalQualityAttempts.value = String(qualityMaxAttempts);
    setQualityAttemptsCurrentLabel(qualityMaxAttempts);
    setQualityAttemptsSelectedLabel(qualityMaxAttempts);

    const repairBudget = readRuntimeInteger(
      repairSettings.budget,
      DEFAULT_RUNTIME_REPAIR_BUDGET,
      1,
      10,
    );
    refs.globalRepairBudget.value = String(repairBudget);
    setRepairBudgetCurrentLabel(repairBudget);
    setRepairBudgetSelectedLabel(repairBudget);

    const minSubscore = readRuntimeInteger(
      repairSettings.minSubscore,
      DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE,
      1,
      10,
    );
    setRuntimeRepairMinSubscoreCurrent(minSubscore);
    setRuntimeRepairMinSubscoreSelected(minSubscore);
  }

  function setAutoProfileFields(
    autoProfile: RuntimeSource,
    autoWindows: RuntimeSource,
  ): void {
    refs.runtimeAutoEnabled.checked = readRuntimeBoolean(
      autoProfile.enabled,
      DEFAULT_RUNTIME_AUTO_ENABLED,
    );
    refs.runtimeAutoMode.value =
      autoProfile.mode === "manual" || autoProfile.mode === "auto"
        ? autoProfile.mode
        : DEFAULT_RUNTIME_AUTO_MODE;
    refs.runtimeAutoManualProfile.value =
      autoProfile.manualProfile === "quality" ||
      autoProfile.manualProfile === "balanced" ||
      autoProfile.manualProfile === "stress"
        ? autoProfile.manualProfile
        : DEFAULT_RUNTIME_AUTO_MANUAL_PROFILE;
    refs.runtimeAutoDryRun.checked = readRuntimeBoolean(
      autoProfile.dryRun,
      DEFAULT_RUNTIME_AUTO_DRY_RUN,
    );
    setInputValue(refs.runtimeAutoEvaluateSeconds, autoProfile.evaluateEverySeconds, DEFAULT_RUNTIME_AUTO_EVALUATE_SECONDS, 5, 300);
    setInputValue(refs.runtimeAutoWindowSeconds, autoProfile.windowSeconds, DEFAULT_RUNTIME_AUTO_WINDOW_SECONDS, 10, 900);
    setInputValue(refs.runtimeAutoMinDwellSeconds, autoProfile.minDwellSeconds, DEFAULT_RUNTIME_AUTO_MIN_DWELL_SECONDS, 0, 3600);
    setInputValue(refs.runtimeAutoCooldownSeconds, autoProfile.cooldownSeconds, DEFAULT_RUNTIME_AUTO_COOLDOWN_SECONDS, 0, 3600);
    setInputValue(refs.runtimeAutoMinSamples, autoWindows.minSamples, DEFAULT_RUNTIME_AUTO_MIN_SAMPLES, 1, 5000);
    setInputValue(refs.runtimeAutoEscalateConsecutive, autoWindows.escalateConsecutive, DEFAULT_RUNTIME_AUTO_ESCALATE_CONSECUTIVE, 1, 20);
    setInputValue(refs.runtimeAutoRelaxConsecutive, autoWindows.relaxConsecutive, DEFAULT_RUNTIME_AUTO_RELAX_CONSECUTIVE, 1, 50);
  }

  function setEasyReadWorkflowFields(source: RuntimeSource): void {
    refs.easyReadWorkflowEnabled.checked = readRuntimeBoolean(source.enabled, false);
    refs.easyReadWorkflowUseRewriteDraft.checked = readRuntimeBoolean(
      source.useRewriteDraft,
      false,
    );
  }

  function writeInteger(
    target: Record<string, unknown>,
    key: string,
    input: HTMLInputElement,
    label: string,
    min: number,
    max: number,
  ): void {
    target[key] = parseIntegerField(input, label, min, max);
  }

  function writeProviderRateLimits(next: RuntimeSettings): void {
    const providerRpm = getRuntimeObject(next, "providerRpm");
    writeInteger(providerRpm, "gemini", refs.runtimeProviderRpmGemini, "Gemini RPM", 1, 10000);
    writeInteger(providerRpm, "openai", refs.runtimeProviderRpmOpenai, "OpenAI RPM", 1, 10000);
  }

  function writeGlobalRateLimits(next: RuntimeSettings): void {
    const globalRateLimit = getRuntimeObject(next, "globalRateLimit");
    writeInteger(globalRateLimit, "windowMs", refs.runtimeGlobalWindowMs, "Global window", 1000, 60 * 60 * 1000);
    writeInteger(globalRateLimit, "max", refs.runtimeGlobalMax, "Global max", 1, 1000);
  }

  function writeApiRateLimits(next: RuntimeSettings): void {
    const apiRateLimit = getRuntimeObject(next, "apiRateLimit");
    writeInteger(apiRateLimit, "windowMs", refs.runtimeApiWindowMs, "Route window", 1000, 60 * 60 * 1000);
    writeInteger(apiRateLimit, "standard", refs.runtimeApiStandard, "Route standard", 1, 10000);
    writeInteger(apiRateLimit, "quality", refs.runtimeApiQuality, "Route quality", 1, 10000);
    writeInteger(apiRateLimit, "summarize", refs.runtimeApiSummarize, "Route summarize", 1, 10000);
    writeInteger(apiRateLimit, "fileUpload", refs.runtimeApiUpload, "Route upload", 1, 10000);
  }

  function writeQueueFields(next: RuntimeSettings): void {
    const queue = getRuntimeObject(next, "summarizeQueue");
    writeInteger(queue, "maxConcurrentJobs", refs.runtimeQueueConcurrent, "Queue max concurrent", 1, 200);
    writeInteger(queue, "maxQueueSize", refs.runtimeQueueSize, "Queue max size", 1, 5000);
    writeInteger(queue, "maxWaitMs", refs.runtimeQueueWaitMs, "Queue max wait", 1000, 300000);
    writeInteger(queue, "retryAfterSeconds", refs.runtimeQueueRetryAfter, "Queue Retry-After", 1, 300);
  }

  function writeUploadFields(next: RuntimeSettings): void {
    const upload = getRuntimeObject(next, "upload");
    writeInteger(upload, "maxFileSizeMB", refs.runtimeUploadMaxSizeMb, "Upload max size", 1, 100);
  }

  function writeStageFields(next: RuntimeSettings): void {
    const stage = getRuntimeObject(next, "stageConcurrency");
    writeInteger(stage, "analysis", refs.runtimeStageAnalysis, "Stage analysis", 1, 200);
    writeInteger(stage, "rewrite", refs.runtimeStageRewrite, "Stage rewrite", 1, 200);
    writeInteger(stage, "critic", refs.runtimeStageCritic, "Stage critic", 1, 200);
  }

  function writeRetryAndRepairFields(next: RuntimeSettings): void {
    const retry = getRuntimeObject(next, "retry");
    writeInteger(retry, "providerMaxRetries", refs.runtimeRetryProviderMax, "Provider max retries", 0, 20);
    writeInteger(retry, "qualityMaxAttempts", refs.globalQualityAttempts, "Quality max attempts", 1, 10);

    const repair = getRuntimeObject(next, "repair");
    writeInteger(repair, "budget", refs.globalRepairBudget, "Repair budget", 1, 10);
    writeInteger(repair, "minSubscore", refs.runtimeRepairMinSubscore, "Quality min subscore", 1, 10);
  }

  function writeAutoProfileFields(next: RuntimeSettings): void {
    const autoProfile = getRuntimeObject(next, "autoProfile");
    autoProfile.enabled = refs.runtimeAutoEnabled.checked;
    autoProfile.mode = refs.runtimeAutoMode.value === "manual" ? "manual" : "auto";
    autoProfile.manualProfile = readManualProfile();
    autoProfile.dryRun = refs.runtimeAutoDryRun.checked;
    writeInteger(autoProfile, "evaluateEverySeconds", refs.runtimeAutoEvaluateSeconds, "Auto evaluate interval", 5, 300);
    writeInteger(autoProfile, "windowSeconds", refs.runtimeAutoWindowSeconds, "Auto metrics window", 10, 900);
    writeInteger(autoProfile, "minDwellSeconds", refs.runtimeAutoMinDwellSeconds, "Auto min dwell", 0, 3600);
    writeInteger(autoProfile, "cooldownSeconds", refs.runtimeAutoCooldownSeconds, "Auto cooldown", 0, 3600);

    const autoWindows = readRecord(autoProfile.windows);
    writeInteger(autoWindows, "minSamples", refs.runtimeAutoMinSamples, "Auto min samples", 1, 5000);
    writeInteger(autoWindows, "escalateConsecutive", refs.runtimeAutoEscalateConsecutive, "Auto escalate consecutive", 1, 20);
    writeInteger(autoWindows, "relaxConsecutive", refs.runtimeAutoRelaxConsecutive, "Auto relax consecutive", 1, 50);
    autoProfile.windows = autoWindows;
  }

  function readManualProfile(): string {
    return refs.runtimeAutoManualProfile.value === "balanced" ||
      refs.runtimeAutoManualProfile.value === "stress"
      ? refs.runtimeAutoManualProfile.value
      : "quality";
  }

  function applyGeminiConfig(geminiConfig?: GeminiConfig): void {
    if (!geminiConfig) {
      refs.geminiModel.value = "";
      refs.geminiMax.value = String(DEFAULT_GEMINI_MAX_OUTPUT_TOKENS);
      refs.geminiUseSearch.checked = false;
      refs.geminiUseThinking.checked = true;
      setGeminiTemperature(0.7);
      setGeminiTemperatureSelected(0.7);
      return;
    }

    refs.geminiModel.value = geminiConfig.model || "";
    refs.geminiMax.value = String(
      geminiConfig.maxOutputTokens ?? DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
    );
    refs.geminiUseSearch.checked = Boolean(geminiConfig.useWebSearch);
    refs.geminiUseThinking.checked =
      geminiConfig.useThinking !== undefined
        ? Boolean(geminiConfig.useThinking)
        : true;
    setGeminiTemperature(geminiConfig.temperature ?? 0.7);
    setGeminiTemperatureSelected(geminiConfig.temperature ?? 0.7);
  }

  function applyGlobalConfig(globalConfig?: GlobalConfig): void {
    const retryCount = readGlobalRetryCount(globalConfig);
    refs.globalProvider.value = globalConfig?.provider || "gemini-2.5-flash";
    refs.globalRetry.value = String(retryCount);
    setRetryCurrentLabel(retryCount);
    setRetrySelectedLabel(retryCount);
    setRuntimeSettingsEditor(globalConfig?.runtimeSettings ?? {});
  }

  function readGlobalRetryCount(globalConfig?: GlobalConfig): number {
    return typeof globalConfig?.retryCount === "number" &&
      globalConfig.retryCount >= 1
      ? globalConfig.retryCount
      : 5;
  }

  function parseRuntimeSettingsEditor(): RuntimeSettings | null {
    const raw = refs.runtimeSettingsJson.value.trim();
    const parsed: unknown = raw.length === 0 ? {} : JSON.parse(raw);
    if (Array.isArray(parsed) || typeof parsed !== "object" || !parsed) {
      setStatus("Runtime-inställningar måste vara ett JSON-objekt.");
      showButtonHint(refs.saveRuntimeSettingsButton, "Fel.", "error");
      return null;
    }

    return resolveRuntimeSettings(parsed);
  }

  function readBoundedInput(
    input: HTMLInputElement,
    message: string,
    min: number,
    max: number,
    button: HTMLButtonElement,
  ): number | null {
    const value = Number.parseInt(input.value.trim(), 10);
    if (!Number.isInteger(value) || value < min || value > max) {
      setStatus(message);
      showButtonHint(button, "Fel.", "error");
      return null;
    }

    return value;
  }

  function readGeminiConfigPayload(): {
    provider: Record<string, unknown>;
    qualityTemperature: number;
  } | null {
    const model = refs.geminiModel.value.trim();
    if (!model) {
      setGeminiValidationError("Fyll i modellnamn.");
      return null;
    }

    const temperature = readGeminiTemperature(refs.geminiTemp, "Temperature");
    const qualityTemperature = readGeminiTemperature(
      refs.geminiQeTemp,
      "QE temperature",
    );
    const maxOutputTokens = readGeminiMaxTokens();

    if (temperature === null || qualityTemperature === null || maxOutputTokens === null) {
      return null;
    }

    return {
      provider: {
        model,
        temperature,
        maxOutputTokens,
        useWebSearch: refs.geminiUseSearch.checked,
        useThinking: refs.geminiUseThinking.checked,
      },
      qualityTemperature,
    };
  }

  function readGeminiTemperature(
    input: HTMLInputElement,
    label: string,
  ): number | null {
    const raw = input.value.trim();
    if (!raw) {
      const displayLabel = label === "Temperature" ? "temperature" : label;
      setGeminiValidationError(`Fyll i ${displayLabel}.`);
      return null;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      setGeminiValidationError(`${label} måste vara mellan 0 och 1.`);
      return null;
    }

    return value;
  }

  function readGeminiMaxTokens(): number | null {
    const raw = refs.geminiMax.value.trim();
    if (!raw) {
      setGeminiValidationError("Fyll i max output tokens.");
      return null;
    }

    const value = Number.parseInt(raw, 10);
    if (!Number.isInteger(value) || value <= 0) {
      setGeminiValidationError("Max output tokens måste vara ett heltal över 0.");
      return null;
    }

    return value;
  }

  function setGeminiValidationError(message: string): void {
    setStatus(message);
    showButtonHint(refs.saveGeminiButton, "Fel.", "error");
  }

  function applySavedGeminiConfig(config: GeminiConfig): void {
    if (config.temperature !== undefined) {
      setGeminiTemperature(config.temperature);
      setGeminiTemperatureSelected(config.temperature);
    }
    if (config.maxOutputTokens !== undefined) {
      refs.geminiMax.value = String(config.maxOutputTokens);
    }
    if (config.model) {
      refs.geminiModel.value = config.model;
    }
    if (typeof config.useWebSearch === "boolean") {
      refs.geminiUseSearch.checked = config.useWebSearch;
    }
    if (typeof config.useThinking === "boolean") {
      refs.geminiUseThinking.checked = config.useThinking;
    }
  }

  function setGeminiSaveError(providerSaved: boolean, error: unknown): void {
    if (providerSaved) {
      setStatus(
        error instanceof Error
          ? `Gemini sparades, men QE temperature misslyckades: ${error.message}`
          : "Gemini sparades, men QE temperature kunde inte sparas.",
      );
    } else {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara Gemini-konfiguration.",
      );
    }
    showButtonHint(refs.saveGeminiButton, "Fel.", "error");
  }

  return {
    init,
    applyConfig,
    getRuntimeSettings,
    setRuntimeSettingsEditor,
    saveRuntimeSettingsValue,
    updateRuntimeSettings,
  };
}
