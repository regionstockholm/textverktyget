import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { GoogleAuth } from "google-auth-library";
import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PROVIDERS, assertProviderConfigured, hasEnvironmentValue, modelCapabilities, type ProviderId, type LlmSettings } from "../provider-registry.js";
import { requireModelDefinition } from "../catalog/index.js";
import { anthropicThinking, responsesReasoning, readResponseOutput, assertCompleteResponse, IncompleteOutputError } from "./request-policy.js";
import { appendGroundingSources } from "./grounding.js";

export class ProviderError extends Error {
  constructor(message: string, public readonly retryable = false, public readonly status = 0) { super(message); }
}

export const providerClients = {
  google: (options: ConstructorParameters<typeof GoogleGenAI>[0]) => new GoogleGenAI(options),
  cloudAuth: () => new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }),
};

export const QUALITY_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    overall: { type: "integer" },
    subscores: { type: "object", additionalProperties: false, properties: Object.fromEntries(["fidelity", "priorityOrder", "plainLanguage", "taskFit", "audienceFit", "intentFit"].map(key => [key, { type: "integer" }])), required: ["fidelity", "priorityOrder", "plainLanguage", "taskFit", "audienceFit", "intentFit"] },
    failures: { type: "array", items: { type: "object", additionalProperties: false, properties: { sectionKey: { type: "string" }, dimension: { type: "string" }, reason: { type: "string" } }, required: ["sectionKey", "dimension", "reason"] } },
  }, required: ["overall", "subscores", "failures"],
};

export function resolveCredential(provider: ProviderId, quality: boolean): string {
  const key = PROVIDERS[provider].key;
  if (!key) return "";
  const qe = key.replace(/_API_KEY$/, "_QE_API_KEY");
  return (quality && qe !== key && hasEnvironmentValue(process.env[qe]) ? process.env[qe]!.trim() : "") || (hasEnvironmentValue(process.env[key]) ? process.env[key]!.trim() : "");
}

async function post(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal): Promise<any> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  if (!response.ok) {
    // Do not propagate provider response bodies: they can contain request data or credentials.
    throw new ProviderError(`AI service returned HTTP ${response.status}. ${response.status === 401 || response.status === 403 ? "Check server credentials and model access." : response.status === 404 ? "Check model ID and endpoint." : "Check model settings or service availability."}`, response.status === 429 || response.status >= 500, response.status);
  }
  return response.json();
}

function readContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter(part => !part?.type || part.type === "text").map(part => part?.text || "").join("");
  return "";
}

