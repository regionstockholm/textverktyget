import { GoogleGenAI } from "@google/genai";
import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";
import { CATALOG_SOURCES, type CatalogSource } from "./sources.js";
import { fetchEvidence, tokenNumber, makeDefinition, excludedReason, validRemoteModelId, parseOpenRouter, parseModelApi, type Evidence, type InventoryRecord, type ProviderInventory } from "./research.js";
import { BUILTIN_PROVIDERS } from "../catalog/index.js";
import type { ModelInput, ProviderId, ReasoningPolicy } from "../catalog/types.js";
import { withGoogleGrounding } from "../catalog/google-grounding.js";

const numericAfter = (text: string, labels: string[]) => {
  for (const label of labels) {
    const before = text.match(new RegExp(`(?:^|\\n)[*-]?\\s*([\\d,.]+(?:\\s*[kKmM](?![a-zA-Z]))?)\\s+${label}\\b`, "im"));
    const beforeNumber = tokenNumber(before?.[1]?.trim());
    if (beforeNumber && beforeNumber >= 128 && beforeNumber <= 100000000) return beforeNumber;
    const match = text.match(new RegExp(`\\b${label}\\b[^\\d\\n]{0,30}[\\n |:*]*([\\d,.]+(?:\\s*[kKmM](?![a-zA-Z]))?)(?=\\s*(?:tokens\\b|\\||\\n|·|$))`, "i"));
    const number = tokenNumber(match?.[1]?.trim());
    if (number && number >= 128 && number <= 100000000) return number;
  }
  return undefined;
};

