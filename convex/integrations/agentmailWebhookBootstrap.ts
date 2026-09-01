export const CONTROLLED_AGENTMAIL_WEBHOOK_URL =
  "https://fleet-jackal-83.eu-west-1.convex.site/api/webhooks/agentmail";

export const CONTROLLED_AGENTMAIL_WEBHOOK_CLIENT_ID =
  "roomscout-production-agentmail-v1";

export const CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS = [
  "message.received",
  "message.sent",
  "message.delivered",
  "message.bounced",
  "message.rejected",
  "message.complained",
] as const;

type AgentMailWebhook = {
  webhookId: string;
  url: string;
  secret?: string;
  enabled: boolean;
  eventTypes: string[];
  clientId?: string;
};

export type ScopedWebhookBootstrapPlan =
  | { kind: "create" }
  | { kind: "reuse"; secret?: string };

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseWebhook(value: unknown): AgentMailWebhook | null {
  const record = recordOf(value);
  if (!record) return null;
  const webhookId = stringValue(record, "webhook_id");
  const url = stringValue(record, "url");
  if (!webhookId || !url) return null;
  return {
    webhookId,
    url,
    secret: stringValue(record, "secret"),
    enabled: record.enabled !== false,
    eventTypes: Array.isArray(record.event_types)
      ? record.event_types.filter(
          (event): event is string => typeof event === "string",
        )
      : [],
    clientId: stringValue(record, "client_id"),
  };
}

export function parseAgentMailWebhookPage(value: unknown): {
  webhooks: AgentMailWebhook[];
  hasMore: boolean;
} {
  const record = recordOf(value);
  const webhooks = Array.isArray(record?.webhooks)
    ? record.webhooks
        .map(parseWebhook)
        .filter((hook): hook is AgentMailWebhook => hook !== null)
    : [];
  return {
    webhooks,
    hasMore: Boolean(stringValue(record ?? {}, "next_page_token")),
  };
}

function sameEvents(actual: string[]) {
  const expected = [...CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS].sort();
  return [...new Set(actual)].sort().join("\n") === expected.join("\n");
}

export function planScopedWebhookBootstrap(
  webhooks: AgentMailWebhook[],
): ScopedWebhookBootstrapPlan {
  const byClientId = webhooks.filter(
    (hook) => hook.clientId === CONTROLLED_AGENTMAIL_WEBHOOK_CLIENT_ID,
  );
  if (byClientId.length > 1) {
    throw new Error("CONTROLLED_AGENTMAIL_WEBHOOK_DUPLICATE_CLIENT_ID");
  }
  const existing = byClientId[0];
  if (existing) {
    if (
      existing.url !== CONTROLLED_AGENTMAIL_WEBHOOK_URL ||
      !existing.enabled ||
      !sameEvents(existing.eventTypes)
    ) {
      throw new Error("CONTROLLED_AGENTMAIL_WEBHOOK_CONFIG_MISMATCH");
    }
    return {
      kind: "reuse",
      ...(existing.secret ? { secret: existing.secret } : {}),
    };
  }
  if (
    webhooks.some((hook) => hook.url === CONTROLLED_AGENTMAIL_WEBHOOK_URL)
  ) {
    throw new Error("CONTROLLED_AGENTMAIL_WEBHOOK_URL_ALREADY_CLAIMED");
  }
  return { kind: "create" };
}

export function resolveScopedWebhookSigningSecret(
  providerSecret: string | undefined,
  deploymentSecret: string | undefined,
): string {
  const secret = providerSecret?.trim() || deploymentSecret?.trim();
  if (!secret) {
    throw new Error("CONTROLLED_AGENTMAIL_WEBHOOK_SECRET_MISSING");
  }
  return secret;
}

export function signingSecretFromCreateResponse(value: unknown): string {
  const hook = parseWebhook(value);
  if (
    !hook ||
    hook.clientId !== CONTROLLED_AGENTMAIL_WEBHOOK_CLIENT_ID ||
    hook.url !== CONTROLLED_AGENTMAIL_WEBHOOK_URL ||
    !hook.enabled ||
    !sameEvents(hook.eventTypes) ||
    !hook.secret
  ) {
    throw new Error("CONTROLLED_AGENTMAIL_WEBHOOK_CREATE_RESPONSE_INVALID");
  }
  return hook.secret;
}
