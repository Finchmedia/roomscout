import { describe, expect, it, vi } from "vitest";
import {
  buildPortalWriteUrl,
  resolvePortalWriteWorkflow,
  runDeterministicPortalWrite,
} from "./portalWriteAdapters";

type FakeLocator = {
  count: ReturnType<typeof vi.fn>;
  isVisible: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  click: ReturnType<typeof vi.fn>;
};

function locator(): FakeLocator {
  return {
    count: vi.fn(async () => 1),
    isVisible: vi.fn(async () => true),
    fill: vi.fn(async () => undefined),
    click: vi.fn(async () => undefined),
  };
}

function fakePage(input?: {
  blocker?: Partial<{
    password: boolean;
    twoFactor: boolean;
    captcha: boolean;
    terms: boolean;
    payment: boolean;
    contract: boolean;
  }>;
  url?: string;
  successVisible?: boolean;
}) {
  const locators = new Map<string, FakeLocator>();
  const getLocator = (selector: string) => {
    let result = locators.get(selector);
    if (!result) {
      result = locator();
      locators.set(selector, result);
    }
    if (selector.includes("write-result") && input?.successVisible === false) {
      result.isVisible.mockResolvedValue(false);
    }
    return result;
  };
  return {
    locators,
    page: {
      url: vi.fn(async () => input?.url ?? "https://portal.example/roomscout-fixture/messages/new"),
      locator: vi.fn(getLocator),
      waitForLoadState: vi.fn(async () => undefined),
      waitForTimeout: vi.fn(async () => undefined),
      evaluate: vi.fn(async (_callback: unknown, argument?: unknown) => {
        if (typeof argument === "string") {
          return { providerThreadId: "thread-1", providerMessageId: "message-1" };
        }
        return {
          password: false,
          twoFactor: false,
          captcha: false,
          terms: false,
          payment: false,
          contract: false,
          ...input?.blocker,
        };
      }),
    },
  };
}

const allowedDomains = ["portal.example"];
const allowedPaths = ["/roomscout-fixture/messages", "/roomscout-fixture/listings"];

