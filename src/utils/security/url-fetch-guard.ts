import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type UrlFetchGuardErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "UNSUPPORTED_PORT"
  | "UNSAFE_HOST"
  | "UNSAFE_IP"
  | "DNS_LOOKUP_FAILED"
  | "TOO_MANY_REDIRECTS"
  | "MISSING_REDIRECT_LOCATION"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "CONTENT_TOO_LARGE";

export class UrlFetchGuardError extends Error {
  public readonly code: UrlFetchGuardErrorCode;

  constructor(code: UrlFetchGuardErrorCode, message: string) {
    super(message);
    this.name = "UrlFetchGuardError";
    this.code = code;
  }
}

export class UrlFetchHttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;

  constructor(status: number, statusText: string) {
    super(`Failed to fetch: ${statusText}`);
    this.name = "UrlFetchHttpError";
    this.status = status;
    this.statusText = statusText;
  }
}

type FetchPublicWebContentOptions = {
  timeoutMs: number;
  maxRedirects: number;
  maxResponseBytes: number;
  userAgent: string;
  allowPrivateNetwork: boolean;
};

type PublicWebContentResult = {
  finalUrl: string;
  contentType: string;
  body: string;
};

const ALLOWED_PROTOCOLS = new Set<string>(["http:", "https:"]);
const ALLOWED_PORTS = new Set<number>([80, 443]);
const LOCALHOST_ALIASES = new Set<string>([
  "localhost",
  "localhost.localdomain",
  "local",
]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local"];
const BLOCKED_METADATA_HOSTS = new Set<string>([
  "metadata.google.internal",
  "metadata.azure.internal",
]);
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "application/xhtml+xml",
];

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function getEffectivePort(url: URL): number {
  if (url.port) {
    const parsed = Number.parseInt(url.port, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
      throw new UrlFetchGuardError("UNSUPPORTED_PORT", "URL port is invalid");
    }
    return parsed;
  }

  if (url.protocol === "https:") {
    return 443;
  }

  return 80;
}

function isBlockedHostname(hostname: string): boolean {
  if (LOCALHOST_ALIASES.has(hostname) || BLOCKED_METADATA_HOSTS.has(hostname)) {
    return true;
  }

  return BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

function isPrivateOrReservedIpv4Address(address: string): boolean {
  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = octets;
  if (a === undefined || b === undefined) {
    return true;
  }

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  return false;
}

function isPrivateOrReservedIpv6Address(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::1" || normalized === "::") {
    return true;
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice("::ffff:".length);
    return isPrivateOrReservedIpv4Address(mappedIpv4);
  }

  return false;
}

export function isPrivateOrReservedIpAddress(address: string): boolean {
  const normalizedAddress = address.trim();
  const version = isIP(normalizedAddress);

  if (version === 4) {
    return isPrivateOrReservedIpv4Address(normalizedAddress);
  }

  if (version === 6) {
    return isPrivateOrReservedIpv6Address(normalizedAddress);
  }

  return true;
}

async function assertUrlCanBeFetched(
  url: URL,
  allowPrivateNetwork: boolean,
): Promise<void> {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UrlFetchGuardError(
      "UNSUPPORTED_PROTOCOL",
      "Only HTTP and HTTPS URLs are supported",
    );
  }

  if (allowPrivateNetwork) {
    return;
  }

  const effectivePort = getEffectivePort(url);
  if (!ALLOWED_PORTS.has(effectivePort)) {
    throw new UrlFetchGuardError(
      "UNSUPPORTED_PORT",
      "Only ports 80 and 443 are allowed",
    );
  }

  const hostname = normalizeHost(url.hostname);
  if (!hostname) {
    throw new UrlFetchGuardError("UNSAFE_HOST", "URL hostname is invalid");
  }

  if (isBlockedHostname(hostname)) {
    throw new UrlFetchGuardError(
      "UNSAFE_HOST",
      "Local or internal hosts are not allowed",
    );
  }

  const ipVersion = isIP(hostname);
  if (ipVersion > 0) {
    if (isPrivateOrReservedIpAddress(hostname)) {
      throw new UrlFetchGuardError(
        "UNSAFE_IP",
        "Private or reserved IP addresses are not allowed",
      );
    }
    return;
  }

  let resolvedAddresses: Array<{ address: string }> = [];
  try {
    resolvedAddresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UrlFetchGuardError(
      "DNS_LOOKUP_FAILED",
      "Could not resolve hostname",
    );
  }

  if (resolvedAddresses.length === 0) {
    throw new UrlFetchGuardError(
      "DNS_LOOKUP_FAILED",
      "Could not resolve hostname",
    );
  }

  if (
    resolvedAddresses.some((entry) => isPrivateOrReservedIpAddress(entry.address))
  ) {
    throw new UrlFetchGuardError(
      "UNSAFE_IP",
      "Private or reserved IP addresses are not allowed",
    );
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function isAllowedContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return ALLOWED_CONTENT_TYPES.some((allowed) => normalized.includes(allowed));
}

async function readLimitedResponseBodyAsText(
  response: Response,
  maxResponseBytes: number,
): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const parsedLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isInteger(parsedLength) && parsedLength > maxResponseBytes) {
      throw new UrlFetchGuardError(
        "CONTENT_TOO_LARGE",
        "Response body exceeds size limit",
      );
    }
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxResponseBytes) {
      throw new UrlFetchGuardError(
        "CONTENT_TOO_LARGE",
        "Response body exceeds size limit",
      );
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(buffer);
}

function normalizeInputUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new UrlFetchGuardError("INVALID_URL", "URL cannot be empty");
  }

  try {
    return new URL(trimmed);
  } catch {
    throw new UrlFetchGuardError("INVALID_URL", "Invalid URL format");
  }
}

export async function fetchPublicWebContent(
  rawUrl: string,
  options: FetchPublicWebContentOptions,
): Promise<PublicWebContentResult> {
  let currentUrl = normalizeInputUrl(rawUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    for (let redirectCount = 0; redirectCount <= options.maxRedirects; redirectCount++) {
      await assertUrlCanBeFetched(currentUrl, options.allowPrivateNetwork);

      const response = await fetch(currentUrl.toString(), {
        headers: {
          "User-Agent": options.userAgent,
        },
        signal: controller.signal,
        redirect: "manual",
      });

      if (isRedirectStatus(response.status)) {
        const locationHeader = response.headers.get("location");
        if (!locationHeader) {
          throw new UrlFetchGuardError(
            "MISSING_REDIRECT_LOCATION",
            "Redirect response missing location header",
          );
        }

        if (redirectCount >= options.maxRedirects) {
          throw new UrlFetchGuardError(
            "TOO_MANY_REDIRECTS",
            "Too many redirects",
          );
        }

        currentUrl = new URL(locationHeader, currentUrl);
        continue;
      }

      if (!response.ok) {
        throw new UrlFetchHttpError(response.status, response.statusText);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!isAllowedContentType(contentType)) {
        throw new UrlFetchGuardError(
          "UNSUPPORTED_CONTENT_TYPE",
          "Unsupported response content type",
        );
      }

      const body = await readLimitedResponseBodyAsText(
        response,
        options.maxResponseBytes,
      );

      return {
        finalUrl: currentUrl.toString(),
        contentType,
        body,
      };
    }

    throw new UrlFetchGuardError("TOO_MANY_REDIRECTS", "Too many redirects");
  } finally {
    clearTimeout(timeoutId);
  }
}
