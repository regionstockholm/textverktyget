export type DatabaseConfig = {
  enabled: boolean;
  url: string;
  sslMode: string;
};

export const databaseConfig: DatabaseConfig = {
  enabled: true,
  url: process.env.DATABASE_URL || "",
  sslMode: process.env.DATABASE_SSL_MODE || "",
};
