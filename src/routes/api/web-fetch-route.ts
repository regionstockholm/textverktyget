import type { Request, Response } from "express";
import * as cheerio from "cheerio";
import { config } from "../../config/app-config.js";
import { sendError, sendSuccess } from "../../utils/api/api-responses.js";
import {
  fetchPublicWebContent,
  UrlFetchGuardError,
  UrlFetchHttpError,
} from "../../utils/security/url-fetch-guard.js";

function extractFormattedContent(element: any, $: any): string {
  let formattedContent = "";
  element.contents().each((_index: number, child: any) => {
    if (child.type === "text") {
      formattedContent += child.data;
      return;
    }
    const $child = $(child);
    const tagName = child.tagName?.toLowerCase();
    switch (tagName) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
      case "p":
        formattedContent += `\n\n${$child.text().trim()}\n\n`;
        break;
      case "ul":
      case "ol":
        $child.find("li").each((_liIndex: number, liNode: any) => {
          const liText = $(liNode).text().trim();
          if (liText) formattedContent += `- ${liText}\n\n`;
        });
        break;
      case "li":
        formattedContent += `- ${$child.text().trim()}\n\n`;
        break;
      case "br":
        formattedContent += "\n";
        break;
      case "div":
      case "section":
      case "article":
        formattedContent += extractFormattedContent($child, $);
        break;
      default: {
        const text = $child.text().trim();
        if (text && $child.children().length === 0) formattedContent += `${text}\n\n`;
        else if (text) formattedContent += extractFormattedContent($child, $);
      }
    }
  });
  if (!formattedContent.trim()) {
    formattedContent = element.text()
      .replace(/\.\s+/g, ".\n\n")
      .replace(/:\s+/g, ":\n")
      .replace(/\s+/g, " ").trim();
  }
  return formattedContent.trim();
}

/** Preserve the original selective import, including Region Stockholm's layout. */
export function extractWebText(html: string, url: string): string {
  const $ = cheerio.load(html);
  $(
    'script, style, nav, header, footer, aside, .advertisement, .ads, .social-media, .sidebar, .menu, .navigation, .breadcrumb, .cookie-banner, [class*="ad-"], [id*="ad-"], [class*="ads-"], [id*="ads-"]',
  ).remove();
  let content = "";
  if (url.includes("regionstockholm.se")) {
    let contentDiv = null;
    const kortVersionSection = $("section.relative.mb-6");
    if (kortVersionSection.length > 0) {
      contentDiv = kortVersionSection.next("div");
    } else {
      const proseDiv = $(".prose");
      if (proseDiv.length > 0) {
        contentDiv = proseDiv.find("div").last();
        if (contentDiv.length === 0) contentDiv = proseDiv;
      }
    }
    if (contentDiv && contentDiv.length > 0) content = extractFormattedContent(contentDiv, $);
  }
  if (!content) {
    for (const selector of ["main", "article", ".content", ".post", ".entry", ".article-content", ".post-content", ".entry-content", ".main-content", ".page-content", ".text-content", '[role="main"]', ".article-body", ".story-body", ".content-body"]) {
      const element = $(selector);
      if (element.length > 0) {
        const extracted = extractFormattedContent(element, $);
        if (extracted && extracted.length > content.length) content = extracted;
      }
    }
  }
  if (!content || content.length < 100) {
    let bestContent = "";
    $("div, section, p").each((_index: number, element: any) => {
      const text = extractFormattedContent($(element), $);
      if (text.length > bestContent.length && text.length > 50) bestContent = text;
    });
    if (bestContent) content = bestContent;
  }
  if (!content || content.length < 50) {
    $("button, input, select, textarea, form, .btn, .button").remove();
    const bodyElement = $("body");
    if (bodyElement.length > 0) content = extractFormattedContent(bodyElement, $);
  }
  return cleanExtractedContent(content);
}

function cleanExtractedContent(content: string): string {
  return content
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n /g, "\n")
    .replace(/ \n/g, "\n")
    .trim();
}

export async function handleFetchWebRequest(
  req: Request,
  res: Response,
): Promise<void> {
  const startTime = Date.now();

  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      sendError(res, 400, "Valid URL is required");
      return;
    }

    console.log(
      `[API] Fetching content from: ${url} (timeout: ${config.performance.urlFetchTimeoutMs}ms, maxBytes: ${config.performance.urlFetchMaxResponseBytes})`,
    );

    const fetchedContent = await fetchPublicWebContent(url, {
      timeoutMs: config.performance.urlFetchTimeoutMs,
      maxRedirects: config.performance.urlFetchMaxRedirects,
      maxResponseBytes: config.performance.urlFetchMaxResponseBytes,
      userAgent: "Mozilla/5.0 (compatible; TextverktygsBot/1.0)",
      allowPrivateNetwork: config.performance.urlFetchAllowPrivateNetwork,
    });

    const html = fetchedContent.body;
    const normalizedContentType = fetchedContent.contentType.toLowerCase();
    const isPlainTextResponse = normalizedContentType.includes("text/plain");

    // Plain text must never pass through an HTML parser (e.g. literal <tags>).
    const content = isPlainTextResponse ? html : extractWebText(html, url);
    const cleanedContent = isPlainTextResponse ? content : cleanExtractedContent(content);
    console.log(`[API] Final cleaned content length: ${cleanedContent.length} chars`);

    if (!cleanedContent || cleanedContent.length < 10) {
      console.log(
        `[API] No meaningful content found. Raw content sample: ${content.substring(0, 200)}`,
      );
      sendError(res, 422, "No text content could be extracted from the URL");
      return;
    }

    const processingTime = Date.now() - startTime;
    sendSuccess(res, {
      url,
      finalUrl: fetchedContent.finalUrl,
      content: cleanedContent,
      contentLength: cleanedContent.length,
      processingTime,
    });
  } catch (error) {
    console.error("[API] Web fetch error:", error);

    if (error instanceof UrlFetchGuardError) {
      const guardStatusMap: Record<string, number> = {
        INVALID_URL: 400,
        UNSUPPORTED_PROTOCOL: 400,
        UNSUPPORTED_PORT: 400,
        UNSAFE_HOST: 403,
        UNSAFE_IP: 403,
        DNS_LOOKUP_FAILED: 404,
        TOO_MANY_REDIRECTS: 422,
        MISSING_REDIRECT_LOCATION: 422,
        UNSUPPORTED_CONTENT_TYPE: 415,
        INCOMPLETE_CONTENT: 422,
        INVALID_TEXT_ENCODING: 422,
        CONTENT_TOO_LARGE: 413,
      };

      const statusCode = guardStatusMap[error.code] || 400;
      sendError(res, statusCode, error.message);
      return;
    }

    if (error instanceof UrlFetchHttpError) {
      sendError(res, error.status, `Failed to fetch: ${error.statusText}`);
      return;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        sendError(
          res,
          408,
          "Request timeout - the website took too long to respond",
        );
      } else if (error.message.includes("ENOTFOUND")) {
        sendError(res, 404, "Website not found");
      } else {
        sendError(res, 500, "Failed to fetch web content", undefined);
      }
      return;
    }

    sendError(res, 500, "Unknown error occurred");
  }
}
