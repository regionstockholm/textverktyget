export type DomRefs = {
  tokenInput: HTMLInputElement;
  statusEl: HTMLElement;
  hintEl: HTMLElement;
  checkButton: HTMLButtonElement;
  saveGlobalButton: HTMLButtonElement;
  saveGeminiButton: HTMLButtonElement;
  ordlistaFrom: HTMLInputElement;
  ordlistaTo: HTMLInputElement;
  ordlistaSaveButton: HTMLButtonElement;
  ordlistaClearButton: HTMLButtonElement;
  ordlistaList: HTMLElement;
  ordlistaEmpty: HTMLElement;
  taskPromptSelect: HTMLSelectElement;
  taskPromptLabel: HTMLElement;
  taskPromptContent: HTMLTextAreaElement;
  taskPromptSaveButton: HTMLButtonElement;
  taskDefLabel: HTMLInputElement;
  taskDefDescription: HTMLInputElement;
  taskDefEnabled: HTMLInputElement;
  taskDefTargetAudienceEnabled: HTMLInputElement;
  taskDefRewritePlanEnabled: HTMLInputElement;
  taskDefCreateButton: HTMLButtonElement;
  taskDefDeleteButton: HTMLButtonElement;
  taskDefMoveUpButton: HTMLButtonElement;
  taskDefMoveDownButton: HTMLButtonElement;
  easyReadTaskEnabled: HTMLInputElement;
  easyReadWorkflowEnabled: HTMLInputElement;
  easyReadWorkflowUseRewriteDraft: HTMLInputElement;
  saveEasyReadSettingsButton: HTMLButtonElement;
  easyReadPromptTask: HTMLTextAreaElement;
  easyReadPromptImportantRules: HTMLTextAreaElement;
  easyReadPromptRole: HTMLTextAreaElement;
  easyReadPromptSenderIntent: HTMLTextAreaElement;
  easyReadPromptRewritePlan: HTMLTextAreaElement;
  easyReadPromptQualityEvaluation: HTMLTextAreaElement;
  easyReadPromptWordListUsage: HTMLTextAreaElement;
  easyReadPromptRewriteFallback: HTMLTextAreaElement;
  easyReadPromptTargetAudienceFallback: HTMLTextAreaElement;
  easyReadTargetAudienceSelect: HTMLSelectElement;
  easyReadTargetAudienceGroup: HTMLElement;
  easyReadTargetAudiencePromptLabel: HTMLElement;
  easyReadTargetAudiencePrompt: HTMLTextAreaElement;
  easyReadTargetAudienceSaveButton: HTMLButtonElement;
  targetAudienceSelect: HTMLSelectElement;
  targetAudienceGroup: HTMLElement;
  targetAudienceCategorySelect: HTMLSelectElement;
  targetAudienceCategoryNameInput: HTMLInputElement;
  targetAudienceCategoryCreateButton: HTMLButtonElement;
  targetAudienceCategorySaveButton: HTMLButtonElement;
  targetAudienceCategoryDeleteButton: HTMLButtonElement;
  targetAudienceCategoryMoveUpButton: HTMLButtonElement;
  targetAudienceCategoryMoveDownButton: HTMLButtonElement;
  targetAudienceCategoryForItemSelect: HTMLSelectElement;
  targetAudienceLabelInput: HTMLInputElement;
  targetAudienceCreateButton: HTMLButtonElement;
  targetAudienceDeleteButton: HTMLButtonElement;
  targetAudienceMoveUpButton: HTMLButtonElement;
  targetAudienceMoveDownButton: HTMLButtonElement;
  targetAudiencePromptLabel: HTMLElement;
  targetAudiencePrompt: HTMLTextAreaElement;
  targetAudienceSaveButton: HTMLButtonElement;
  globalProvider: HTMLSelectElement;
  globalRetry: HTMLInputElement;
  globalRetryCurrent: HTMLElement;
  globalRetrySelected: HTMLElement;
  globalQualityAttempts: HTMLInputElement;
  globalQualityAttemptsCurrent: HTMLElement;
  globalQualityAttemptsSelected: HTMLElement;
  globalRepairBudget: HTMLInputElement;
  globalRepairBudgetCurrent: HTMLElement;
  globalRepairBudgetSelected: HTMLElement;
  runtimeProviderRpmGemini: HTMLInputElement;
  runtimeProviderRpmOpenai: HTMLInputElement;
  runtimeGlobalWindowMs: HTMLInputElement;
  runtimeGlobalMax: HTMLInputElement;
  runtimeApiWindowMs: HTMLInputElement;
  runtimeApiStandard: HTMLInputElement;
  runtimeApiQuality: HTMLInputElement;
  runtimeApiSummarize: HTMLInputElement;
  runtimeApiUpload: HTMLInputElement;
  runtimeQueueConcurrent: HTMLInputElement;
  runtimeQueueSize: HTMLInputElement;
  runtimeQueueWaitMs: HTMLInputElement;
  runtimeQueueRetryAfter: HTMLInputElement;
  runtimeUploadMaxSizeMb: HTMLInputElement;
  runtimeUploadMaxSizeMbSelected: HTMLElement;
  runtimeUploadMaxSizeMbCurrent: HTMLElement;
  runtimeStageAnalysis: HTMLInputElement;
  runtimeStageRewrite: HTMLInputElement;
  runtimeStageCritic: HTMLInputElement;
  runtimeRetryProviderMax: HTMLInputElement;
  runtimeRepairMinSubscore: HTMLInputElement;
  runtimeRepairMinSubscoreSelected: HTMLElement;
  runtimeRepairMinSubscoreCurrent: HTMLElement;
  runtimeAutoEnabled: HTMLInputElement;
  runtimeAutoMode: HTMLSelectElement;
  runtimeAutoManualProfile: HTMLSelectElement;
  runtimeAutoDryRun: HTMLInputElement;
  runtimeAutoEvaluateSeconds: HTMLInputElement;
  runtimeAutoWindowSeconds: HTMLInputElement;
  runtimeAutoMinDwellSeconds: HTMLInputElement;
  runtimeAutoCooldownSeconds: HTMLInputElement;
  runtimeAutoMinSamples: HTMLInputElement;
  runtimeAutoEscalateConsecutive: HTMLInputElement;
  runtimeAutoRelaxConsecutive: HTMLInputElement;
  runtimeSettingsJson: HTMLTextAreaElement;
  saveRuntimeSettingsFieldsButton: HTMLButtonElement;
  saveRuntimeSettingsButton: HTMLButtonElement;
  geminiModel: HTMLInputElement;
  geminiTemp: HTMLInputElement;
  geminiTempSelected: HTMLElement;
  geminiTempValue: HTMLElement;
  geminiQeTemp: HTMLInputElement;
  geminiQeTempSelected: HTMLElement;
  geminiQeTempValue: HTMLElement;
  geminiMax: HTMLInputElement;
  geminiUseSearch: HTMLInputElement;
  geminiUseThinking: HTMLInputElement;
  backupDownloadButton: HTMLButtonElement;
  backupUploadInput: HTMLInputElement;
  backupImportButton: HTMLButtonElement;
  viewInputs: NodeListOf<HTMLInputElement>;
  views: NodeListOf<HTMLElement>;
};