export function reviewPolicy(definition: ModelInput, text: string): ModelInput {
  const provider = definition.provider;
  const existing = BUILTIN_PROVIDERS.find(item => item.id === provider)?.models.find(item => item.id === definition.id || item.apiModelId === definition.id || item.aliases.includes(definition.id));
  const notes: string[] = [];
  let reasoning: ReasoningPolicy = existing?.reasoning ?? { mode: "none" };
  let temperature = existing?.temperature ?? definition.temperature;
  let structuredOutput = existing?.structuredOutput ?? definition.structuredOutput;
  let apiStyle = existing?.apiStyle ?? "chat";
  let pending = false;
  const hasReasoning = /Reasoning token support|\[Reasoning\]|Thinking[^\n|]*\|[^\n|]*(?:Adaptive|Extended)|Reasoning:\s*(?:Yes|Supported)|thinking.*enabled by default/i.test(text);
  if (provider === "openai" || provider === "azure") {
    if (hasReasoning || /Reasoning\.effort supports|Reasoning effort supports/i.test(text)) {
      const canDisable = /Reasoning(?:\.effort| effort).*none|supports:\s*none|Reasoning[^\n]*\bnone\b/i.test(text);
      reasoning = { mode: "effort", enabledEffort: "low", disabledEffort: canDisable ? "none" : "low", canDisable };
      temperature = "unsupported";
      definition.outputTokenParameter = "max_completion_tokens";
    }
    if (/\| Chat Completions \|[^\n]*\| Not supported \|/i.test(text) && /\| Responses \|[^\n]*\| Supported \|/i.test(text)) apiStyle = "responses";
    if (/deep research/i.test(definition.displayName) && /web search|research/i.test(text)) { pending = true; notes.push("Specialized research tool orchestration is not supported by the text rewriting adapter."); }
    if (provider === "azure" && apiStyle === "chat") apiStyle = "azure-v1-chat";
    if (provider === "azure" && !/^(gpt-|o[134]|codex-|computer-use)/i.test(definition.id)) { pending = true; notes.push("Foundry partner model needs a separate deployment API, not the Azure OpenAI adapter."); }
  }
  if (provider === "anthropic") {
    const ownText = text.includes("## Specifications") ? text.split("## Specifications")[1]!.split("## Resources")[0]! : text;
    if (/Thinking[^\n]*Adaptive|Thinking:\s*Adaptive|Adaptive \(always on\)/i.test(ownText)) {
      const mandatory = /Adaptive \(always on\)|thinking.*always enabled|thinking.*cannot.*disabl|lowest thinking setting is.*between_tools/i.test(ownText);
      reasoning = { mode: "anthropic-adaptive", enabledEffort: "medium", canDisable: !mandatory };
      temperature = "unsupported";
    } else if (/Thinking[^\n]*Extended|Thinking:\s*Extended/i.test(ownText)) {
      reasoning = { mode: "anthropic-budget", minimumBudget: 1024, defaultBudget: 8192, canDisable: true };
      temperature = "without-reasoning";
    }
    structuredOutput = /structured outputs/i.test(ownText) ? "json-schema" : "prompt";
  }
  if (provider === "cohere" && /reasoning|thinking/i.test(definition.displayName)) reasoning = { mode: "cohere-thinking", canDisable: true };
  if (provider === "gemini" || provider === "vertex") {
    if (/thinkingLevel|thinking level|Gemini 3/i.test(text) && /thinking|reasoning/i.test(text)) {
      reasoning = { mode: "gemini-level", enabledLevel: "low", disabledLevel: "low", canDisable: false };
    }
    if (/structured output[^\n]*(?:Supported|Yes)|structured outputs/i.test(text)) structuredOutput = "json-schema";
    if (provider === "vertex" && /claude/i.test(definition.id)) {
      apiStyle = "vertex-anthropic";
      reasoning = /Adaptive/i.test(text) ? { mode: "anthropic-adaptive", enabledEffort: "medium", canDisable: !/always on/i.test(text) } : { mode: "anthropic-budget", minimumBudget: 1024, defaultBudget: 8192, canDisable: true };
      temperature = "without-reasoning";
      structuredOutput = "prompt";
    } else if (provider === "vertex" && !/gemini/i.test(definition.id)) {
      const modelName = text.match(/\b(?:model|model_name)\s*[=:]\s*['"]((?:publishers\/[^/]+\/models\/|meta\/|mistralai\/|qwen\/|deepseek\/|xai\/|openai\/)[^'"\s]+)['"]/i)?.[1];
      if (/OpenAI.compatible|endpoints\/openapi/i.test(text) && modelName) {
        apiStyle = "vertex-openai";
        definition.apiModelId = modelName;
        if (/reasoning_effort/i.test(text)) reasoning = { mode: "effort", enabledEffort: "low", disabledEffort: "low", canDisable: false };
      } else { pending = true; notes.push("Exact Vertex serving model ID/invocation protocol requires deployment review."); }
    }
  }
  if (provider === "mistral" && /reasoning_effort.*high|adjustable reasoning|configurable.*reasoning/i.test(text)) reasoning = { mode: "effort", enabledEffort: "high", disabledEffort: "none", canDisable: true };
  if (provider === "xai" && /Reasoning:\s*Yes/i.test(text)) reasoning = { mode: "effort", enabledEffort: "low", disabledEffort: "low", canDisable: false };
  if (provider === "groq" || provider === "cerebras" || provider === "together" || provider === "fireworks" || provider === "huggingface") {
    if (/reasoning_effort|Reasoning:\s*Yes|Capabilities:\s*Reasoning/i.test(text)) {
      const canDisable = /(?:reasoning_effort|effort)[^\n]*none|disable reasoning/i.test(text);
      reasoning = { mode: "effort", enabledEffort: "low", disabledEffort: canDisable ? "none" : "low", canDisable };
    }
  }
  if (provider === "bedrock" && !existing) {
    const converse = /Converse[^\n]*Yes|Converse[^\n]*Supported|Converse API[^\n]*[✓✔]|icon-yes\.png[^\n|]*Converse|client\.converse\(/i.test(text);
    const invoke = /InvokeModel[^\n]*Yes|InvokeModel[^\n]*Supported|client\.invoke_model\(/i.test(text);
    if (converse) {
      if (/anthropic\.claude/.test(definition.id) && /Reasoning[^\n]*Supported|extended thinking/i.test(text)) {
        const adaptive = /Adaptive/i.test(text);
        reasoning = adaptive ? { mode: "anthropic-adaptive", enabledEffort: "medium", canDisable: !/always on/i.test(text) } : { mode: "anthropic-budget", minimumBudget: 1024, defaultBudget: 8192, canDisable: true };
        temperature = "without-reasoning";
      }
      if (/amazon\.nova-2-lite/.test(definition.id)) reasoning = { mode: "nova-reasoning", enabledEffort: "low", canDisable: true };
    } else if (invoke && /anthropic\.claude/.test(definition.id)) {
      apiStyle = "bedrock-invoke";
      reasoning = /Adaptive/i.test(text) ? { mode: "anthropic-adaptive", enabledEffort: "medium", canDisable: !/always on/i.test(text) } : { mode: "anthropic-budget", minimumBudget: 1024, defaultBudget: 8192, canDisable: true };
      temperature = "without-reasoning";
    } else if (/bedrock-mantle[^\n]*openai\/v1|\/openai\/v1/i.test(text) && /Chat Completions API/.test(text)) {
      apiStyle = "bedrock-mantle";
      reasoning = /reasoning effort/i.test(text) ? { mode: "effort", enabledEffort: "low", disabledEffort: "low", canDisable: false } : { mode: "none" };
      notes.push("Mantle OpenAI endpoint; AWS_BEARER_TOKEN_BEDROCK is required in addition to the AWS region.");
    } else { pending = true; notes.push("Published invocation API is not implemented by the existing Bedrock adapter."); }
  }
  if (!existing && !text.trim()) { pending = true; notes.push("The model-list API supplied identity but no per-model request specification."); }
  return withGoogleGrounding({ ...definition, reasoning, temperature, structuredOutput, apiStyle,
    readiness: { adapter: pending ? "pending" : "supported", live: "untested", specifications: definition.limits.verification === "verified" ? "verified" : "conservative" },
    metadata: { ...definition.metadata, notes: `${definition.metadata.notes} ${notes.join(" ")}`.trim() } });
}

export function parseDocumentModel(provider: ProviderId, evidence: Evidence, fallbackId?: string): InventoryRecord | undefined {
  const text = evidence.text.replace(/\*\*/g, "");
  const idMatch = text.match(/\bModel (?:ID|name)\b:\s*[`"']?([\w./:@-]+)/i) || text.match(/\b(?:Model ID|API model ID)\b\s*\|\s*[`"']?([\w./:@-]+)/i)
    || text.match(/\bModel (?:ID|version)\b\s*[\n:]+\s*[- *]*[`"']?([\w./:@-]+)/i);
  const bedrockId = provider === "bedrock" ? [...text.matchAll(/\b(?:amazon|anthropic|meta|ai21|cohere|mistral|deepseek|qwen|minimax|moonshot|nvidia|google|openai|writer|xai|zai)\.(?!com\b|ai\b|org\b|aws\b|png\b|svg\b|dev\b|io\b|net\b|edu\b)[a-z0-9_.:-]+/gi)][0]?.[0] : undefined;
  const mistralId = provider === "mistral" ? text.match(/\b(?:mistral|ministral|magistral|codestral|zai-glm|devstral)-(?:latest|\d)[a-z0-9.-]*(?=\s|["'`+]|$|[A-Z])/)?.[0] : undefined;
  const id = bedrockId || mistralId || idMatch?.[1] || fallbackId;
  if (!id || !/[\w]+[-/.][\w]/.test(id)) return undefined;
  if (!validRemoteModelId(provider, id)) return undefined;
  if (provider === "bedrock" && !bedrockId && !/^(?:gpt-|claude-|llama|qwen)/.test(id)) return undefined;
  const reason = excludedReason(id);
  if (reason) return { id, name: id, disposition: "excluded", reason, sources: [evidence.url], accountVisibility: "not-tested" };
  const context = numericAfter(text.replace(/\bContexti(?=\s|\d)/g, "Context"), ["Context window", "Context length", "Context Length", "Context"]);
  const output = numericAfter(text, ["Max output tokens", "Maximum output tokens", "Max output", "Maximum output", "Max completion tokens"]);
  const name = text.match(/^#\s+([^\n]+)/m)?.[1]?.trim() || id;
  if (provider === "bedrock") {
    const lines = text.split("\n");
    const header = lines.findIndex(line => /Output Modalities/i.test(line));
    if (header >= 0) {
      const headings = lines[header]!.split("|").slice(1, -1);
      const column = headings.findIndex(heading => /Output Modalities/i.test(heading));
      for (const line of lines.slice(header + 2, header + 12)) {
        const cell = line.split("|").slice(1, -1)[column];
        if (cell && /\bText\s*$/.test(cell.trim()) && /icon-no\.png/.test(cell)) return { id, name, disposition: "excluded", reason: "AWS model card explicitly marks text output unsupported", sources: [evidence.url], accountVisibility: "not-tested" };
      }
    }
  }
  const outputModalities = text.match(/Output [Mm]odalities[^\n|]*\|?\s*([^\n]+)/)?.[1];
  if (outputModalities && /Image|Audio|Video/i.test(outputModalities) && !/Text/i.test(outputModalities)) return { id, name, disposition: "excluded", reason: "Model page specifies non-text output", sources: [evidence.url], accountVisibility: "not-tested" };
  let definition = makeDefinition(provider, id, name, context, output, evidence.url);
  if (/\*\*Deprecated|Status[^\n]*Deprecated|Current state[^\n]*Deprecated/i.test(text)) definition.status = "deprecated";
  if (/\*\*Retired|Status[^\n]*Retired/i.test(text)) definition.status = "retired";
  definition = reviewPolicy(definition, text);
  if (/Serverless\s*(?:Not supported|No)/i.test(text) && provider === "fireworks") {
    definition.deploymentRequired = true;
    definition.limits.verification = "deployment-dependent";
    definition.metadata.notes += " This source marks serverless inference unavailable; enter an actual dedicated deployment model ID before use.";
  }
  if (/\b(?:Deprecated|Retired)\b/i.test(text.slice(0, 700))) definition.status = /\bRetired\b/i.test(text.slice(0, 700)) ? "retired" : "deprecated";
  if (provider === "openai" && /Chat Completions[^\n]*Not supported/i.test(text) && !/\| Responses \|[^\n]*\| Supported \|/i.test(text)) {
    return { id, name, disposition: "excluded", reason: "No supported Chat Completions or Responses text endpoint", sources: [evidence.url], accountVisibility: "not-tested" };
  }
  return { id, name, disposition: definition.readiness?.adapter === "pending" ? "needs-review" : "included", reason: "Individual official model page reviewed", sources: [evidence.url], definition, accountVisibility: "not-tested" };
}

export function parseTableModels(provider: ProviderId, evidence: Evidence): InventoryRecord[] {
  const records: InventoryRecord[] = [];
  let headings: string[] = [];
  const text = provider === "azure" ? evidence.text.split('::: zone pivot="azure-direct-others"')[0]! : evidence.text;
  for (const line of text.split("\n")) {
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.replace(/[`*]/g, "").trim());
    if (cells.length < 2) continue;
    if (cells.some(cell => /^(?:Model ID|Model Name|API model string|Model string for API|Models|Model)$/i.test(cell))) { headings = cells; continue; }
    if (cells.every(cell => /^:?-+:?$/.test(cell))) continue;
    const idColumn = headings.findIndex(cell => /API model|string for API|Model ID/i.test(cell));
    const namedColumn = headings.findIndex(cell => /^Model Name$/i.test(cell));
    const identityCell = idColumn >= 0 ? cells[idColumn] : namedColumn >= 0 ? cells[namedColumn] : undefined;
    const identityMatch = identityCell?.match(/^\s*\[?([a-zA-Z0-9][\w./:@-]+)/);
    const idMatch = cells.map(cell => cell.match(/(?:^|\s|\[|')((?:gpt-|o[134]-?|claude-|gemini-|grok-|deepseek-|mistral-|ministral-|magistral-|codestral|command-|north-|tiny-aya-|c4ai-|jamba-|llama|openai\/|meta-llama\/|Qwen\/|qwen[/-]|zai-|zai_org\/|zai-org\/|moonshotai\/|MiniMaxAI\/|minimaxai\/|amazon\.|anthropic\.|cohere\.|ai21\.)(?:[\w./:@-]+))/)).find(Boolean);
    const id = identityMatch?.[1] || idMatch?.[1];
    if (!id || /^(gpt-|claude-|gemini-|command-)$/.test(id)) continue;
    const reason = excludedReason(id);
    if (reason) { records.push({ id, name: id, disposition: "excluded", reason, sources: [evidence.url], accountVisibility: "not-tested" }); continue; }
    const contextIndex = headings.findIndex(cell => /Context|Max request|Max Tokens/i.test(cell));
    const outputIndex = headings.findIndex(cell => /(?:Max(?:imum)?\s+)?(?:Output|Completion)\s*(?:Tokens)?/i.test(cell) && !/Pricing|Price/i.test(cell));
    const contextCell = cells[contextIndex]?.replace(/^-\s*/, "");
    const context = tokenNumber(contextCell);
    const output = outputIndex >= 0 ? tokenNumber(cells[outputIndex]) : numericAfter(contextCell || "", ["Output"]);
    const definition = reviewPolicy(makeDefinition(provider, id, id, context, output, evidence.url), line);
    if (/Retired/i.test(line)) definition.status = "retired";
    else if (/Deprecated/i.test(line) || headings.some(heading => /Deprecation Date/i.test(heading))) definition.status = "deprecated";
    if (provider === "azure") { definition.apiModelId = ""; definition.deploymentRequired = true; definition.limits.verification = "deployment-dependent"; if (contextCell) definition.limits.maxInputTokens = numericAfter(contextCell, ["Input"]); }
    records.push({ id, name: id, disposition: definition.readiness?.adapter === "pending" ? "needs-review" : "included", reason: "Official catalog table entry; per-model enrichment follows", sources: [evidence.url], definition, accountVisibility: "not-tested" });
  }
  return records;
}

export function modelLinks(source: CatalogSource, evidence: Evidence) {
  const links = evidence.links.filter(link => {
    try {
      const url = new URL(link.url);
      if (url.hostname !== new URL(source.catalog).hostname) return false;
      if (source.mode === "openai-docs") return /\/api\/docs\/models\/[^/?]+\/?$/.test(url.pathname) && !/\/(all|compare)$/.test(url.pathname);
      if (source.mode === "anthropic-docs") return /\/models\/[^/]+\/overview/.test(url.pathname);
      if (source.mode === "mistral-docs") return /\/models\/[^/]+/.test(url.pathname);
      if (source.mode === "xai-docs") return /\/developers\/models\/grok-/.test(url.pathname);
      if (source.provider === "bedrock") return /\/model-card-[^/]+\.(?:md|html)$/.test(url.pathname);
      if (source.mode === "cloud-docs") return /\/models\/(gemini|partner-models|maas)\/[^#]+/.test(url.pathname) && !/capabilities|overview|quotas|use-|deploy|pricing|migrate|guides/.test(url.pathname);
      if (source.mode === "model-library") return /\/models\/[^/]+\/[^/]+/.test(url.pathname);
      if (source.provider === "groq") return /\/docs\/model\//.test(url.pathname);
      if (source.provider === "cerebras") return /\/models\/[^/]+/.test(url.pathname) && !/overview|choose-a-model/.test(url.pathname);
      return false;
    } catch { return false; }
  });
  return [...new Map(links.map(link => [link.url.split("#")[0]!.replace(/\.md$/, ""), link])).values()];
}

async function mapConcurrent<T, R>(items: readonly T[], run: (item: T) => Promise<R>, concurrency = 6): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const index = next++; result[index] = await run(items[index]!); }
  }));
  return result;
}

export async function collectProvider(source: CatalogSource, withAccounts: boolean): Promise<ProviderInventory> {
  const result: ProviderInventory = { provider: source.provider, capturedAt: new Date().toISOString(), sourceStatus: "complete", errors: [], evidence: [], records: [] };
    const put = (records: InventoryRecord[]) => {
    for (const record of records) {
      const index = result.records.findIndex(item => item.id === record.id);
      if (index < 0) result.records.push(record);
      else if (record.definition && (!result.records[index]?.definition || record.definition.limits.verification === "verified")) result.records[index] = record;
    }
  };
  let document: Evidence | undefined;
  try {
    document = await fetchEvidence(source.mode === "mistral-docs" ? `${source.catalog}?view=html` : source.catalog, ["mistral-docs", "cloud-docs", "model-library"].includes(source.mode) ? { Accept: "text/html" } : {});
    if (["mistral-docs", "cloud-docs"].includes(source.mode) && !document.links.length) document = await fetchEvidence(source.catalog, { Accept: "text/html,application/xhtml+xml" });
    result.evidence.push(document);
    if (source.mode === "openrouter") {
      put(parseOpenRouter(document));
      await mapConcurrent(result.records.filter(record => record.definition), async record => {
        const url = `https://openrouter.ai/api/v1/models/${record.id.split("/").map(encodeURIComponent).join("/")}/endpoints`;
        try {
          const detail = await fetchEvidence(url);
          const endpoints = (detail.json?.data?.endpoints || []).filter((endpoint: any) => endpoint.status === 0);
          if (!endpoints.length) return;
          const contexts = endpoints.map((endpoint: any) => tokenNumber(endpoint.context_length)).filter(Boolean);
          const outputs = endpoints.map((endpoint: any) => tokenNumber(endpoint.max_completion_tokens)).filter(Boolean);
          if (contexts.length) record.definition!.limits.contextWindow = Math.min(...contexts);
          if (outputs.length) record.definition!.limits.maxOutputTokens = Math.min(...outputs);
          record.definition!.limits.verification = outputs.length === endpoints.length ? "verified" : "conservative";
          record.definition!.metadata.sources = [url, ...record.definition!.metadata.sources];
          record.definition!.metadata.notes += " Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.";
          record.sources.unshift(url);
          // Keep endpoint evidence digest and normalized facts without live uptime/pricing noise.
          result.evidence.push({ ...detail, json: { data: { id: record.id, endpoints: endpoints.map((endpoint: any) => ({ provider: endpoint.provider_name, status: endpoint.status, context_length: endpoint.context_length, max_completion_tokens: endpoint.max_completion_tokens, supported_parameters: endpoint.supported_parameters })) } } });
        } catch { result.errors.push(`Endpoint metadata unavailable: ${record.id}`); result.sourceStatus = "partial"; }
      }, 8);
    }
    else if (source.mode === "huggingface") {
      const models = document.json?.data || document.json;
      if (!Array.isArray(models)) throw new Error("Unexpected Hub inventory");
      for (const model of models) {
        const id = model.id || model.modelId;
        const routes = (model.providers || []).filter((route: any) => route.status === "live");
        const reason = excludedReason(id, { input: model.architecture?.input_modalities, output: model.architecture?.output_modalities });
        if (reason) { put([{ id, name: id, disposition: "excluded", reason, sources: [source.catalog], accountVisibility: "not-tested" }]); continue; }
        if (!routes.length) { put([{ id, name: id, disposition: "needs-review", reason: "No currently live serving route", sources: [source.catalog], accountVisibility: "not-tested" }]); continue; }
        const contexts = routes.map((route: any) => tokenNumber(route.context_length));
        const context = contexts.every(Boolean) ? Math.min(...contexts) : 8192;
        const definition = makeDefinition("huggingface", id, id, context, undefined, source.catalog);
        definition.limits.verification = "deployment-dependent";
        definition.readiness = { adapter: "supported", live: "untested", specifications: "conservative" };
        definition.metadata.notes += " Auto-routing uses the common lower context limit; unspecified route ceilings remain conservative. Model-specific thinking controls are not assumed.";
        put([{ id, name: id, disposition: "included", reason: "Current live text route in Hugging Face's public serving API", sources: [source.catalog, `https://huggingface.co/${id}`], definition, accountVisibility: "not-tested" }]);
        for (const route of routes) {
          const routeId = `${id}:${route.provider}`;
          const profile = makeDefinition("huggingface", routeId, `${id} (${route.provider})`, tokenNumber(route.context_length), undefined, source.catalog,
            { structuredOutput: route.supports_structured_output ? "json-schema" : "prompt" });
          profile.limits.verification = "deployment-dependent";
          profile.readiness = { adapter: "supported", live: "untested", specifications: "conservative" };
          profile.metadata.notes += ` Explicit ${route.provider} serving route; published context retained, unpublished output capped conservatively.`;
          put([{ id: routeId, name: profile.displayName, disposition: "included", reason: "Explicit currently live provider route", sources: [source.catalog], definition: profile, accountVisibility: "not-tested" }]);
        }
      }
      if (document.nextPage) { result.sourceStatus = "partial"; result.errors.push("Public serving API returned pagination; process next page before declaring completeness"); }
    } else if (source.mode === "table-docs" || source.mode === "cloud-docs" || source.mode === "xai-docs") put(parseTableModels(source.provider, document));
    if (source.provider === "deepseek") {
      for (const id of new Set(document.text.match(/\bdeepseek-(?:flash|v4-pro)\b/g) || [])) {
        const existing = BUILTIN_PROVIDERS.find(provider => provider.id === "deepseek")!.models.find(model => model.id === id)!;
        put([{ id, name: existing.displayName, disposition: "existing", reason: "Current model ID explicitly published in pricing table", sources: [source.catalog], accountVisibility: "not-tested" }]);
      }
    }
  } catch (error) {
    result.errors.push(`Public catalog: ${error instanceof Error ? error.message : "fetch failed"}`);
    result.sourceStatus = "partial";
    if (source.provider === "gemini") {
      try { document = await fetchEvidence("https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/models"); result.evidence.push(document); }
      catch { result.errors.push("Google Cloud fallback inventory unavailable"); }
    }
  }
  if (source.lifecycle) {
    try { result.evidence.push(await fetchEvidence(source.lifecycle)); }
    catch { result.errors.push("Lifecycle source unavailable; retain previous lifecycle definitions"); result.sourceStatus = "partial"; }
  }
  if (source.provider === "groq" && !result.records.length) {
    try {
      const serving = await fetchEvidence("https://router.huggingface.co/v1/models");
      result.evidence.push(serving);
      const models = (serving.json?.data || []).filter((model: any) => model.providers?.some((route: any) => route.provider === "groq" && route.status === "live"));
      await mapConcurrent(models, async (model: any) => {
        try {
          const detail = await fetchEvidence(`https://huggingface.co/api/models/${model.id}?expand=inferenceProviderMapping`);
          const mapping = detail.json?.inferenceProviderMapping?.groq;
          if (mapping?.status !== "live" || !mapping.providerId) return;
          result.evidence.push(detail);
          const route = model.providers.find((item: any) => item.provider === "groq");
          const definition = reviewPolicy(makeDefinition("groq", mapping.providerId, model.id, tokenNumber(route.context_length), undefined, detail.url), "Provider supports OpenAI-compatible Chat Completions");
          definition.metadata.notes += " Current serving route and native API ID confirmed by Hugging Face's official Groq mapping; direct Groq documentation returned HTTP 403.";
          put([{ id: mapping.providerId, name: model.id, disposition: "included", reason: "Current official inference-provider mapping; output ceiling conservative", sources: [detail.url, serving.url], definition, accountVisibility: "not-tested" }]);
        } catch { result.errors.push(`Groq serving-route lookup failed: ${model.id}`); }
      });
      result.sourceStatus = "partial";
    } catch { result.errors.push("Groq public serving-route fallback unavailable"); }
  }
  if (withAccounts && source.api && source.apiKey && process.env[source.apiKey]?.trim()) {
    try {
      const key = process.env[source.apiKey]!.trim();
      const headers: Record<string, string> = source.provider === "gemini" ? { "x-goog-api-key": key } : source.provider === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : { Authorization: `Bearer ${key}` };
      let url: string | undefined = source.api;
      const seen = new Set<string>();
      while (url && seen.size < 100) {
        if (seen.has(url)) throw new Error("Model API pagination loop");
        seen.add(url);
        const api = await fetchEvidence(url, headers);
        result.evidence.push(api);
        put(parseModelApi(source.provider, api).map(record => {
          if (!record.definition) return record;
          let definition = reviewPolicy(record.definition, "");
          if (source.provider === "gemini" && /^gemini-3/.test(record.id)) {
            definition = { ...definition, reasoning: { mode: "gemini-level", enabledLevel: "low", disabledLevel: "low", canDisable: false }, structuredOutput: "json-schema", readiness: { adapter: "supported", live: "untested", specifications: "verified" } };
            definition.metadata.notes += " Uses the documented Gemini 3 thinking-level API; low is selected and full disabling is not assumed.";
          } else if (source.provider === "gemini" && /^gemma-/.test(record.id)) definition.readiness = { adapter: "supported", live: "untested", specifications: "verified" };
          return { ...record, definition, disposition: definition.readiness?.adapter === "pending" ? "needs-review" as const : "included" as const };
        }));
        if (api.json?.nextPageToken) { const next = new URL(source.api); next.searchParams.set("pageToken", api.json.nextPageToken); url = next.href; }
        else if (api.json?.has_more && api.json?.last_id) { const next = new URL(source.api); next.searchParams.set("after_id", api.json.last_id); url = next.href; }
        else url = undefined;
      }
      if (url) { result.sourceStatus = "partial"; result.errors.push("API pagination page limit reached"); }
    } catch (error) { result.errors.push(`Account model listing: ${error instanceof Error ? error.message : "failed"}`); result.sourceStatus = "partial"; }
  }
  if (withAccounts && source.provider === "vertex" && process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_LOCATION) {
    try {
      const client = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION });
      const pager = await client.models.list({ config: { pageSize: 100, httpOptions: { timeout: 30000 } } });
      for await (const model of pager) if (model.name) put(parseModelApi("vertex", { url: "https://cloud.google.com/vertex-ai", capturedAt: result.capturedAt, sha256: "sdk-list", text: "", links: [], json: { models: [model] } }));
    } catch { result.errors.push("Vertex account listing failed; no credential details retained"); result.sourceStatus = "partial"; }
  }
  if (withAccounts && source.provider === "bedrock" && process.env.AWS_REGION) {
    const client = new BedrockClient({ region: process.env.AWS_REGION, maxAttempts: 1 });
    try {
      const response = await client.send(new ListFoundationModelsCommand({}), { abortSignal: AbortSignal.timeout(30000) });
      for (const model of response.modelSummaries || []) {
        const id = model.modelId!;
        const reason = excludedReason(id, { input: model.inputModalities?.map(item => item.toLowerCase()), output: model.outputModalities?.map(item => item.toLowerCase()) });
        const definition = reviewPolicy(makeDefinition("bedrock", id, model.modelName || id, undefined, undefined, source.catalog), "");
        put([{ id, name: model.modelName || id, disposition: reason ? "excluded" : "needs-review", reason: reason || "Region-listed model; invocation and quota constraints need review", sources: [source.catalog], definition: reason ? undefined : definition, accountVisibility: "listed" }]);
      }
    } catch { result.errors.push("Bedrock account listing failed; no credential details retained"); result.sourceStatus = "partial"; }
    finally { client.destroy(); }
  }
  if (document && source.mode !== "openrouter" && source.mode !== "huggingface" && source.mode !== "local") {
    const links = modelLinks(source, document);
    if (source.provider === "xai") {
      for (const record of result.records.filter(record => record.definition)) {
        const url = `https://docs.x.ai/developers/models/${record.id}`;
        if (!links.some(link => link.url === url)) links.push({ url, text: record.name });
      }
    }
    await mapConcurrent(links, async link => {
      try {
        const url = ["openai-docs", "anthropic-docs", "mistral-docs", "xai-docs"].includes(source.mode) && !link.url.endsWith(".md") ? link.url.replace(/\/$/, "") + ".md" : link.url;
        let detail: Evidence;
        try { detail = await fetchEvidence(url); }
        catch { detail = await fetchEvidence(link.url); }
        result.evidence.push(detail);
        const leaf = new URL(link.url).pathname.split("/").filter(Boolean).at(-1)!;
        const fallback = source.mode === "openai-docs" || source.mode === "xai-docs" ? leaf : source.mode === "model-library" ? `accounts/${new URL(link.url).pathname.split("/").at(-2)}/models/${leaf}` : undefined;
        const record = parseDocumentModel(source.provider, detail, fallback);
        if (record) put([record]);
      } catch { result.errors.push(`Model page unavailable: ${link.url}`); result.sourceStatus = "partial"; }
    });
  }
  // Structured published tables lack individual links on some services; use existing verified protocol definitions to enrich identity-only rows.
  for (const record of result.records) {
    if (!record.definition || record.disposition === "excluded") continue;
    if (record.definition.readiness?.adapter === "pending") record.disposition = "needs-review";
  }
  if (source.mode === "local") {
    for (const model of BUILTIN_PROVIDERS.find(provider => provider.id === "local")!.models) put([{ id: model.id, name: model.displayName, disposition: "existing", reason: "Local installation profiles; there is no global inventory of installed models", sources: model.metadata.sources.slice(), accountVisibility: "not-tested" }]);
  }
  if (!result.records.length) { result.sourceStatus = "unavailable"; result.errors.push("No model identities could be extracted; source parser needs review"); }
  result.records.sort((a, b) => a.id.localeCompare(b.id));
  return result;
}

export async function collectInventories(withAccounts = false, selected?: readonly ProviderId[]) {
  return mapConcurrent(CATALOG_SOURCES.filter(source => !selected || selected.includes(source.provider)), source => collectProvider(source, withAccounts), 3);
}
