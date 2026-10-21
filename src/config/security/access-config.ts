export function isUserLoginEnabled(): boolean {
  const value = process.env.USER_LOGIN_ENABLED ?? "false";
  if (value !== "true" && value !== "false") {
    throw new Error("USER_LOGIN_ENABLED must be true or false");
  }
  return value === "true";
}

export function isCloudflareEnabled(): boolean {
  const configured = process.env.CLOUDFLARE_ENABLED;
  if (configured !== undefined && configured !== "") {
    if (configured !== "true" && configured !== "false") {
      throw new Error("CLOUDFLARE_ENABLED must be true or false");
    }
    return configured === "true";
  }
  // Compatibility for existing Docker-tunnel installations without the new flag.
  return (process.env.COMPOSE_PROFILES ?? "")
    .split(",")
    .some((profile) => ["cloudflared", "cloudflare"].includes(profile.trim()));
}

export function useSecureSessionCookie(): boolean {
  if (![undefined, "", "true", "false"].includes(process.env.COOKIE_SECURE)) {
    throw new Error("COOKIE_SECURE must be true, false or blank");
  }
  if (process.env.COOKIE_SECURE === "false" && isCloudflareEnabled()) {
    throw new Error("COOKIE_SECURE cannot be false with Cloudflare enabled");
  }
  return isCloudflareEnabled() || process.env.COOKIE_SECURE === "true";
}
