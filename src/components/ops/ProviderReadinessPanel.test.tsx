import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderReadinessPanel } from "./ProviderReadinessPanel";

const readiness = {
  overallStatus: "incomplete" as const,
  configuredProviders: 3,
  serverProviderCount: 5,
  firecrawl: {
    status: "disabled" as const,
    apiKeyConfigured: true,
    webhookSecretConfigured: true,
    webhookUrlConfigured: true,
    webhookUrlValid: true,
    monitorsEnabled: false,
    reasons: ["Native monitors are intentionally disabled."],
  },
  agentmail: {
    status: "configured" as const,
    apiKeyConfigured: true,
    webhookSecretConfigured: true,
    addressSaltConfigured: true,
    customDomainConfigured: false,
    reasons: ["No custom mailbox domain is configured; the provider default will be used."],
  },
  browserbase: {
    status: "configured" as const,
    apiKeyConfigured: true,
    credentialPresenceOnly: true,
    reasons: ["Credential presence only; provider acceptance requires a controlled live proof."],
  },
  mapbox: {
    status: "incomplete" as const,
    serverTokenConfigured: false,
    reasons: ["Server-side geocoding token is missing."],
  },
  openaiDirect: {
    status: "configured" as const,
    apiKeyConfigured: true,
    realtimeOriginsConfigured: true,
    realtimeOriginsValid: true,
    productionOriginConfigured: true,
    reasons: [],
  },
  frontendMapbox: {
    status: "client_only" as const,
    backendInspectable: false,
    reasons: ["The Convex backend cannot inspect the Vite build-time browser token."],
  },
};

describe("ProviderReadinessPanel", () => {
  it("renders derived states, explains presence-only checks, and refreshes", () => {
    const onRefresh = vi.fn();
    render(
      <ProviderReadinessPanel
        error={null}
        frontendMapboxConfigured={false}
        loading={false}
        onRefresh={onRefresh}
        readiness={readiness}
      />,
    );

    expect(screen.getByText(/3 of 5 server providers configured/i)).toBeInTheDocument();
    expect(screen.getByText(/secrets never leave convex/i)).toBeInTheDocument();
    expect(screen.getByText(/backend cannot inspect the vite build-time browser token/i)).toBeInTheDocument();
    expect(screen.getByText(/globe and map cannot render/i)).toBeInTheDocument();
    expect(screen.getByText("Monitors: missing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
