import { describe, expect, it } from "vitest";
import { deriveProviderReadiness } from "./providerReadiness";

function reader(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

describe("provider readiness", () => {
  it("reports a fully configured server environment without returning values", () => {
    const values = {
      FIRECRAWL_API_KEY: "secret-firecrawl-sentinel",
      FIRECRAWL_WEBHOOK_SECRET: "secret-firecrawl-webhook-sentinel",
      FIRECRAWL_MONITOR_WEBHOOK_BEARER:
        "secret-firecrawl-monitor-bearer-sentinel",
      FIRECRAWL_WEBHOOK_URL: "https://roomscout.example/api/webhooks/firecrawl",
      FIRECRAWL_MONITORS_ENABLED: "true",
      AGENTMAIL_API_KEY: "secret-agentmail-sentinel",
      AGENTMAIL_WEBHOOK_SECRET: "secret-agentmail-webhook-sentinel",
      AGENTMAIL_ADDRESS_SALT: "secret-mailbox-salt-sentinel",
      AGENTMAIL_DOMAIN: "mail.roomscout.example",
      BROWSERBASE_API_KEY: "secret-browserbase-sentinel",
      MAPBOX_SECRET_TOKEN: "secret-mapbox-sentinel",
      OPENAI_API_KEY: "secret-openai-sentinel",
      REALTIME_ALLOWED_ORIGINS:
        "http://localhost:5173,https://roomscout.example",
    };

    const result = deriveProviderReadiness(reader(values));

    expect(result.overallStatus).toBe("configured");
    expect(result.configuredProviders).toBe(5);
    expect(result.firecrawl).toMatchObject({
      status: "configured",
      webhookUrlValid: true,
      monitorsEnabled: true,
    });
    expect(result.agentmail.status).toBe("configured");
    expect(result.agentmail.reasons).toContain(
      "Credential presence only; per-user provisioning requires an organization- or pod-scoped key with inbox_create permission.",
    );
    expect(result.browserbase).toMatchObject({
      status: "configured",
      credentialPresenceOnly: true,
    });
    expect(result.openaiDirect).toMatchObject({
      status: "configured",
      realtimeOriginsValid: true,
      productionOriginConfigured: true,
    });
    const serialized = JSON.stringify(result);
    for (const value of Object.values(values).filter((value) =>
      value.startsWith("secret-"),
    )) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).not.toContain(values.FIRECRAWL_WEBHOOK_URL);
    expect(serialized).not.toContain(values.AGENTMAIL_DOMAIN);
    expect(serialized).not.toContain(values.REALTIME_ALLOWED_ORIGINS);
  });

  it("distinguishes intentionally disabled Firecrawl monitors from missing configuration", () => {
    const result = deriveProviderReadiness(
      reader({
        FIRECRAWL_API_KEY: "configured",
        FIRECRAWL_WEBHOOK_SECRET: "configured",
        FIRECRAWL_MONITOR_WEBHOOK_BEARER: "configured",
        FIRECRAWL_WEBHOOK_URL: "https://roomscout.example/api/webhooks/firecrawl",
        FIRECRAWL_MONITORS_ENABLED: "false",
      }),
    );

    expect(result.firecrawl.status).toBe("disabled");
    expect(result.firecrawl.monitorsEnabled).toBe(false);
    expect(result.firecrawl.reasons).toContain(
      "Native monitors are intentionally disabled.",
    );
    expect(result.overallStatus).toBe("incomplete");
  });

  it("flags malformed endpoints, wildcard origins, and all missing credentials", () => {
    const result = deriveProviderReadiness(
      reader({
        FIRECRAWL_WEBHOOK_URL: "not-a-url",
        REALTIME_ALLOWED_ORIGINS: "https://*.example.com",
      }),
    );

    expect(result.firecrawl).toMatchObject({
      status: "incomplete",
      webhookUrlConfigured: true,
      webhookUrlValid: false,
    });
    expect(result.agentmail.status).toBe("incomplete");
    expect(result.browserbase.apiKeyConfigured).toBe(false);
    expect(result.mapbox.serverTokenConfigured).toBe(false);
    expect(result.openaiDirect).toMatchObject({
      status: "incomplete",
      realtimeOriginsConfigured: true,
      realtimeOriginsValid: false,
    });
    expect(result.frontendMapbox).toMatchObject({
      status: "client_only",
      backendInspectable: false,
    });
  });

  it("keeps AgentMail's optional custom domain separate from required readiness", () => {
    const result = deriveProviderReadiness(
      reader({
        AGENTMAIL_API_KEY: "configured",
        AGENTMAIL_WEBHOOK_SECRET: "configured",
        AGENTMAIL_ADDRESS_SALT: "configured",
      }),
    );

    expect(result.agentmail).toMatchObject({
      status: "configured",
      customDomainConfigured: false,
    });
    expect(result.agentmail.reasons).toContain(
      "No custom mailbox domain is configured; the provider default will be used.",
    );
  });
});
