export type EnvironmentConfig = {
  isProduction: boolean;
  isDevelopment: boolean;
  isLocal: boolean;
  environment: string;
};

export const environmentConfig: EnvironmentConfig = {
  isProduction: true,
  isDevelopment: false,
  isLocal: false,
  environment: "production",
};
