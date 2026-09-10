import { describe, expect, it, vi } from "vitest";
import {
  resolvePersistedPortalBrowserEngine,
  resolvePortalBrowserEngine,
  selectSingleLivePageUrl,
} from "./browserbasePortal";
import {
  sendPortalMessage,
  type StagehandPortalPrimitives,
} from "./integrations/stagehandPortalDriver";

describe("Stagehand portal orchestration routing", () => {
  it("selects Stagehand only for the exact controlled-demo gate", () => {
    expect(resolvePortalBrowserEngine({
      configuredExecutor: "stagehand",
      controlledDemo: true,
    })).toBe("stagehand");
    expect(resolvePortalBrowserEngine({
      configuredExecutor: "stagehand",
      controlledDemo: false,
    })).toBe("legacy");
    expect(resolvePortalBrowserEngine({
      configuredExecutor: undefined,
      controlledDemo: true,
    })).toBe("legacy");
  });

  it("keeps pre-migration and explicitly legacy runs on legacy continuation", () => {
    expect(resolvePersistedPortalBrowserEngine(undefined)).toBe("legacy");
    expect(resolvePersistedPortalBrowserEngine("legacy")).toBe("legacy");
    expect(resolvePersistedPortalBrowserEngine("stagehand")).toBe("stagehand");
  });

  it("fails closed unless exactly one live browser page supplies the URL", () => {
    expect(selectSingleLivePageUrl([
      { url: "about:blank" },
      { url: "https://roomscout.dev/inbox" },
    ])).toBe("https://roomscout.dev/inbox");
    expect(() => selectSingleLivePageUrl([])).toThrow(
      "STAGEHAND_LIVE_PAGE_AMBIGUOUS",
    );
    expect(() => selectSingleLivePageUrl([
      { url: "https://roomscout.dev/inbox" },
      { url: "https://attacker.test/" },
    ])).toThrow("STAGEHAND_LIVE_PAGE_AMBIGUOUS");
  });

  it("claims immediately before the one submit action", async () => {
    const events: string[] = [];
    const extracts = [
      { authenticated: true, stage: "authenticated", blocker: null },
      { authenticated: true, stage: "authenticated", blocker: null },
    ];
    const evidence = [
      { kind: "access" as const, authenticated: true },
      { kind: "composer" as const, body: "Approved body" },
      { kind: "receipt" as const, visible: true, providerThreadId: "thread_1", providerMessageId: "message_1" },
      { kind: "access" as const, authenticated: true },
      { kind: "thread" as const, thread: {
        providerThreadId: "thread_1", participants: [], lastMessageAt: 1,
        messages: [{ providerMessageId: "message_1", direction: "outbound", bodyText: "Approved body", sentAt: 1 }],
      } },
    ];
    let bodyValue = "";
    const client: StagehandPortalPrimitives = {
      navigate: vi.fn(async () => undefined),
      getUrl: vi.fn(async () => "https://roomscout.dev/inbox/thread_1"),
      observe: vi.fn(async ({ instruction }) => {
        const fill = instruction.includes("%body%");
        events.push(fill ? "observe-fill" : "observe-submit");
        return [{
          description: "one",
          selector: "xpath=/one",
          method: fill ? "fill" : "click",
          ...(fill ? { arguments: ["%body%"] } : {}),
        }];
      }),
      act: vi.fn(async ({ action }) => {
        events.push(`act-${action.method}`);
        if (action.method === "fill") bodyValue = "Approved body";
      }),
      inspectForm: vi.fn(async ({ role }) => ({
        count: 1, visible: true, editable: role !== "submit",
        name: role === "message_body" ? "body" : null,
        type: role === "message_body" ? "textarea" : "submit",
        autocomplete: null, required: true, value: bodyValue, formValid: true,
      })),
      extract: vi.fn(async ({ schema }) => schema.parse(extracts.shift())),
      readEvidence: vi.fn(async () => evidence.shift()!),
    };
    await expect(sendPortalMessage({
      client,
      baseUrl: "https://roomscout.dev",
      adapterKey: "roomscout-dev-v1",
      body: "Approved body",
      targetPath: "/listings/listing_1",
      beforeSubmit: async () => { events.push("claim"); },
    })).resolves.toMatchObject({ outcome: "succeeded", submitted: true });
    expect(events).toEqual([
      "observe-fill",
      "act-fill",
      "observe-submit",
      "claim",
      "act-click",
    ]);
  });
});
