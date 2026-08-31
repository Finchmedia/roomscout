import { z } from "zod";

export const PORTAL_RUN_TTLS_MS = {
  recon: 5 * 60_000,
  authenticate: 8 * 60_000,
  inbox_sync: 2 * 60_000,
} as const;

export const PORTAL_CIRCUIT_FAILURES = 3;
export const PORTAL_CIRCUIT_COOLDOWN_MS = 24 * 60 * 60_000;
export const PORTAL_MAX_RECON_RESULTS = 5;
export const PORTAL_MAX_INBOX_THREADS = 20;
export const PORTAL_MAX_MESSAGES_PER_THREAD = 20;

const reconItemSchema = z.object({
  title: z.string(),
  url: z.string(),
});

const inboxMessageSchema = z.object({
  providerMessageId: z.string(),
  direction: z.enum(["inbound", "outbound", "unknown"]),
  senderLabel: z.string().optional(),
  bodyText: z.string(),
  sentAt: z.number(),
});

const inboxThreadSchema = z.object({
  providerThreadId: z.string(),
  subject: z.string().optional(),
  participants: z.array(z.string()),
  lastMessageAt: z.number(),
  messages: z.array(inboxMessageSchema),
});

function trimText(value: string, maxLength: number): string {
  return redactCredentialLikeText(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function redactCredentialLikeText(value: string): string {
  return value
    .replace(
      /\b(password|passwd|passcode|secret|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .replace(
      /\b(otp|2fa|verification code|login code)\s*[:=]?\s*\d{4,10}\b/gi,
      "$1 [REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [REDACTED]");
}

export function normalizeHostname(value: string): string {
  const candidate = value.includes("://") ? value : `https://${value}`;
  const parsed = new URL(candidate);
  if (parsed.protocol !== "https:") {
    throw new Error("HTTPS_REQUIRED");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("PUBLIC_HOST_REQUIRED");
  }
  return hostname;
}

export function isAllowedHostname(
  hostname: string,
  allowedDomains: readonly string[],
): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return allowedDomains.some((allowed) => {
    const domain = normalizeHostname(allowed);
    return normalized === domain || normalized.endsWith(`.${domain}`);
  });
}

export function buildAllowedPortalUrl(input: {
  baseUrl: string;
  path: string;
  allowedDomains: readonly string[];
  allowedPaths: readonly string[];
}): string {
  const base = new URL(input.baseUrl);
  if (base.protocol !== "https:") throw new Error("HTTPS_REQUIRED");
  if (!isAllowedHostname(base.hostname, input.allowedDomains)) {
    throw new Error("DOMAIN_NOT_ALLOWED");
  }

  const target = new URL(input.path || "/", base);
  if (target.username || target.password) throw new Error("URL_CREDENTIALS_FORBIDDEN");
  if (!isAllowedHostname(target.hostname, input.allowedDomains)) {
    throw new Error("DOMAIN_NOT_ALLOWED");
  }
  if (target.protocol !== "https:") throw new Error("HTTPS_REQUIRED");
  target.hash = "";

  const normalizedAllowedPaths = input.allowedPaths.map((path) =>
    path.startsWith("/") ? path : `/${path}`,
  );
  if (
    normalizedAllowedPaths.length > 0 &&
    !normalizedAllowedPaths.some(
      (path) => target.pathname === path || target.pathname.startsWith(`${path}/`),
    )
  ) {
    throw new Error("PATH_NOT_ALLOWED");
  }
  return target.toString();
}

export function sanitizeProviderError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "PROVIDER_TIMEOUT";
    const upper = `${error.name} ${error.message}`.toUpperCase();
    if (upper.includes("TIMEOUT")) return "PROVIDER_TIMEOUT";
    if (upper.includes("401") || upper.includes("403")) return "PROVIDER_AUTH_FAILED";
    if (upper.includes("429") || upper.includes("RATE")) return "PROVIDER_RATE_LIMITED";
    if (upper.includes("POST_SUBMIT_PATH_NOT_ALLOWED")) return "POST_SUBMIT_PATH_NOT_ALLOWED";
    if (upper.includes("DOMAIN_NOT_ALLOWED")) return "DOMAIN_NOT_ALLOWED";
    if (upper.includes("PATH_NOT_ALLOWED")) return "PATH_NOT_ALLOWED";
    if (upper.includes("PORTAL_WRITE_ADAPTER_NOT_REVIEWED")) {
      return "PORTAL_WRITE_ADAPTER_NOT_REVIEWED";
    }
    if (upper.includes("PORTAL_SELECTOR_MISMATCH")) return "PORTAL_SELECTOR_MISMATCH";
    if (upper.includes("LISTING_TITLE_REQUIRED")) return "LISTING_TITLE_REQUIRED";
    if (upper.includes("PORTAL_CONNECTION_SCOPE_MISMATCH")) {
      return "PORTAL_CONNECTION_SCOPE_MISMATCH";
    }
    if (upper.includes("PORTAL_REAUTH_REQUIRED")) return "PORTAL_REAUTH_REQUIRED";
    if (upper.includes("PLATFORM_THREAD_NOT_FOUND")) return "PLATFORM_THREAD_NOT_FOUND";
    if (upper.includes("PLATFORM_RECIPIENT_REQUIRED")) return "PLATFORM_RECIPIENT_REQUIRED";
    if (upper.includes("PORTAL_WRITE_SESSION_EXPIRED")) {
      return "PORTAL_WRITE_SESSION_EXPIRED";
    }
    if (upper.includes("BROWSERBASE_WRITE_CONCURRENCY_LIMIT")) {
      return "BROWSERBASE_WRITE_CONCURRENCY_LIMIT";
    }
    if (upper.includes("BROWSERBASE_ACTION_NOT_SUPPORTED")) {
      return "BROWSERBASE_ACTION_NOT_SUPPORTED";
    }
    if (upper.includes("BROWSERBASE_PAYLOAD_NOT_SUPPORTED")) {
      return "BROWSERBASE_PAYLOAD_NOT_SUPPORTED";
    }
  }
  return "PROVIDER_ERROR";
}

export function sanitizeReconItems(
  value: unknown,
  allowedDomains: readonly string[],
): Array<{ title: string; url: string }> {
  const parsed = z.array(reconItemSchema).safeParse(value);
  if (!parsed.success) return [];

  const seen = new Set<string>();
  const result: Array<{ title: string; url: string }> = [];
  for (const item of parsed.data) {
    if (result.length >= PORTAL_MAX_RECON_RESULTS) break;
    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:" || !isAllowedHostname(url.hostname, allowedDomains)) {
        continue;
      }
      url.hash = "";
      const canonical = url.toString();
      if (seen.has(canonical)) continue;
      const title = trimText(item.title, 200);
      if (!title) continue;
      seen.add(canonical);
      result.push({ title, url: canonical });
    } catch {
      // Ignore malformed or cross-domain links returned by an untrusted page.
    }
  }
  return result;
}

