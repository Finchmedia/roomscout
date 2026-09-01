import { describe, expect, it } from "vitest";
import {
  CONTROLLED_AGENTMAIL_WEBHOOK_CLIENT_ID,
  CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS,
  CONTROLLED_AGENTMAIL_WEBHOOK_URL,
  parseAgentMailWebhookPage,
  planScopedWebhookBootstrap,
  resolveScopedWebhookSigningSecret,
  signingSecretFromCreateResponse,
} from "./agentmailWebhookBootstrap";

const exactWebhook = {
  webhook_id: "webhook-controlled",
  url: CONTROLLED_AGENTMAIL_WEBHOOK_URL,
  secret: "webhook-signing-secret",
  enabled: true,
  event_types: [...CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS],
  client_id: CONTROLLED_AGENTMAIL_WEBHOOK_CLIENT_ID,
};

describe("controlled AgentMail scoped webhook bootstrap", () => {
  it("uses only the approved production destination and event set", () => {
    expect(CONTROLLED_AGENTMAIL_WEBHOOK_URL).toBe(
      "https://fleet-jackal-83.eu-west-1.convex.site/api/webhooks/agentmail",
    );
    expect(CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS).toEqual([
      "message.received",
      "message.sent",
      "message.delivered",
      "message.bounced",
      "message.rejected",
      "message.complained",
    ]);
  });

  it("creates only when the destination is unclaimed", () => {
    expect(planScopedWebhookBootstrap([])).toEqual({ kind: "create" });
  });

  it("reuses an exact client-id configuration and returns only its secret", () => {
    const page = parseAgentMailWebhookPage({ webhooks: [exactWebhook] });
    expect(planScopedWebhookBootstrap(page.webhooks)).toEqual({
      kind: "reuse",
      secret: "webhook-signing-secret",
    });
  });

  it("falls back to the configured deployment secret when list omits it", () => {
    const withoutSecret = { ...exactWebhook, secret: undefined };
    const page = parseAgentMailWebhookPage({ webhooks: [withoutSecret] });
    expect(planScopedWebhookBootstrap(page.webhooks)).toEqual({
      kind: "reuse",
    });
    expect(
      resolveScopedWebhookSigningSecret(undefined, "deployment-secret"),
    ).toBe("deployment-secret");
    expect(() =>
      resolveScopedWebhookSigningSecret(undefined, undefined),
    ).toThrow("CONTROLLED_AGENTMAIL_WEBHOOK_SECRET_MISSING");
  });

  it("rejects drift and ambiguous existing destinations", () => {
    const drifted = parseAgentMailWebhookPage({
      webhooks: [{ ...exactWebhook, event_types: ["message.received"] }],
    });
    expect(() => planScopedWebhookBootstrap(drifted.webhooks)).toThrow(
      "CONTROLLED_AGENTMAIL_WEBHOOK_CONFIG_MISMATCH",
    );

    const claimed = parseAgentMailWebhookPage({
      webhooks: [{ ...exactWebhook, client_id: "another-client" }],
    });
    expect(() => planScopedWebhookBootstrap(claimed.webhooks)).toThrow(
      "CONTROLLED_AGENTMAIL_WEBHOOK_URL_ALREADY_CLAIMED",
    );
  });

  it("validates the provider create response before exposing its secret", () => {
    expect(signingSecretFromCreateResponse(exactWebhook)).toBe(
      "webhook-signing-secret",
    );
    expect(() =>
      signingSecretFromCreateResponse({
        ...exactWebhook,
        client_id: "unexpected-client",
      }),
    ).toThrow("CONTROLLED_AGENTMAIL_WEBHOOK_CREATE_RESPONSE_INVALID");
  });
});
