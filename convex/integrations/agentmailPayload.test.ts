import { describe, expect, it } from "vitest";
import {
  bestMessageBody,
  parseAgentMailEvent,
} from "./agentmailPayload";

describe("parseAgentMailEvent", () => {
  it("parses a received message with mailbox-scoped identifiers", () => {
    const event = parseAgentMailEvent({
      event_type: "message.received",
      event_id: "evt_received",
      message: {
        inbox_id: "inbox_1",
        thread_id: "thread_1",
        message_id: "message_1",
        timestamp: "2026-08-28T10:00:00.000Z",
        from: "Studio <studio@example.com>",
        to: ["scout@agentmail.to"],
        subject: "Re: Proberaum",
        extracted_text: "Dienstags ist noch Platz.",
      },
    });

    expect(event).toMatchObject({
      kind: "received",
      inboxId: "inbox_1",
      providerThreadId: "thread_1",
      providerMessageId: "message_1",
      body: "Dienstags ist noch Platz.",
      needsFullFetch: false,
    });
  });

  it.each([
    ["message.sent", "send", "sent"],
    ["message.delivered", "delivery", "delivered"],
    ["message.bounced", "bounce", "bounced"],
    ["message.rejected", "reject", "rejected"],
    ["message.complained", "complaint", "complained"],
  ] as const)("parses %s", (eventType, property, expectedStatus) => {
    const event = parseAgentMailEvent({
      event_type: eventType,
      event_id: `evt_${expectedStatus}`,
      [property]: {
        inbox_id: "inbox_1",
        thread_id: "thread_1",
        message_id: "message_1",
        timestamp: "2026-08-28T10:00:00.000Z",
        reason: expectedStatus === "rejected" ? "policy" : undefined,
      },
    });

    expect(event).toMatchObject({
      kind: "delivery",
      inboxId: "inbox_1",
      providerThreadId: "thread_1",
      providerMessageId: "message_1",
      status: expectedStatus,
    });
  });

  it("rejects supported events that lack mailbox routing identifiers", () => {
    expect(
      parseAgentMailEvent({
        event_type: "message.received",
        message: { thread_id: "thread_1", message_id: "message_1" },
      }),
    ).toBeNull();
  });

  it("requests a full fetch when a webhook only contains a preview", () => {
    expect(
      parseAgentMailEvent({
        event_type: "message.received",
        message: {
          inbox_id: "inbox_1",
          thread_id: "thread_1",
          message_id: "message_1",
          preview: "Truncated preview…",
        },
      }),
    ).toMatchObject({ body: "Truncated preview…", needsFullFetch: true });
  });

  it("accepts camelCase payload fields", () => {
    expect(
      parseAgentMailEvent({
        eventType: "message.delivered",
        eventId: "evt_1",
        delivery: {
          inboxId: "inbox_1",
          threadId: "thread_1",
          messageId: "message_1",
          timestamp: 1_777_000_000,
        },
      }),
    ).toMatchObject({ status: "delivered", occurredAt: 1_777_000_000_000 });
  });
});

describe("bestMessageBody", () => {
  it("prefers extracted text and converts HTML as a final fallback", () => {
    expect(
      bestMessageBody({ extractedText: "Neue Antwort", text: "Alter Verlauf" }),
    ).toBe("Neue Antwort");
    expect(
      bestMessageBody({ html: "<style>.x{}</style><p>Hallo &amp; willkommen</p>" }),
    ).toBe("Hallo & willkommen");
  });
});
