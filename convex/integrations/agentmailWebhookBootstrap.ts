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

export type AgentMailWebhook = {
  webhookId: string;
  url: string;
  secret?: string;
  enabled: boolean;
  eventTypes: string[];
  clientId?: string;
  inboxIds: string[];
  podIds: string[];
};

export type AccountWebhookConfig = {
  url: string;
  clientId: string;
  eventTypes: readonly string[];
};

export type AccountWebhookPlan =
  | { kind: "create"; exactCount: 0; driftCount: number; collisionCount: number }
  | { kind: "reuse"; exactCount: 1; driftCount: 0; collisionCount: 0; webhook: AgentMailWebhook };

export type AccountWebhookCoverage = {
  exact: AgentMailWebhook[];
  driftCount: number;
  collisionCount: number;
  duplicateClientId: boolean;
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
    inboxIds: Array.isArray(record.inbox_ids)
      ? record.inbox_ids.filter((id): id is string => typeof id === "string")
      : [],
    podIds: Array.isArray(record.pod_ids)
      ? record.pod_ids.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function parseAgentMailWebhook(value: unknown): AgentMailWebhook | null {
  return parseWebhook(value);
}

export function sameAgentMailWebhookConfiguration(
  left: AgentMailWebhook,
  right: AgentMailWebhook,
): boolean {
  const sameStrings = (a: string[], b: string[]) =>
    [...new Set(a)].sort().join("\n") === [...new Set(b)].sort().join("\n");
  return left.webhookId === right.webhookId && left.url === right.url &&
    left.clientId === right.clientId && left.enabled === right.enabled &&
    sameStrings(left.eventTypes, right.eventTypes) &&
    sameStrings(left.inboxIds, right.inboxIds) && sameStrings(left.podIds, right.podIds);
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

/** Build one deployment-bound account endpoint configuration. The provider may
 * materialize the key's scope as a single pod filter; live inbox proof must
 * establish that newly created personal inboxes belong to that pod. */
export function accountWebhookConfig(siteUrl: string): AccountWebhookConfig {
  const url = new URL(siteUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".convex.site") || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_SITE_URL_INVALID");
  }
  return {
    url: `${url.origin}/api/webhooks/agentmail`,
    clientId: `roomscout-agentmail-${url.hostname.replace(/[^a-z0-9-]/gi, "-")}-v1`,
    eventTypes: CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS,
  };
}

function sameConfiguredEvents(actual: string[], expectedEvents: readonly string[]) {
  return [...new Set(actual)].sort().join("\n") === [...expectedEvents].sort().join("\n");
}

export function planAccountWebhookBootstrap(
  webhooks: AgentMailWebhook[],
  config: AccountWebhookConfig,
): AccountWebhookPlan {
  const coverage = summarizeAccountWebhookCoverage(webhooks, config);
  if (coverage.duplicateClientId) throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_DUPLICATE_CLIENT_ID");
  if (coverage.driftCount) throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_CONFIG_MISMATCH");
  if (coverage.collisionCount) throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_URL_ALREADY_CLAIMED");
  if (coverage.exact[0]) return { kind: "reuse", exactCount: 1, driftCount: 0, collisionCount: 0, webhook: coverage.exact[0] };
  return { kind: "create", exactCount: 0, driftCount: 0, collisionCount: 0 };
}

export function summarizeAccountWebhookCoverage(
  webhooks: AgentMailWebhook[],
  config: AccountWebhookConfig,
): AccountWebhookCoverage {
  const byClientId = webhooks.filter((hook) => hook.clientId === config.clientId);
  const exact = byClientId.filter((candidate) => candidate.url === config.url && candidate.enabled &&
    sameConfiguredEvents(candidate.eventTypes, config.eventTypes) &&
    candidate.inboxIds.length === 0 && candidate.podIds.length <= 1);
  return {
    exact,
    driftCount: byClientId.length - exact.length,
    collisionCount: webhooks.filter((hook) => hook.url === config.url && hook.clientId !== config.clientId).length,
    duplicateClientId: byClientId.length > 1,
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