describe("reviewed portal write adapters", () => {
  it("fails closed for a database-selected adapter tuple absent from code", () => {
    expect(() =>
      resolvePortalWriteWorkflow({
        adapterKey: "database-injected",
        adapterVersion: 1,
        workflowKey: "arbitrary",
        actionType: "send_platform_dm",
      }),
    ).toThrow("PORTAL_WRITE_ADAPTER_NOT_REVIEWED");
  });

  it("builds only the reviewed path inside the connection allowlists", () => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-fixture-v1",
      adapterVersion: 1,
      workflowKey: "fixture.platform-message.v1",
      actionType: "send_platform_dm",
    });
    expect(
      buildPortalWriteUrl({
        baseUrl: "https://portal.example",
        allowedDomains,
        allowedPaths,
        workflow,
        providerThreadId: "thread/with spaces",
        payload: {
          kind: "platform_message",
          recipients: ["Robin"],
          body: "Hello",
        },
      }),
    ).toBe("https://portal.example/roomscout-fixture/messages/thread%2Fwith%20spaces");
  });

  it("maps the controlled roomscout.dev listing and thread routes", () => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-dev-v1",
      adapterVersion: 1,
      workflowKey: "roomscout-dev.platform-message.v1",
      actionType: "send_platform_dm",
    });
    const payload = {
      kind: "platform_message" as const,
      targetPath: "/listings/listing-1",
      recipients: ["Listing owner"],
      senderLabel: "The Cooks",
      body: "Is the room still available?",
    };
    expect(
      buildPortalWriteUrl({
        baseUrl: "https://roomscout.dev",
        allowedDomains: ["roomscout.dev"],
        allowedPaths: ["/listings", "/inbox"],
        workflow,
        payload,
      }),
    ).toBe("https://roomscout.dev/listings/listing-1");
    expect(
      buildPortalWriteUrl({
        baseUrl: "https://roomscout.dev",
        allowedDomains: ["roomscout.dev"],
        allowedPaths: ["/listings", "/inbox"],
        workflow,
        providerThreadId: "thread-1",
        payload,
      }),
    ).toBe("https://roomscout.dev/inbox/thread-1");
  });

  it("accepts a persisted receipt on the controlled listing after a first message", async () => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-dev-v1",
      adapterVersion: 1,
      workflowKey: "roomscout-dev.platform-message.v1",
      actionType: "send_platform_dm",
    });
    const { page } = fakePage({
      url: "https://roomscout.dev/listings/listing-1",
    });
    const result = await runDeterministicPortalWrite({
      page: page as never,
      workflow,
      payload: {
        kind: "platform_message",
        targetPath: "/listings/listing-1",
        recipients: ["Listing owner"],
        body: "Is the room still available?",
      },
      allowedDomains: ["roomscout.dev"],
      allowedPaths: ["/listings", "/inbox"],
      humanPresenceRequired: false,
    });
    expect(result).toMatchObject({ outcome: "succeeded", submitted: true });
  });

  it("fills deterministic selectors and clicks the reviewed send control once", async () => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-fixture-v1",
      adapterVersion: 1,
      workflowKey: "fixture.platform-message.v1",
      actionType: "send_platform_dm",
    });
    const { page, locators } = fakePage({
      url: "https://portal.example/roomscout-fixture/messages/thread-1",
    });
    const result = await runDeterministicPortalWrite({
      page: page as never,
      workflow,
      payload: {
        kind: "platform_message",
        recipients: ["Robin"],
        subject: "Room inquiry",
        body: "Is the rehearsal slot still free?",
      },
      allowedDomains,
      allowedPaths,
      humanPresenceRequired: false,
    });
    expect(result).toEqual({
      outcome: "succeeded",
      submitted: true,
      providerThreadId: "thread-1",
      providerMessageId: "message-1",
    });
    expect(locators.get('[data-roomscout-write="recipient"]')?.fill).toHaveBeenCalledWith("Robin");
    expect(locators.get('[data-roomscout-write="body"]')?.fill).toHaveBeenCalledWith(
      "Is the rehearsal slot still free?",
    );
    expect(locators.get('[data-roomscout-write="send"]')?.click).toHaveBeenCalledTimes(1);
  });

  it("accepts the controlled portal's in-place Convex receipt on a listing route", async () => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-dev-v1",
      adapterVersion: 1,
      workflowKey: "roomscout-dev.platform-message.v1",
      actionType: "send_platform_dm",
    });
    const { page, locators } = fakePage({
      url: "https://roomscout.dev/listings/listing-1",
    });
    const result = await runDeterministicPortalWrite({
      page: page as never,
      workflow,
      payload: {
        kind: "platform_message",
        targetPath: "/listings/listing-1",
        recipients: ["Listing owner"],
        senderLabel: "The Cooks",
        body: "Is the room still available?",
      },
      allowedDomains: ["roomscout.dev"],
      allowedPaths: ["/listings", "/inbox"],
      humanPresenceRequired: false,
    });
    expect(result).toEqual({
      outcome: "succeeded",
      submitted: true,
      providerThreadId: "thread-1",
      providerMessageId: "message-1",
    });
    expect(locators.get('[data-roomscout-write="sender-label"]')?.fill).toHaveBeenCalledWith("The Cooks");
    expect(locators.get('[data-roomscout-write="send"]')?.click).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["password", { password: true }],
    ["two_factor", { twoFactor: true }],
    ["captcha", { captcha: true }],
    ["terms", { terms: true }],
    ["payment", { payment: true }],
    ["contract", { contract: true }],
  ] as const)("hands off on %s without clicking submit", async (blocker, detected) => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-fixture-v1",
      adapterVersion: 1,
      workflowKey: "fixture.platform-message.v1",
      actionType: "send_platform_dm",
    });
    const { page, locators } = fakePage({ blocker: detected });
    const result = await runDeterministicPortalWrite({
      page: page as never,
      workflow,
      payload: { kind: "platform_message", recipients: ["Robin"], body: "Hello" },
      allowedDomains,
      allowedPaths,
      humanPresenceRequired: false,
    });
    expect(result).toEqual({ outcome: "human_required", blocker, submitted: false });
    expect(locators.has('[data-roomscout-write="send"]')).toBe(false);
  });

  it("does not click when the reviewed policy requires human presence", async () => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-fixture-v1",
      adapterVersion: 1,
      workflowKey: "fixture.platform-message.v1",
      actionType: "send_platform_dm",
    });
    const { page, locators } = fakePage();
    const result = await runDeterministicPortalWrite({
      page: page as never,
      workflow,
      payload: { kind: "platform_message", recipients: ["Robin"], body: "Hello" },
      allowedDomains,
      allowedPaths,
      humanPresenceRequired: true,
    });
    expect(result).toEqual({
      outcome: "human_required",
      blocker: "policy_human_presence",
      submitted: false,
    });
    expect(locators.has('[data-roomscout-write="send"]')).toBe(false);
  });

  it("marks an uncertain post-click result unknown and never retries the click", async () => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-fixture-v1",
      adapterVersion: 1,
      workflowKey: "fixture.platform-message.v1",
      actionType: "send_platform_dm",
    });
    const { page, locators } = fakePage({ successVisible: false });
    const result = await runDeterministicPortalWrite({
      page: page as never,
      workflow,
      payload: { kind: "platform_message", recipients: ["Robin"], body: "Hello" },
      allowedDomains,
      allowedPaths,
      humanPresenceRequired: false,
    });
    expect(result).toEqual({
      outcome: "unknown",
      submitted: true,
      errorCode: "SUBMIT_RESULT_UNKNOWN",
    });
    expect(locators.get('[data-roomscout-write="send"]')?.click).toHaveBeenCalledTimes(1);
  });

  it("waits for a client-rendered receipt without retrying the provider write", async () => {
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: "roomscout-fixture-v1",
      adapterVersion: 1,
      workflowKey: "fixture.platform-message.v1",
      actionType: "send_platform_dm",
    });
    const { page, locators } = fakePage();
    const success = page.locator('[data-roomscout-write-result="sent"]');
    success.isVisible.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await runDeterministicPortalWrite({
      page: page as never,
      workflow,
      payload: { kind: "platform_message", recipients: ["Robin"], body: "Hello" },
      allowedDomains,
      allowedPaths,
      humanPresenceRequired: false,
    });

    expect(result).toMatchObject({ outcome: "succeeded", submitted: true });
    expect(page.waitForTimeout).toHaveBeenCalledWith(250);
    expect(locators.get('[data-roomscout-write="send"]')?.click).toHaveBeenCalledTimes(1);
  });
});
