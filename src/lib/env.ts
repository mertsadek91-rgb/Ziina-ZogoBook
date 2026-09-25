function read(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

export const env = {
  appUrl: () => read("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  adminPassword: () => read("ADMIN_PASSWORD"),
  sessionSecret: () => read("SESSION_SECRET"),
  cronSecret: () => read("CRON_SECRET", ""),

  ziinaToken: () => read("ZIINA_API_TOKEN"),
  ziinaWebhookSecret: () => read("ZIINA_WEBHOOK_SECRET", ""),
  ziinaTestMode: () => read("ZIINA_TEST_MODE", "false") === "true",
  ziinaCurrency: () => read("ZIINA_CURRENCY", "AED"),

  zohoDc: () => read("ZOHO_DC", "com"),
  zohoClientId: () => read("ZOHO_CLIENT_ID"),
  zohoClientSecret: () => read("ZOHO_CLIENT_SECRET"),
  zohoRefreshToken: () => read("ZOHO_REFRESH_TOKEN"),
  zohoOrgId: () => read("ZOHO_ORG_ID"),
};
