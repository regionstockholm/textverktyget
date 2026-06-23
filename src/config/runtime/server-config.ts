import { readIntegerEnv } from "./read-env.js";

export type ServerSettingsConfig = {
  debug: boolean;
  errorDetails: boolean;
  cacheControl: string;
  secureCookies: boolean;
  trustProxy: number;
  sessionMaxAge: number;
};

export const serverPort = readIntegerEnv("PORT", 3000, 1, 65535);

export const serverSettings: ServerSettingsConfig = {
  debug: false,
  errorDetails: false,
  cacheControl: "public, max-age=3600",
  secureCookies: false,
  trustProxy: 1,
  sessionMaxAge: 24 * 60 * 60 * 1000,
};
