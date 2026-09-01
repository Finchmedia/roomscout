import { describe, expect, it } from "vitest";
import {
  bestMessageBody,
  normalizeAgentMailInbox,
  normalizeAgentMailInboxPage,
  normalizeAgentMailMessage,
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

describe("AgentMail component payload normalization", () => {
  it("normalizes snake_case inbox responses without exposing provider shape", () => {
    expect(
      normalizeAgentMailInbox({
        inbox_id: "inbox-1",
        email: "rs-user@agentmail.to",
        client_id: "roomscout-user-1",
      }),
    ).toEqual({
      inboxId: "inbox-1",
      email: "rs-user@agentmail.to",
      clientId: "roomscout-user-1",
    });
    expect(
      normalizeAgentMailInboxPage({
        inboxes: [
          {
            inbox_id: "inbox-1",
            email: "rs-user@agentmail.to",
            client_id: "roomscout-user-1",
          },
          { invalid: true },
        ],
        next_page_token: "next-page",
      }),
    ).toEqual({
      inboxes: [
        {
          inboxId: "inbox-1",
          email: "rs-user@agentmail.to",
          clientId: "roomscout-user-1",
        },
      ],
      nextPageToken: "next-page",
    });
  });

  it("normalizes component message reads and prefers extracted text", () => {
    expect(
      normalizeAgentMailMessage({
        inbox_id: "inbox-1",
        thread_id: "thread-1",
        message_id: "message-1",
        from: "owner@example.com",
        to: [{ email: "rs-user@agentmail.to" }],
        subject: "Re: rehearsal room",
        extracted_text: "The room is still available.",
        html: "<p>Fallback</p>",
        timestamp: "2026-08-28T12:00:00.000Z",
      }),
    ).toEqual({
      inboxId: "inbox-1",
      threadId: "thread-1",
      messageId: "message-1",
      from: "owner@example.com",
      to: ["rs-user@agentmail.to"],
      subject: "Re: rehearsal room",
      body: "The room is still available.",
      htmlAvailable: true,
      occurredAt: Date.parse("2026-08-28T12:00:00.000Z"),
    });
  });
});
