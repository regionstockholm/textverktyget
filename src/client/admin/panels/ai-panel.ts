import type { AdminContext } from "../admin_context.js";
import type { AdminModel, LlmSettings, ProviderId } from "../../../config/ai/catalog/types.js";
import { filterModels } from "./model-search.js";

type Provider = { provider: ProviderId; label: string; configured: boolean; missingConfiguration: string[]; settings: LlmSettings; models: AdminModel[] };

export function initAiPanel(context: AdminContext) {
  const { refs, request, feedback } = context;
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const modelSelect = element<HTMLSelectElement>("llm-model-select");
  const search = element<HTMLInputElement>("llm-model-search");
  const reasoningFilter = element<HTMLInputElement>("llm-filter-reasoning");
  const structuredFilter = element<HTMLInputElement>("llm-filter-structured");
  const previews = element<HTMLInputElement>("llm-show-previews");
  const archived = element<HTMLInputElement>("llm-show-archived");
  const connection = element<HTMLElement>("llm-connection");
  const activeLabel = element<HTMLElement>("llm-active");
  const windowInput = element<HTMLInputElement>("llm-context-window");
  const taskInput = element<HTMLInputElement>("llm-task-model");
  const backgroundInput = element<HTMLInputElement>("llm-background-model");
  const rpmInput = element<HTMLInputElement>("llm-rpm");
  const fallbackSelect = element<HTMLSelectElement>("llm-fallback");
  const testButton = element<HTMLButtonElement>("llm-test");
  const resetButton = element<HTMLButtonElement>("llm-reset-defaults");
  let providers: Provider[] = [];
  let activeProvider = "";
  let activeModel = "";
  let providerRpm: Record<string, number> = {};
  let fallbackProvider = "";
  let profileId = "";
  const selected = () => providers.find(item => item.provider === refs.globalProvider.value);
  const selectedModel = () => selected()?.models.find(model => model.id === profileId);

  function taskSearchCapability() {
    const provider = providers.find(item => item.provider === activeProvider);
    const effectiveModel = (provider?.settings.taskModel || provider?.settings.model || "").replace(/^models\//, "");
    const model = provider?.models.find(item => item.id === effectiveModel || item.apiModelId === effectiveModel || item.aliases.includes(effectiveModel) || (!provider.settings.taskModel && item.id === provider.settings.modelProfile));
    const help = element<HTMLElement>("task-search-capability");
    if (help) help.textContent = `Aktiv uppgiftsmodell: ${provider?.label || activeProvider} / ${effectiveModel || "ingen"}. ${model?.webSearch ? "Stöder sökning / grounding." : "Sökning / grounding stöds inte eller är inte verifierad för denna modell och adapter."}${fallbackProvider ? " Reservmodellens stöd kontrolleras också vid användning." : ""}`;
    const onOption = refs.taskDefWebSearchMode?.querySelector?.<HTMLOptionElement>('option[value="on"]');
    if (onOption) onOption.disabled = !model?.webSearch;
  }

  function capabilities(resetDefaults = false) {
    const provider = selected();
    const model = selectedModel();
    if (!provider) return;
    const available = model && model.status !== "retired" && model.status !== "draft" && model.readiness.adapter !== "pending" && model.credentialsConfigured;
    refs.saveGeminiButton.disabled = testButton.disabled = !provider.configured || !available;
    resetButton.disabled = !available;
    refs.geminiUseSearch.disabled = !model?.webSearch;
    refs.geminiUseSearch.title = model?.webSearch ? "Providerstandard för Google Search Grounding. Kan ändras per uppgift." : "Sökning / grounding stöds inte eller är inte verifierad för denna modell och adapter.";
    refs.geminiUseThinking.disabled = !model?.reasoning || Boolean(model?.reasoningAlwaysOn);
    if (!model?.webSearch) refs.geminiUseSearch.checked = false;
    if (!model?.reasoning) refs.geminiUseThinking.checked = false;
    if (model?.reasoningAlwaysOn) refs.geminiUseThinking.checked = true;
    refs.geminiMax.max = String(model?.maxOutputTokens || 0);
    refs.geminiModel.readOnly = Boolean(model && !model.deploymentRequired);
    if (model) {
      const kind = model.verification === "verified" ? "Dokumenterad output-gräns" : "Konservativ/konfigurationsberoende output-gräns";
      element<HTMLElement>("llm-output-limit").textContent = `${kind}: ${model.maxOutputTokens.toLocaleString("sv-SE")} tokens. Standard: ${model.defaults.maxOutputTokens.toLocaleString("sv-SE")} tokens.`;
      element<HTMLElement>("llm-model-details").textContent = `Lokal definition: ${model.id}. Status: ${model.status}. Adapter: ${model.readiness.adapter}. Live-test: ${model.readiness.live}. Granskad: ${model.metadata.reviewedAt}, revision ${model.metadata.revision}. ${model.metadata.notes}`;
      if (resetDefaults) {
        windowInput.value = String(model.defaults.contextWindow);
        refs.geminiMax.value = String(model.defaults.maxOutputTokens);
        refs.geminiUseThinking.checked = model.defaults.useThinking;
        refs.geminiUseSearch.checked = model.defaults.useWebSearch;
        refs.geminiTemp.value = String(model.defaults.temperature);
        refs.geminiTempSelected.textContent = `Vald: ${model.defaults.temperature}`;
      }
    } else {
      element<HTMLElement>("llm-output-limit").textContent = "Modellen saknar en lokal definition. Välj en registrerad modell eller lägg till en lokal JSON-profil och starta om appen.";
      element<HTMLElement>("llm-model-details").textContent = "Sparat modell-ID bevaras tills du väljer en ersättare.";
    }
    refs.geminiTemp.disabled = !(model?.temperature || (model?.temperaturePolicy === "without-reasoning" && !refs.geminiUseThinking.checked));
    activeLabel.textContent = `Aktiv: ${providers.find(item => item.provider === activeProvider)?.label || activeProvider} / ${activeModel || "ingen modell"}. Val i formuläret gäller först när du sparar.`;
  }

  function populateModels() {
    modelSelect.replaceChildren();
    const models = filterModels(selected()?.models || [], { query: search.value, reasoning: reasoningFilter.checked, structuredOutput: structuredFilter.checked, previews: previews.checked, archived: archived.checked }, profileId);
    for (const model of models) {
      const group = model.readiness.adapter === "pending" ? "Ej färdiggranskad" : model.status === "preview" ? "Preview" : model.status !== "active" ? "Äldre" : model.deploymentRequired ? "Deployment" : "Stabil";
      const option = new Option(`${group} · ${model.displayName}${model.status !== "active" ? ` — ${model.status}` : ""}`, model.id);
      option.disabled = model.status === "retired" || model.status === "draft" || model.readiness.adapter === "pending" || !model.credentialsConfigured;
      modelSelect.add(option);
    }
    if (!profileId) modelSelect.add(new Option(`Sparad modell saknar definition: ${refs.geminiModel.value}`, ""));
    modelSelect.value = profileId;
    element<HTMLElement>("llm-model-count").textContent = `${models.length} av ${selected()?.models.length || 0} lokala modellprofiler visas.`;
  }

  function showProvider() {
    const provider = selected();
    if (!provider) return;
    const settings = provider.settings;
    search.value = "";
    profileId = settings.modelProfile || provider.models.find(model => model.apiModelId === settings.model || model.id === settings.model || model.aliases.includes(settings.model))?.id || "";
    refs.geminiModel.value = settings.model.replace(/^models\//, "");
    refs.geminiTemp.value = String(settings.temperature);
    refs.geminiTempSelected.textContent = `Vald: ${settings.temperature}`;
    refs.geminiTempValue.textContent = `Nuvarande: ${settings.temperature}`;
    refs.geminiMax.value = String(settings.maxOutputTokens);
    refs.geminiUseSearch.checked = settings.useWebSearch;
    refs.geminiUseThinking.checked = settings.useThinking;
    windowInput.value = String(settings.contextWindow || selectedModel()?.contextWindow || 8192);
    taskInput.value = settings.taskModel || "";
    backgroundInput.value = settings.backgroundModel || "";
    rpmInput.value = String(providerRpm[provider.provider] || (provider.provider === "gemini" ? 10 : 60));
    fallbackSelect.replaceChildren(new Option("Ingen automatisk reservprovider", ""));
    for (const item of providers) {
      if (item.provider === provider.provider) continue;
      const option = new Option(item.label, item.provider);
      const fallbackModel = item.models.find(model => model.id === item.settings.modelProfile || model.apiModelId === item.settings.model);
      option.disabled = !item.configured || !item.settings.model || !fallbackModel || fallbackModel.status === "retired" || fallbackModel.readiness.adapter === "pending";
      fallbackSelect.add(option);
    }
    fallbackSelect.value = fallbackProvider === provider.provider ? "" : fallbackProvider;
    connection.textContent = provider.configured ? "Anslutning konfigurerad i servermiljön. Modellistan läses från lokala filer. Testa för att kontrollera nyckel och modellåtkomst." : `Inte konfigurerad: ${provider.missingConfiguration.join(", ")}`;
    refs.saveGlobalButton.disabled = !provider.configured || !selectedModel() || selectedModel()?.status === "retired";
    populateModels();
    capabilities();
  }

  const load = async () => {
    const data = await request<{ providers: Provider[]; activeProvider: string; qualityTemperature: number; providerRpm?: Record<string, number>; fallback?: { enabled: boolean; provider: string } }>("GET", "/admin/ai/providers");
    providers = data.providers;
    activeProvider = data.activeProvider;
    providerRpm = data.providerRpm || {};
    fallbackProvider = data.fallback?.enabled ? data.fallback.provider : "";
    context.state.runtimeSettings.providerRpm = providerRpm;
    context.state.runtimeSettings.aiFallback = data.fallback || { enabled: false, provider: null };
    context.state.runtimeSettings.quality = { ...((context.state.runtimeSettings.quality || {}) as Record<string, unknown>), temperature: data.qualityTemperature };
    refs.runtimeSettingsJson.value = JSON.stringify(context.state.runtimeSettings, null, 2);
    refs.geminiQeTemp.value = String(data.qualityTemperature);
    refs.geminiQeTempSelected.textContent = `Vald: ${data.qualityTemperature}`;
    refs.geminiQeTempValue.textContent = `Nuvarande: ${data.qualityTemperature}`;
    activeModel = providers.find(item => item.provider === activeProvider)?.settings.model || "";
    refs.globalProvider.replaceChildren();
    for (const provider of providers) {
      const option = new Option(provider.configured ? provider.label : `${provider.label} — saknar ${provider.missingConfiguration.join(", ")}`, provider.provider);
      option.disabled = !provider.configured;
      refs.globalProvider.add(option);
    }
    refs.globalProvider.value = activeProvider;
    showProvider();
    taskSearchCapability();
  };

  function payload(): LlmSettings {
    return { model: refs.geminiModel.value.trim(), modelProfile: profileId, temperature: Number(refs.geminiTemp.value), maxOutputTokens: Number(refs.geminiMax.value), contextWindow: Number(windowInput.value), useWebSearch: refs.geminiUseSearch.checked, useThinking: refs.geminiUseThinking.checked, taskModel: taskInput.value.trim() || null, backgroundModel: backgroundInput.value.trim() || null };
  }
  refs.globalProvider.addEventListener("change", showProvider);
  search.addEventListener("input", populateModels);
  for (const input of [reasoningFilter, structuredFilter, previews, archived]) input.addEventListener("change", populateModels);
  refs.geminiUseThinking.addEventListener("change", () => capabilities());
  modelSelect.addEventListener("change", () => {
    profileId = modelSelect.value;
    const model = selectedModel();
    if (model && !model.deploymentRequired) refs.geminiModel.value = model.apiModelId;
    capabilities(true);
  });
  resetButton.addEventListener("click", () => {
    capabilities(true);
    feedback.setStatus("Modellens lokala standardvärden har återställts i formuläret. Spara för att aktivera dem.");
  });
  refs.saveGeminiButton.addEventListener("click", async () => {
    try {
      await request("PUT", `/admin/config/providers/${refs.globalProvider.value}`, { ...payload(), activate: true, allowPreview: previews.checked || selected()?.settings.modelProfile === profileId, qualityTemperature: Number(refs.geminiQeTemp.value), rpm: Number(rpmInput.value), fallbackProvider: fallbackSelect.value });
      await load();
      feedback.setStatus("AI-provider och modell sparade och aktiverade för nya bearbetningar.");
      feedback.showButtonHint(refs.saveGeminiButton, "Sparat.", "success");
    } catch (error) { feedback.setStatus(error instanceof Error ? error.message : "Kunde inte spara AI-inställningar."); }
  });
  testButton.addEventListener("click", async () => {
    testButton.disabled = true;
    try {
      feedback.setStatus("Testar anslutning och modell...");
      const result = await request<{ latencyMs: number }>("POST", "/admin/ai/test", { provider: refs.globalProvider.value, settings: payload() });
      feedback.setStatus(`Anslutningen fungerar (${result.latencyMs} ms). Inställningarna har inte aktiverats av testet.`);
    } catch (error) { feedback.setStatus(error instanceof Error ? error.message : "Anslutningstest misslyckades."); }
    finally { capabilities(); }
  });
  return { load };
}
