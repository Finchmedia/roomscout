import { describe, expect, it } from "vitest";
import {
  CONTROLLED_AGENTMAIL_WEBHOOK_CLIENT_ID,
  CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS,
  CONTROLLED_AGENTMAIL_WEBHOOK_URL,
  accountWebhookConfig,
  parseAgentMailWebhookPage,
  parseAgentMailWebhook,
  planScopedWebhookBootstrap,
  planAccountWebhookBootstrap,
  sameAgentMailWebhookConfiguration,
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

describe("account-wide AgentMail webhook planning", () => {
  const config = accountWebhookConfig("https://perceptive-antelope-445.eu-west-1.convex.site");
  const exact = {
    webhook_id: "wh_account",
    url: config.url,
    enabled: true,
    event_types: [...config.eventTypes],
    client_id: config.clientId,
  };

  it("derives a deployment-specific callback and stable client id", () => {
    expect(config).toMatchObject({
      url: "https://perceptive-antelope-445.eu-west-1.convex.site/api/webhooks/agentmail",
      clientId: "roomscout-agentmail-perceptive-antelope-445-eu-west-1-convex-site-v1",
    });
    expect(() => accountWebhookConfig("https://example.com")).toThrow("AGENTMAIL_ACCOUNT_WEBHOOK_SITE_URL_INVALID");
  });

  it("creates when absent and reuses account-wide or one-pod-wide coverage", () => {
    expect(planAccountWebhookBootstrap([], config).kind).toBe("create");
    const parsed = parseAgentMailWebhookPage({ webhooks: [exact] });
    expect(planAccountWebhookBootstrap(parsed.webhooks, config).kind).toBe("reuse");
    const podWide = parseAgentMailWebhookPage({ webhooks: [{ ...exact, pod_ids: ["pod_1"] }] });
    expect(planAccountWebhookBootstrap(podWide.webhooks, config).kind).toBe("reuse");
    const filtered = parseAgentMailWebhookPage({ webhooks: [{ ...exact, inbox_ids: ["inbox_1"] }] });
    expect(() => planAccountWebhookBootstrap(filtered.webhooks, config)).toThrow("AGENTMAIL_ACCOUNT_WEBHOOK_CONFIG_MISMATCH");
    const multiplePods = parseAgentMailWebhookPage({ webhooks: [{ ...exact, pod_ids: ["pod_1", "pod_2"] }] });
    expect(() => planAccountWebhookBootstrap(multiplePods.webhooks, config)).toThrow("AGENTMAIL_ACCOUNT_WEBHOOK_CONFIG_MISMATCH");
  });

  it("rejects duplicate ids, drift, and callback collisions without rotating hooks", () => {
    const duplicate = parseAgentMailWebhookPage({ webhooks: [exact, { ...exact, webhook_id: "wh_2" }] });
    expect(() => planAccountWebhookBootstrap(duplicate.webhooks, config)).toThrow("AGENTMAIL_ACCOUNT_WEBHOOK_DUPLICATE_CLIENT_ID");
    const collision = parseAgentMailWebhookPage({ webhooks: [{ ...exact, client_id: "someone-else" }] });
    expect(() => planAccountWebhookBootstrap(collision.webhooks, config)).toThrow("AGENTMAIL_ACCOUNT_WEBHOOK_URL_ALREADY_CLAIMED");
    const exactWithCollision = parseAgentMailWebhookPage({
      webhooks: [exact, { ...exact, webhook_id: "wh_other", client_id: "someone-else" }],
    });
    expect(() => planAccountWebhookBootstrap(exactWithCollision.webhooks, config)).toThrow("AGENTMAIL_ACCOUNT_WEBHOOK_URL_ALREADY_CLAIMED");
  });

  it("trusts a detail secret only when the full webhook identity still matches", () => {
    const listed = parseAgentMailWebhook(exact);
    const detail = parseAgentMailWebhook({ ...exact, secret: "detail-secret" });
    const driftedDetail = parseAgentMailWebhook({ ...exact, url: "https://elsewhere.invalid/webhook", secret: "detail-secret" });
    expect(listed && detail && sameAgentMailWebhookConfiguration(listed, detail)).toBe(true);
    expect(listed && driftedDetail && sameAgentMailWebhookConfiguration(listed, driftedDetail)).toBe(false);
  });
});
