export type AgentMailDeliveryStatus =
  | "sent"
  | "delivered"
  | "bounced"
  | "rejected"
  | "complained";

type AgentMailDeliveryEventType =
  | "message.sent"
  | "message.delivered"
  | "message.bounced"
  | "message.rejected"
  | "message.complained";

export type ParsedAgentMailEvent =
  | {
      kind: "received";
      eventId?: string;
      eventType: "message.received";
      inboxId: string;
      providerThreadId: string;
      providerMessageId: string;
      from: string;
      to: string[];
      subject: string;
      body: string;
      needsFullFetch: boolean;
      htmlAvailable: boolean;
      occurredAt: number;
    }
  | {
      kind: "delivery";
      eventId?: string;
      eventType: AgentMailDeliveryEventType;
      inboxId: string;
      providerThreadId: string;
      providerMessageId: string;
      status: AgentMailDeliveryStatus;
      error?: string;
      occurredAt: number;
    };

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function addressValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  const record = recordOf(value);
  return record
    ? stringValue(record, "email", "address", "email_address", "emailAddress")
    : undefined;
}

function addressList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const address = addressValue(value);
    return address ? [address] : [];
  }
  return value
    .map(addressValue)
    .filter((address): address is string => address !== undefined);
}

function occurredAt(record: Record<string, unknown>): number {
  const raw =
    record.timestamp ??
    record.occurred_at ??
    record.occurredAt ??
    record.created_at ??
    record.createdAt;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 10_000_000_000 ? raw * 1_000 : raw;
  }
  if (typeof raw === "string") {
    const timestamp = Date.parse(raw);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }
  return Date.now();
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function bestMessageBody(message: {
  extractedText?: string;
  text?: string;
  preview?: string;
  html?: string;
}): string {
  return (
    message.extractedText?.trim() ||
    message.text?.trim() ||
    message.preview?.trim() ||
    (message.html ? htmlToPlainText(message.html) : "")
  );
}

const deliveryConfig = {
  "message.sent": { property: "send", status: "sent" },
  "message.delivered": { property: "delivery", status: "delivered" },
  "message.bounced": { property: "bounce", status: "bounced" },
  "message.rejected": { property: "reject", status: "rejected" },
  "message.complained": { property: "complaint", status: "complained" },
} as const;

export function parseAgentMailEvent(payload: unknown): ParsedAgentMailEvent | null {
  const root = recordOf(payload);
  if (!root) {
    return null;
  }
  const eventType = stringValue(root, "event_type", "eventType");
  const eventId = stringValue(root, "event_id", "eventId");

  if (eventType === "message.received") {
    const message = recordOf(root.message);
    if (!message) {
      return null;
    }
    const inboxId = stringValue(message, "inbox_id", "inboxId");
    const providerThreadId = stringValue(message, "thread_id", "threadId");
    const providerMessageId = stringValue(message, "message_id", "messageId");
    if (!inboxId || !providerThreadId || !providerMessageId) {
      return null;
    }
    const extractedText = stringValue(message, "extracted_text", "extractedText");
    const text = stringValue(message, "text");
    const preview = stringValue(message, "preview");
    const html = stringValue(message, "html", "extracted_html", "extractedHtml");
    return {
      kind: "received",
      eventId,
      eventType,
      inboxId,
      providerThreadId,
      providerMessageId,
      from: addressValue(message.from) ?? "unknown",
      to: addressList(message.to),
      subject: stringValue(message, "subject") ?? "(no subject)",
      body: bestMessageBody({ extractedText, text, preview, html }),
      needsFullFetch: !extractedText && !text,
      htmlAvailable: html !== undefined,
      occurredAt: occurredAt(message),
    };
  }

  if (!(eventType && eventType in deliveryConfig)) {
    return null;
  }
  const config = deliveryConfig[eventType as keyof typeof deliveryConfig];
  const details = recordOf(root[config.property]);
  if (!details) {
    return null;
  }
  const inboxId = stringValue(details, "inbox_id", "inboxId");
  const providerThreadId = stringValue(details, "thread_id", "threadId");
  const providerMessageId = stringValue(details, "message_id", "messageId");
  if (!inboxId || !providerThreadId || !providerMessageId) {
    return null;
  }
  const reason = stringValue(details, "reason");
  const type = stringValue(details, "type");
  const subType = stringValue(details, "sub_type", "subType");
  const error =
    reason ?? ([type, subType].filter(Boolean).join(": ") || undefined);
  return {
    kind: "delivery",
    eventId,
    eventType: eventType as AgentMailDeliveryEventType,
    inboxId,
    providerThreadId,
    providerMessageId,
    status: config.status,
    error,
    occurredAt: occurredAt(details),
  };
}