export type SafeInboxThread = z.infer<typeof inboxThreadSchema>;

export function sanitizeInboxThreads(value: unknown): SafeInboxThread[] {
  const parsed = z.array(inboxThreadSchema).safeParse(value);
  if (!parsed.success) return [];

  return parsed.data.slice(0, PORTAL_MAX_INBOX_THREADS).flatMap((thread) => {
    const providerThreadId = trimText(thread.providerThreadId, 200);
    if (!providerThreadId) return [];
    const messages = thread.messages
      .slice(0, PORTAL_MAX_MESSAGES_PER_THREAD)
      .flatMap((message) => {
        const providerMessageId = trimText(message.providerMessageId, 200);
        const bodyText = trimText(message.bodyText, 10_000);
        if (!providerMessageId || !bodyText || !Number.isFinite(message.sentAt)) return [];
        return [{
          providerMessageId,
          direction: message.direction,
          senderLabel: message.senderLabel
            ? trimText(message.senderLabel, 200)
            : undefined,
          bodyText,
          sentAt: message.sentAt,
        }];
      });
    return [{
      providerThreadId,
      subject: thread.subject ? trimText(thread.subject, 500) : undefined,
      participants: thread.participants
        .slice(0, 20)
        .map((participant) => trimText(participant, 200))
        .filter(Boolean),
      lastMessageAt: Number.isFinite(thread.lastMessageAt)
        ? thread.lastMessageAt
        : Date.now(),
      messages,
    }];
  });
}