type ElementRefs = Omit<DomRefs, "viewInputs" | "views">;

const elementIds: { [Key in keyof ElementRefs]: string } = {
  tokenInput: "admin-token",
  statusEl: "admin-status",
  hintEl: "admin-hint",
  checkButton: "check-config",
  saveGlobalButton: "save-global",
  saveGeminiButton: "save-gemini",
  ordlistaFrom: "ordlista-from",
  ordlistaTo: "ordlista-to",
  ordlistaSaveButton: "ordlista-save",
  ordlistaClearButton: "ordlista-clear",
  ordlistaList: "ordlista-list",
  ordlistaEmpty: "ordlista-empty",
  taskPromptSelect: "task-prompt-select",
  taskPromptLabel: "task-prompt-label",
  taskPromptContent: "task-prompt-content",
  taskPromptSaveButton: "save-task-prompt",
  taskDefLabel: "task-def-label",
  taskDefDescription: "task-def-description",
  taskDefEnabled: "task-def-enabled",
  taskDefTargetAudienceEnabled: "task-def-target-audience-enabled",
  taskDefRewritePlanEnabled: "task-def-rewrite-plan-enabled",
  taskDefCreateButton: "task-def-create",
  taskDefDeleteButton: "task-def-delete",
  taskDefMoveUpButton: "task-def-move-up",
  taskDefMoveDownButton: "task-def-move-down",
  easyReadTaskEnabled: "easy-read-task-enabled",
  easyReadWorkflowEnabled: "easy-read-workflow-enabled",
  easyReadWorkflowUseRewriteDraft: "easy-read-workflow-use-rewrite-draft",
  saveEasyReadSettingsButton: "save-easy-read-settings",
  easyReadPromptTask: "easy-read-prompt-task",
  easyReadPromptImportantRules: "easy-read-prompt-importantRules",
  easyReadPromptRole: "easy-read-prompt-role",
  easyReadPromptSenderIntent: "easy-read-prompt-senderIntent",
  easyReadPromptRewritePlan: "easy-read-prompt-rewritePlan",
  easyReadPromptQualityEvaluation: "easy-read-prompt-qualityEvaluation",
  easyReadPromptWordListUsage: "easy-read-prompt-wordListUsage",
  easyReadPromptRewriteFallback: "easy-read-prompt-rewriteFallback",
  easyReadPromptTargetAudienceFallback: "easy-read-prompt-targetAudience-fallback",
  easyReadTargetAudienceSelect: "easy-read-target-audience-select",
  easyReadTargetAudienceGroup: "easy-read-target-audience-group",
  easyReadTargetAudiencePromptLabel: "easy-read-target-audience-prompt-label",
  easyReadTargetAudiencePrompt: "easy-read-target-audience-prompt",
  easyReadTargetAudienceSaveButton: "save-easy-read-target-audience",
  targetAudienceSelect: "target-audience-select",
  targetAudienceGroup: "target-audience-group",
  targetAudienceCategorySelect: "target-audience-category-select",
  targetAudienceCategoryNameInput: "target-audience-category-name",
  targetAudienceCategoryCreateButton: "target-audience-category-create",
  targetAudienceCategorySaveButton: "target-audience-category-save",
  targetAudienceCategoryDeleteButton: "target-audience-category-delete",
  targetAudienceCategoryMoveUpButton: "target-audience-category-up",
  targetAudienceCategoryMoveDownButton: "target-audience-category-down",
  targetAudienceCategoryForItemSelect: "target-audience-category-for-item",
  targetAudienceLabelInput: "target-audience-label-input",
  targetAudienceCreateButton: "target-audience-create",
  targetAudienceDeleteButton: "target-audience-delete",
  targetAudienceMoveUpButton: "target-audience-up",
  targetAudienceMoveDownButton: "target-audience-down",
  targetAudiencePromptLabel: "target-audience-prompt-label",
  targetAudiencePrompt: "target-audience-prompt",
  targetAudienceSaveButton: "save-target-audience",
  globalProvider: "global-provider",
  globalRetry: "global-retry",
  globalRetryCurrent: "global-retry-current",
  globalRetrySelected: "global-retry-selected",
  globalQualityAttempts: "global-quality-attempts",
  globalQualityAttemptsCurrent: "global-quality-attempts-current",
  globalQualityAttemptsSelected: "global-quality-attempts-selected",
  globalRepairBudget: "global-repair-budget",
  globalRepairBudgetCurrent: "global-repair-budget-current",
  globalRepairBudgetSelected: "global-repair-budget-selected",
  runtimeProviderRpmGemini: "runtime-provider-rpm-gemini",
  runtimeProviderRpmOpenai: "runtime-provider-rpm-openai",
  runtimeGlobalWindowMs: "runtime-global-window-ms",
  runtimeGlobalMax: "runtime-global-max",
  runtimeApiWindowMs: "runtime-api-window-ms",
  runtimeApiStandard: "runtime-api-standard",
  runtimeApiQuality: "runtime-api-quality",
  runtimeApiSummarize: "runtime-api-summarize",
  runtimeApiUpload: "runtime-api-upload",
  runtimeQueueConcurrent: "runtime-queue-concurrent",
  runtimeQueueSize: "runtime-queue-size",
  runtimeQueueWaitMs: "runtime-queue-wait-ms",
  runtimeQueueRetryAfter: "runtime-queue-retry-after",
  runtimeUploadMaxSizeMb: "runtime-upload-max-size-mb",
  runtimeUploadMaxSizeMbSelected: "runtime-upload-max-size-mb-selected",
  runtimeUploadMaxSizeMbCurrent: "runtime-upload-max-size-mb-current",
  runtimeStageAnalysis: "runtime-stage-analysis",
  runtimeStageRewrite: "runtime-stage-rewrite",
  runtimeStageCritic: "runtime-stage-critic",
  runtimeRetryProviderMax: "runtime-retry-provider-max",
  runtimeRepairMinSubscore: "runtime-repair-min-subscore",
  runtimeRepairMinSubscoreSelected: "runtime-repair-min-subscore-selected",
  runtimeRepairMinSubscoreCurrent: "runtime-repair-min-subscore-current",
  runtimeAutoEnabled: "runtime-auto-enabled",
  runtimeAutoMode: "runtime-auto-mode",
  runtimeAutoManualProfile: "runtime-auto-manual-profile",
  runtimeAutoDryRun: "runtime-auto-dry-run",
  runtimeAutoEvaluateSeconds: "runtime-auto-evaluate-seconds",
  runtimeAutoWindowSeconds: "runtime-auto-window-seconds",
  runtimeAutoMinDwellSeconds: "runtime-auto-min-dwell-seconds",
  runtimeAutoCooldownSeconds: "runtime-auto-cooldown-seconds",
  runtimeAutoMinSamples: "runtime-auto-min-samples",
  runtimeAutoEscalateConsecutive: "runtime-auto-escalate-consecutive",
  runtimeAutoRelaxConsecutive: "runtime-auto-relax-consecutive",
  runtimeSettingsJson: "runtime-settings-json",
  saveRuntimeSettingsFieldsButton: "save-runtime-settings-fields",
  saveRuntimeSettingsButton: "save-runtime-settings",
  geminiModel: "gemini-model",
  geminiTemp: "gemini-temp",
  geminiTempSelected: "gemini-temp-selected",
  geminiTempValue: "gemini-temp-value",
  geminiQeTemp: "gemini-qe-temp",
  geminiQeTempSelected: "gemini-qe-temp-selected",
  geminiQeTempValue: "gemini-qe-temp-value",
  geminiMax: "gemini-max",
  geminiUseSearch: "gemini-use-search",
  geminiUseThinking: "gemini-use-thinking",
  backupDownloadButton: "backup-download",
  backupUploadInput: "backup-upload",
  backupImportButton: "backup-import",
};

export function getRequiredElement<T extends HTMLElement>(
  id: string,
  root: Document = document,
): T | null {
  const element = root.getElementById(id);
  if (!element) {
    return null;
  }
  return element as T;
}

export function initRefs(root: Document = document): DomRefs | null {
  const refs: Partial<Record<keyof ElementRefs, HTMLElement>> = {};
  const entries = Object.entries(elementIds) as Array<
    [keyof ElementRefs, string]
  >;

  for (const [key, id] of entries) {
    const element = getRequiredElement(id, root);
    if (!element) {
      return null;
    }
    refs[key] = element;
  }

  return {
    ...(refs as ElementRefs),
    viewInputs: root.querySelectorAll<HTMLInputElement>(
      'input[type="radio"][data-view-target]',
    ),
    views: root.querySelectorAll<HTMLElement>("[data-view]"),
  };
}
