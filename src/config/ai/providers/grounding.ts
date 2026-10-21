import type { GroundingMetadata } from "@google/genai";

/** Preserve Google-supplied attribution in the application's plain-text result/history. */
export function appendGroundingSources(text: string, metadata?: GroundingMetadata): string {
  const sources = new Map<string, string>();
  const cited = new Set(metadata?.groundingSupports?.flatMap(support => support.groundingChunkIndices || []) || []);
  for (const [index, chunk] of (metadata?.groundingChunks || []).entries()) {
    if (cited.size && !cited.has(index)) continue;
    const web = chunk.web;
    if (!web?.uri) continue;
    try {
      const url = new URL(web.uri);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      const title = (web.title || url.hostname).replace(/[\r\n]+/g, " ").trim();
      sources.set(url.href, title);
    } catch { /* Ignore invalid source links; never render provider HTML as answer text. */ }
  }
  if (!sources.size) return text;
  return `${text}\n\nKällor (Google Search):\n${[...sources].map(([url, title]) => `- ${title}: ${url}`).join("\n")}`;
}
