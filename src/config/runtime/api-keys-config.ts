export type ApiKeysConfig = {
  gemini: string | undefined;
  openai: string | undefined;
};

export const apiKeys: ApiKeysConfig = {
  gemini: process.env.GEMINI_API_KEY,
  openai: process.env.OPENAI_API_KEY,
};
