export type ProviderReadinessStatus =
  | "configured"
  | "incomplete"
  | "disabled"
  | "client_only";

type ReadEnv = (name: string) => string | undefined;

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

function validHttpUrl(value: string | undefined) {
  if (!present(value)) return false;
  try {
    const url = new URL(value!);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function realtimeOrigins(value: string | undefined) {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const valid =
    origins.length > 0 &&
    origins.every((origin) => {
      if (origin.includes("*")) return false;
      try {
        const url = new URL(origin);
        return (
          (url.protocol === "https:" || url.protocol === "http:") &&
          url.origin === origin
        );
      } catch {
        return false;
      }
    });
  const productionOriginConfigured =
    valid && origins.some((origin) => origin.startsWith("https://"));
  return { configured: origins.length > 0, valid, productionOriginConfigured };
}

export function deriveProviderReadiness(readEnv: ReadEnv) {
  const firecrawlApiKeyConfigured = present(readEnv("FIRECRAWL_API_KEY"));
  const firecrawlWebhookSecretConfigured = present(
    readEnv("FIRECRAWL_WEBHOOK_SECRET"),
  );
  const firecrawlWebhookUrlConfigured = present(
    readEnv("FIRECRAWL_WEBHOOK_URL"),
  );
  const firecrawlWebhookUrlValid = validHttpUrl(
    readEnv("FIRECRAWL_WEBHOOK_URL"),
  );
  const firecrawlMonitorsEnabled =
    readEnv("FIRECRAWL_MONITORS_ENABLED")?.trim().toLowerCase() === "true";
  const firecrawlCoreConfigured =
    firecrawlApiKeyConfigured &&
    firecrawlWebhookSecretConfigured &&
    firecrawlWebhookUrlValid;
  const firecrawlReasons: string[] = [];
  if (!firecrawlApiKeyConfigured) firecrawlReasons.push("API key is missing.");
  if (!firecrawlWebhookSecretConfigured)
    firecrawlReasons.push("Webhook verification secret is missing.");
  if (!firecrawlWebhookUrlConfigured)
    firecrawlReasons.push("Webhook URL is missing.");
  else if (!firecrawlWebhookUrlValid)
    firecrawlReasons.push("Webhook URL is not a valid HTTP(S) URL.");
  if (!firecrawlMonitorsEnabled)
    firecrawlReasons.push("Native monitors are intentionally disabled.");
  const firecrawlStatus: ProviderReadinessStatus = !firecrawlCoreConfigured
    ? "incomplete"
    : firecrawlMonitorsEnabled
      ? "configured"
      : "disabled";

  const agentmailApiKeyConfigured = present(readEnv("AGENTMAIL_API_KEY"));
  const agentmailWebhookSecretConfigured = present(
    readEnv("AGENTMAIL_WEBHOOK_SECRET"),
  );
  const agentmailAddressSaltConfigured = present(
    readEnv("AGENTMAIL_ADDRESS_SALT"),
  );
  const agentmailCustomDomainConfigured = present(readEnv("AGENTMAIL_DOMAIN"));
  const agentmailReasons: string[] = [];
  if (!agentmailApiKeyConfigured) agentmailReasons.push("API key is missing.");
  if (!agentmailWebhookSecretConfigured)
    agentmailReasons.push("Webhook verification secret is missing.");
  if (!agentmailAddressSaltConfigured)
    agentmailReasons.push("Deterministic mailbox address salt is missing.");
  if (!agentmailCustomDomainConfigured)
    agentmailReasons.push("No custom mailbox domain is configured; the provider default will be used.");
  const agentmailStatus: ProviderReadinessStatus =
    agentmailApiKeyConfigured &&
    agentmailWebhookSecretConfigured &&
    agentmailAddressSaltConfigured
      ? "configured"
      : "incomplete";

  const browserbaseApiKeyConfigured = present(readEnv("BROWSERBASE_API_KEY"));
  const browserbaseReasons = browserbaseApiKeyConfigured
    ? [
        "Credential presence only; rotation, freshness, and provider acceptance require a controlled live proof.",
      ]
    : ["API key is missing; configure a rotated key before the live proof."];
  const browserbaseStatus: ProviderReadinessStatus = browserbaseApiKeyConfigured
    ? "configured"
    : "incomplete";

  const mapboxServerTokenConfigured = present(readEnv("MAPBOX_SECRET_TOKEN"));
  const mapboxReasons = mapboxServerTokenConfigured
    ? ["Server credential presence only; geocoding access is verified by a controlled live proof."]
    : ["Server-side geocoding token is missing."];
  const mapboxStatus: ProviderReadinessStatus = mapboxServerTokenConfigured
    ? "configured"
    : "incomplete";

  const openaiApiKeyConfigured = present(readEnv("OPENAI_API_KEY"));
  const origins = realtimeOrigins(readEnv("REALTIME_ALLOWED_ORIGINS"));
  const openaiReasons: string[] = [];
  if (!openaiApiKeyConfigured)
    openaiReasons.push("Direct API key for embeddings and Realtime is missing.");
  if (!origins.configured)
    openaiReasons.push("Realtime production origin allowlist is missing.");
  else if (!origins.valid)
    openaiReasons.push("Realtime origin allowlist contains an invalid or wildcard origin.");
  else if (!origins.productionOriginConfigured)
    openaiReasons.push("Realtime origin allowlist has no explicit HTTPS production origin.");
  const openaiStatus: ProviderReadinessStatus =
    openaiApiKeyConfigured && origins.valid && origins.productionOriginConfigured
      ? "configured"
      : "incomplete";

  const configuredProviders = [
    firecrawlStatus,
    agentmailStatus,
    browserbaseStatus,
    mapboxStatus,
    openaiStatus,
  ].filter((status) => status === "configured").length;

  return {
    overallStatus:
      configuredProviders === 5 ? ("configured" as const) : ("incomplete" as const),
    configuredProviders,
    serverProviderCount: 5,
    firecrawl: {
      status: firecrawlStatus,
      apiKeyConfigured: firecrawlApiKeyConfigured,
      webhookSecretConfigured: firecrawlWebhookSecretConfigured,
      webhookUrlConfigured: firecrawlWebhookUrlConfigured,
      webhookUrlValid: firecrawlWebhookUrlValid,
      monitorsEnabled: firecrawlMonitorsEnabled,
      reasons: firecrawlReasons,
    },
    agentmail: {
      status: agentmailStatus,
      apiKeyConfigured: agentmailApiKeyConfigured,
      webhookSecretConfigured: agentmailWebhookSecretConfigured,
      addressSaltConfigured: agentmailAddressSaltConfigured,
      customDomainConfigured: agentmailCustomDomainConfigured,
      reasons: agentmailReasons,
    },
    browserbase: {
      status: browserbaseStatus,
      apiKeyConfigured: browserbaseApiKeyConfigured,
      credentialPresenceOnly: true,
      reasons: browserbaseReasons,
    },
    mapbox: {
      status: mapboxStatus,
      serverTokenConfigured: mapboxServerTokenConfigured,
      reasons: mapboxReasons,
    },
    openaiDirect: {
      status: openaiStatus,
      apiKeyConfigured: openaiApiKeyConfigured,
      realtimeOriginsConfigured: origins.configured,
      realtimeOriginsValid: origins.valid,
      productionOriginConfigured: origins.productionOriginConfigured,
      reasons: openaiReasons,
    },
    frontendMapbox: {
      status: "client_only" as const,
      backendInspectable: false,
      reasons: [
        "The Convex backend cannot inspect the Vite build-time browser token; this must be checked in the deployed frontend.",
      ],
    },
  };
}
