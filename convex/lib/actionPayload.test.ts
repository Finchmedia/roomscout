import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { actionPayloadHash, normalizeActionPayload } from "./actionPayload";

describe("external action payloads", () => {
  it("creates the same hash for semantically normalized content", async () => {
    const base = {
      actionType: "submit_webform",
      destination: "https://example.test/contact",
      fields: [
        { name: "Message", value: " Hello there ", sensitivity: "public" as const },
      ],
    };
    await expect(actionPayloadHash(base)).resolves.toBe(
      await actionPayloadHash({
        ...base,
        actionType: " SUBMIT_WEBFORM ",
        destination: "  https://example.test/contact  ",
        fields: [
          { name: " message ", value: "Hello there", sensitivity: "public" },
        ],
      }),
    );
  });

  it("preserves the ordered exact field snapshot", () => {
    expect(
      normalizeActionPayload({
        actionType: "send_platform_dm",
        destination: "thread:42",
        fields: [
          { name: "subject", value: "Room", sensitivity: "public" },
          { name: "body", value: "Hi", sensitivity: "personal" },
        ],
      }).fields.map((field) => field.name),
    ).toEqual(["subject", "body"]);
  });

  it("rejects ambiguous duplicate fields", () => {
    expect(() =>
      normalizeActionPayload({
        actionType: "submit_webform",
        destination: "https://example.test/contact",
        fields: [
          { name: "message", value: "A", sensitivity: "public" },
          { name: "Message", value: "B", sensitivity: "public" },
        ],
      }),
    ).toThrow(ConvexError);
  });
});
