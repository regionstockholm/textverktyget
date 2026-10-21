import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { ModelInput, ProviderId } from "../catalog/types.js";

export interface Evidence {
  url: string;
  capturedAt: string;
  sha256: string;
  text: string;
  links: { url: string; text: string }[];
  json?: any;
  nextPage?: string;
}
export interface InventoryRecord {
  id: string;
  name: string;
  disposition: "included" | "existing" | "excluded" | "needs-review";
  reason: string;
  sources: string[];
  definition?: ModelInput;
  accountVisibility: "listed" | "not-tested";
}
export interface ProviderInventory {
  provider: ProviderId;
  capturedAt: string;
  sourceStatus: "complete" | "partial" | "unavailable";
  errors: string[];
  evidence: Evidence[];
  records: InventoryRecord[];
}

export function validRemoteModelId(provider: ProviderId, id: string): boolean {
  if (!id || id.length > 250 || /\s|[\x00-\x1f]/.test(id) || /\.(?:com|org|net|dev|io|png|svg|html|md)$/.test(id)) return false;
  if (provider === "bedrock") return /^(?:[a-z0-9_-]+\.[a-z0-9_.:@-]+|gpt-[a-z0-9_.:@-]+)$/.test(id);
  return true;
}

export async function fetchEvidence(url: string, headers: Record<string, string> = {}): Promise<Evidence> {
  // Keys go in headers, never URL/logs/snapshots. Authenticated requests do not follow redirects.
  const authenticated = Object.keys(headers).some(key => /authorization|api.key/i.test(key));
  let response: Response;
  try { response = await fetch(url, { headers: { Accept: "text/markdown,application/json,text/html;q=0.9", ...headers }, redirect: authenticated ? "error" : "follow", signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error("Source request failed (network, authentication, timeout, or redirect)"); }
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Source has no body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > 12 * 1024 * 1024) { await reader.cancel(); throw new Error("Source exceeds 12 MB"); }
    chunks.push(next.value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const capturedAt = new Date().toISOString();
  const sha256 = createHash("sha256").update(raw).digest("hex");
  let json: any;
  try { json = JSON.parse(raw); } catch { /* Document source. */ }
  const links: Evidence["links"] = [];
  let text = raw;
  if (/<(?:html|!doctype)/i.test(raw)) {
    const $ = cheerio.load(raw);
    $("a[href]").each((_index, anchor) => {
      const href = $(anchor).attr("href");
      if (href) { try { links.push({ url: new URL(href, url).href, text: $(anchor).text().trim() }); } catch { /* Invalid link. */ } }
    });
    $("script,style,nav,header,footer,aside").remove();
    const content = $(".devsite-article-body").length ? $(".devsite-article-body") : $("article").length ? $("article") : $("body");
    // Preserve row/cell boundaries so limits stay associated with their model.
    content.find("td,th").append(" | ");
    content.find("code").append("\n");
    content.find("span").append(" ");
    content.find("tr,p,h1,h2,h3,h4,li,pre,div[data-model]").append("\n");
    text = content.text().replace(/[\t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  } else if (!json) {
    for (const match of raw.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      try { links.push({ url: new URL(match[1]!, url).href, text: match[0] }); } catch { /* Invalid Markdown link. */ }
    }
  }
  if (/Access blocked: Authorization Error|OAuth client was not found/.test(text)) throw new Error("Documentation redirected to an authentication error");
  const next = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/i)?.[1];
  const nextPage = next && new URL(next, url).origin === new URL(url).origin ? new URL(next, url).href : undefined;
  return { url, capturedAt, sha256, text: json ? "" : text.slice(0, 1000000), links, ...(json ? { json } : {}), ...(nextPage ? { nextPage } : {}) };
}

export function tokenNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/(?:^|\s)(\d+(?:\.\d+)?)\s*([kKmM](?![a-zA-Z]))?(?=\s*tokens\b|\s|$)/);
  return match ? Math.floor(Number(match[1]) * (match[2]?.toLowerCase() === "m" ? 1000000 : match[2]?.toLowerCase() === "k" ? 1000 : 1)) : undefined;
}

export function excludedReason(id: string, modalities?: { input?: string[]; output?: string[] }): string | undefined {
  if (/^ft:|fine.tun|private.model/i.test(id)) return "Account-specific custom model; maintain as an installation profile";
  if (/(?:^|\/)lyria-|(?:^|\/)nano-banana|nova.*sonic|(?:^|\.)sonic(?:[-.]|$)/i.test(id)) return "Specialized music, image, or speech generation model";
  if (modalities?.output && !modalities.output.includes("text")) return "Does not generate text";
  if (modalities?.input && !modalities.input.includes("text")) return "Does not accept text instructions";
  if (/embedding|\bembed\b|rerank|moderation|safeguard|(?:llama|prompt).guard|shieldstral|whisper|transcri|text.to.speech|(?:^|[-/])tts(?:$|-)|(?:^|[-/])ocr(?:$|-)|image|video|flux|stable.diffusion|(?:^|[-/])sd3(?:$|-)|sdxl|dall.e|pixart|sora|realtime|(?:^|[-/])live(?:$|-)|audio|translate.stream/i.test(id)) return "Specialized media, embedding, reranking, or moderation endpoint";
  if (/^openrouter\/(auto|free|bodybuilder)|:online$|:extended$/.test(id)) return "Dynamic router or tool shortcut without a fixed model definition";
  return undefined;
}

export function makeDefinition(provider: ProviderId, id: string, name: string, context: number | undefined, output: number | undefined, source: string, options: Partial<ModelInput> = {}): ModelInput {
  const verified = Boolean(context && output);
  return {
    provider, id, displayName: name || id,
    limits: { contextWindow: context || 8192, maxOutputTokens: output || Math.min(4096, Math.floor((context || 8192) / 2)), verification: verified ? "verified" : "conservative" },
    reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: /preview|experimental|\bexp\b/i.test(id) ? "preview" : "active",
    metadata: { reviewedAt: new Date().toISOString().slice(0, 10), revision: 1, sources: [source], notes: `${verified ? "Published context and output limits captured from the serving provider." : "The source does not publish all token ceilings; explicit conservative application limits are used."} Account access and live generation have not been tested.` },
    ...options,
  };
}

export function parseOpenRouter(evidence: Evidence): InventoryRecord[] {
  const models = evidence.json?.data;
  if (!Array.isArray(models)) throw new Error("Unexpected OpenRouter model list");
  return models.map((model: any): InventoryRecord => {
    const id = String(model.id);
    const reason = excludedReason(id, { input: model.architecture?.input_modalities, output: model.architecture?.output_modalities });
    if (reason) return { id, name: model.name || id, disposition: "excluded", reason, sources: [evidence.url], accountVisibility: "not-tested" };
    const parameters: string[] = model.supported_parameters || [];
    const definition = makeDefinition("openrouter", id, model.name, tokenNumber(model.context_length), tokenNumber(model.top_provider?.max_completion_tokens), evidence.url, {
      reasoning: parameters.includes("reasoning") ? { mode: "openrouter", canDisable: model.reasoning?.mandatory !== true } : { mode: "none" },
      temperature: parameters.includes("temperature") ? "supported" : "unsupported",
      structuredOutput: parameters.includes("structured_outputs") ? "json-schema" : parameters.includes("response_format") ? "json-object" : "prompt",
    });
    return { id, name: model.name || id, disposition: "included", reason: "Current text-input/text-output route listed by the serving provider", sources: [evidence.url], definition, accountVisibility: "not-tested" };
  });
}

export function parseModelApi(provider: ProviderId, evidence: Evidence): InventoryRecord[] {
  const models = Array.isArray(evidence.json) ? evidence.json : evidence.json?.data || evidence.json?.models;
  if (!Array.isArray(models)) throw new Error("Unexpected provider model list");
  return models.map((model: any): InventoryRecord => {
    const id = String(model.id || model.name || model.model || "").replace(/^models\//, "");
    if (!id) throw new Error("Model list contains an item without an ID");
    const reason = excludedReason(id);
    const actions: string[] | undefined = model.supportedGenerationMethods || model.supportedActions;
    if (reason || (actions && !actions.includes("generateContent"))) return { id, name: model.displayName || id, disposition: "excluded", reason: reason || "Does not support text content generation", sources: [evidence.url], accountVisibility: "listed" };
    const context = tokenNumber(model.context_length || model.context_window || model.max_input_tokens || model.inputTokenLimit || model.max_context_length);
    const output = tokenNumber(model.max_tokens || model.max_output_tokens || model.outputTokenLimit || model.max_completion_tokens);
    const definition = makeDefinition(provider, id, model.display_name || model.displayName || model.name || id, context, output, evidence.url);
    return { id, name: definition.displayName, disposition: "included", reason: "Listed in provider API; request-policy review is recorded separately", sources: [evidence.url], definition, accountVisibility: "listed" };
  });
}