export async function generateText(provider: ProviderId, settings: LlmSettings, prompt: string, quality = false): Promise<string> {
  assertProviderConfigured(provider);
  const definition = requireModelDefinition(provider, settings.model, settings.modelProfile);
  if (!definition.deploymentRequired && settings.model !== definition.id && settings.model !== definition.apiModelId && !definition.aliases.includes(settings.model)) throw new ProviderError("Model ID does not match its local profile.");
  const caps = modelCapabilities(provider, settings.model, definition.id);
  const policy = definition.reasoning;
  const apiModelId = !definition.deploymentRequired && settings.model === definition.id ? definition.apiModelId : settings.model;
  const maxOutputTokens = Math.min(settings.maxOutputTokens, definition.limits.maxOutputTokens);
  const window = Math.min(settings.contextWindow ?? caps.contextWindow, caps.contextWindow);
  const key = resolveCredential(provider, quality);
  const timeout = Math.max(1000, Math.min(600000, Number(process.env.LLM_TIMEOUT_MS) || (provider === "local" ? 180000 : 90000)));
  const signal = AbortSignal.timeout(timeout);
  const messages = [{ role: "user", content: quality ? `Return valid JSON only matching this schema: ${JSON.stringify(QUALITY_SCHEMA)}\n\n${prompt}` : prompt }];
  const estimatedInput = Math.ceil(messages[0]!.content.length / 2);
  if (estimatedInput + maxOutputTokens > window || estimatedInput > (definition.limits.maxInputTokens ?? window)) throw new ProviderError("Text and prompt exceed this model's configured context window. Reduce input or adjust model settings.");
  const sendTemperature = definition.temperature === "supported" || (definition.temperature === "without-reasoning" && !settings.useThinking);
  try {
    let text = "";
    if (definition.apiStyle === "bedrock-mantle") {
      const token = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
      if (!hasEnvironmentValue(token)) throw new ProviderError("This Bedrock Mantle profile requires AWS_BEARER_TOKEN_BEDROCK in the server environment");
      const result = await post(`https://bedrock-mantle.${process.env.AWS_REGION}.api.aws/openai/v1/chat/completions`, { Authorization: `Bearer ${token}` }, {
        model: apiModelId, messages, [definition.outputTokenParameter]: maxOutputTokens,
        ...(policy.mode === "effort" ? { reasoning_effort: settings.useThinking || !policy.canDisable ? policy.enabledEffort : policy.disabledEffort } : {}),
        ...(sendTemperature ? { temperature: settings.temperature } : {}),
      }, signal);
      assertCompleteResponse(result);
      text = readContent(result.choices?.[0]?.message?.content);
    } else if (definition.apiStyle === "vertex-anthropic" || definition.apiStyle === "vertex-openai") {
      const auth = await providerClients.cloudAuth().getClient();
      const token = await auth.getAccessToken();
      if (!token.token) throw new ProviderError("Google Cloud authentication did not provide an access token");
      const location = process.env.GOOGLE_CLOUD_LOCATION!;
      const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
      const base = `https://${host}/v1/projects/${encodeURIComponent(process.env.GOOGLE_CLOUD_PROJECT!)}/locations/${encodeURIComponent(location)}`;
      const url = definition.apiStyle === "vertex-openai" ? `${base}/endpoints/openapi/chat/completions` : `${base}/publishers/anthropic/models/${encodeURIComponent(apiModelId)}:rawPredict`;
      const body = definition.apiStyle === "vertex-openai" ? { model: apiModelId, messages, [definition.outputTokenParameter]: maxOutputTokens,
        ...(policy.mode === "effort" ? { reasoning_effort: settings.useThinking || !policy.canDisable ? policy.enabledEffort : policy.disabledEffort } : {}),
        ...(quality && caps.structuredOutput ? { response_format: { type: "json_object" } } : {}), ...(sendTemperature ? { temperature: settings.temperature } : {}) }
        : { anthropic_version: "vertex-2023-10-16", messages, max_tokens: maxOutputTokens, ...anthropicThinking(policy, settings.useThinking, maxOutputTokens), ...(sendTemperature ? { temperature: settings.temperature } : {}) };
      const result = await post(url, { Authorization: `Bearer ${token.token}` }, body, signal);
      assertCompleteResponse(result);
      text = readContent(definition.apiStyle === "vertex-openai" ? result.choices?.[0]?.message?.content : result.content);
    } else if (definition.apiStyle === "responses") {
      const base = provider === "azure" ? `${process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "")}/openai/v1` : provider === "local" ? process.env.LOCAL_LLM_BASE_URL!.replace(/\/$/, "") : PROVIDERS[provider].endpoint;
      const result = await post(`${base}/responses`, provider === "azure" ? { "api-key": key } : key ? { Authorization: `Bearer ${key}` } : {}, {
        model: apiModelId, input: messages, max_output_tokens: maxOutputTokens, truncation: "disabled",
        ...responsesReasoning(policy, settings.useThinking), ...(sendTemperature ? { temperature: settings.temperature } : {}),
        ...(quality && caps.structuredOutput ? { text: { format: definition.structuredOutput === "json-schema" ? { type: "json_schema", name: "quality_evaluation", strict: true, schema: QUALITY_SCHEMA } : { type: "json_object" } } } : {}),
      }, signal);
      assertCompleteResponse(result);
      text = readResponseOutput(result);
    } else if (provider === "gemini" || provider === "vertex") {
      const ai = provider === "gemini" ? providerClients.google({ apiKey: key }) : providerClients.google({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION });
      const result = await ai.models.generateContent({ model: apiModelId.replace(/^models\//, ""), contents: messages[0]!.content, config: {
        maxOutputTokens,
        ...(sendTemperature ? { temperature: settings.temperature } : {}),
        ...(policy.mode === "gemini-budget" ? { thinkingConfig: { thinkingBudget: settings.useThinking ? policy.enabledBudget : policy.disabledBudget } } : {}),
        ...(policy.mode === "gemini-level" ? { thinkingConfig: { thinkingLevel: (settings.useThinking || !policy.canDisable ? policy.enabledLevel : policy.disabledLevel) as ThinkingLevel } } : {}),
        ...(settings.useWebSearch && caps.webSearch && !quality ? { tools: [{ googleSearch: {} }] } : {}),
        ...(quality && caps.structuredOutput ? { responseMimeType: "application/json", ...(definition.structuredOutput === "json-schema" ? { responseJsonSchema: QUALITY_SCHEMA } : {}) } : {}),
        httpOptions: { timeout },
      } });
      assertCompleteResponse(result);
      text = result.text || "";
      if (text && settings.useWebSearch && caps.webSearch && !quality) text = appendGroundingSources(text, result.candidates?.[0]?.groundingMetadata);
    } else if (provider === "bedrock") {
      const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION, maxAttempts: 1 });
      try {
        const thinking = policy.mode === "nova-reasoning" ? { reasoningConfig: { type: settings.useThinking ? "enabled" : "disabled", ...(settings.useThinking ? { maxReasoningEffort: policy.enabledEffort } : {}) } } : anthropicThinking(policy, settings.useThinking, maxOutputTokens);
        if (definition.apiStyle === "bedrock-invoke") {
          const result = await client.send(new InvokeModelCommand({ modelId: apiModelId, contentType: "application/json", accept: "application/json", body: JSON.stringify({ anthropic_version: "bedrock-2023-05-31", messages, max_tokens: maxOutputTokens, ...thinking, ...(sendTemperature ? { temperature: settings.temperature } : {}) }) }), { abortSignal: signal });
          const body = JSON.parse(new TextDecoder().decode(result.body));
          assertCompleteResponse(body);
          text = readContent(body.content);
        } else {
          const result = await client.send(new ConverseCommand({ modelId: apiModelId, messages: [{ role: "user", content: [{ text: messages[0]!.content }] }], inferenceConfig: { maxTokens: maxOutputTokens, ...(sendTemperature ? { temperature: settings.temperature } : {}) }, ...(Object.keys(thinking).length ? { additionalModelRequestFields: thinking } : {}) }), { abortSignal: signal });
          assertCompleteResponse(result);
          text = result.output?.message?.content?.map(part => part.text || "").join("") || "";
        }
      } finally { client.destroy(); }
    } else if (provider === "anthropic") {
      const result = await post(`${PROVIDERS.anthropic.endpoint}/messages`, { "x-api-key": key, "anthropic-version": "2023-06-01" }, {
        model: apiModelId, messages, max_tokens: maxOutputTokens,
        ...anthropicThinking(policy, settings.useThinking, maxOutputTokens),
        ...(quality && definition.structuredOutput === "json-schema" ? { output_config: { ...(policy.mode === "anthropic-adaptive" ? { effort: policy.enabledEffort } : {}), format: { type: "json_schema", schema: QUALITY_SCHEMA } } } : {}),
        ...(sendTemperature ? { temperature: settings.temperature } : {}),
      }, signal);
      assertCompleteResponse(result);
      text = readContent(result.content);
    } else if (provider === "cohere") {
      const result = await post(`${PROVIDERS.cohere.endpoint}/chat`, { Authorization: `Bearer ${key}` }, { model: apiModelId, messages, stream: false, max_tokens: maxOutputTokens, ...(sendTemperature ? { temperature: settings.temperature } : {}), ...(policy.mode === "cohere-thinking" ? { thinking: { type: settings.useThinking || !policy.canDisable ? "enabled" : "disabled" } } : {}), ...(quality && caps.structuredOutput ? { response_format: { type: "json_object", ...(definition.structuredOutput === "json-schema" ? { json_schema: QUALITY_SCHEMA } : {}) } } : {}) }, signal);
      assertCompleteResponse(result);
      text = readContent(result.message?.content);
    } else {
      const base = provider === "local" ? process.env.LOCAL_LLM_BASE_URL!.replace(/\/$/, "") : PROVIDERS[provider].endpoint;
      const url = provider === "azure" ? definition.apiStyle === "azure-v1-chat" ? `${process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "")}/openai/v1/chat/completions` : `${process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(apiModelId)}/chat/completions?api-version=${encodeURIComponent(process.env.AZURE_OPENAI_API_VERSION || "2024-10-21")}` : `${base}/chat/completions`;
      const result = await post(url, provider === "azure" ? { "api-key": key } : key ? { Authorization: `Bearer ${key}` } : {}, {
        model: apiModelId, messages,
        [definition.outputTokenParameter]: maxOutputTokens,
        ...(policy.mode === "effort" ? { reasoning_effort: settings.useThinking ? policy.enabledEffort : policy.disabledEffort } : {}),
        ...(policy.mode === "thinking-toggle" ? { thinking: { type: settings.useThinking ? "enabled" : "disabled" }, ...(settings.useThinking ? { reasoning_effort: "low" } : {}) } : {}),
        ...(policy.mode === "openrouter" ? { reasoning: { enabled: settings.useThinking || !policy.canDisable, exclude: true } } : {}),
        ...(policy.mode === "qwen-template" ? { chat_template_kwargs: { enable_thinking: settings.useThinking } } : {}),
        ...(provider === "groq" && caps.reasoning ? { include_reasoning: false } : {}),
        ...(sendTemperature ? { temperature: settings.temperature } : {}),
        ...(quality && caps.structuredOutput ? { response_format: definition.structuredOutput === "json-schema" ? { type: "json_schema", json_schema: { name: "quality_evaluation", strict: true, schema: QUALITY_SCHEMA } } : { type: "json_object" } } : {}),
      }, signal);
      assertCompleteResponse(result);
      text = readContent(result.choices?.[0]?.message?.content);
    }
    if (!text.trim()) throw new ProviderError("AI model returned an empty response.");
    return text.trim();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof IncompleteOutputError) throw new ProviderError(error.message);
    const status = Number((error as { status?: number; $metadata?: { httpStatusCode?: number } })?.status || (error as any)?.$metadata?.httpStatusCode || 0);
    const transient = status === 429 || status >= 500 || (!status && /timeout|abort|fetch failed|ECONN|ENOTFOUND|socket|network/i.test(`${(error as Error)?.name} ${(error as Error)?.message}`));
    throw new ProviderError(`${PROVIDERS[provider].label} request failed${status ? ` (HTTP ${status})` : ""}. Check credentials, model access, endpoint, and service availability.`, transient, status);
  }
}
