import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  connect: vi.fn(),
  stagehandCreate: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@browserbasehq/stagehand", () => ({
  browserbase: {
    launch: mocks.launch,
    connect: mocks.connect,
  },
  Stagehand: { create: mocks.stagehandCreate },
}));

vi.mock("@browserbasehq/sdk", () => ({
  Browserbase: class {
    sessions = { update: mocks.release };
  },
}));

import {
  connectStagehandV4Session,
  createStagehandV4Primitives,
  createStagehandV4Session,
  StagehandV4CleanupError,
} from "./stagehandV4Runtime";

type TestPage = {
  goto: ReturnType<typeof vi.fn>;
  url: ReturnType<typeof vi.fn>;
  evaluate: ReturnType<typeof vi.fn>;
  waitForTimeout: ReturnType<typeof vi.fn>;
};

function page(url = "https://roomscout.dev/inbox"): TestPage {
  return {
    goto: vi.fn().mockResolvedValue(null),
    url: vi.fn().mockResolvedValue(url),
    evaluate: vi.fn(),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  };
}

function browser(input: {
  sessionId?: string;
  pages?: TestPage[];
  close?: ReturnType<typeof vi.fn>;
} = {}) {
  const pages = input.pages ?? [page()];
  return {
    sessionId: input.sessionId ?? "bb-session-1",
    close: input.close ?? vi.fn().mockResolvedValue(undefined),
    context: {
      pages: vi.fn().mockResolvedValue(pages),
      newPage: vi.fn().mockResolvedValue(page("about:blank")),
    },
  };
}

function stagehand(input: {
  close?: ReturnType<typeof vi.fn>;
  observeData?: unknown;
  extractData?: unknown;
  actSuccess?: boolean;
} = {}) {
  return {
    close: input.close ?? vi.fn().mockResolvedValue(undefined),
    observe: vi.fn().mockResolvedValue({ data: input.observeData ?? [], metadata: {} }),
    extract: vi.fn().mockResolvedValue({ data: input.extractData ?? {}, metadata: {} }),
    act: vi.fn().mockResolvedValue({
      data: { success: input.actSuccess ?? true },
      metadata: {},
    }),
  };
}

const shared = {
  apiKey: "bb-key",
  modelApiKey: "model-key",
  modelName: "openai/gpt-4o",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createStagehandV4Session", () => {
  it("launches a locked-down EU session and initializes v4 with logging and cache off", async () => {
    const testPage = page("https://roomscout.dev/sign-up");
    const testBrowser = browser({ pages: [testPage] });
    const testStagehand = stagehand();
    mocks.launch.mockResolvedValue(testBrowser);
    mocks.stagehandCreate.mockResolvedValue(testStagehand);

    const session = await createStagehandV4Session({
      ...shared,
      contextId: "context-1",
      timeoutMs: 480_000,
      solveCaptchas: true,
      persistContext: true,
      url: "https://roomscout.dev/sign-up",
    });

    expect(mocks.launch).toHaveBeenCalledWith({
      apiKey: "bb-key",
      api_timeout: 480,
      keepAlive: true,
      region: "eu-central-1",
      proxies: false,
      browserSettings: {
        allowedDomains: ["roomscout.dev"],
        solveCaptchas: true,
        logSession: false,
        recordSession: false,
        context: { id: "context-1", persist: true },
      },
    });
    expect(mocks.stagehandCreate).toHaveBeenCalledWith({
      browser: testBrowser,
      model: { modelName: "openai/gpt-4o", apiKey: "model-key" },
      cache: false,
      logging: { level: "off" },
    });
    expect(testPage.goto).toHaveBeenCalledWith("https://roomscout.dev/sign-up");
    expect(session.sessionId).toBe("bb-session-1");
  });

  it("validates secrets, context, and URL before allocating a browser", async () => {
    await expect(createStagehandV4Session({
      ...shared,
      modelApiKey: "",
      timeoutMs: 60_000,
      solveCaptchas: false,
      persistContext: false,
      url: "https://roomscout.dev/",
    })).rejects.toThrow("STAGEHAND_V4_MODEL_API_KEY_MISSING");
    await expect(createStagehandV4Session({
      ...shared,
      timeoutMs: 60_000,
      solveCaptchas: false,
      persistContext: true,
      url: "https://roomscout.dev/",
    })).rejects.toThrow("STAGEHAND_V4_CONTEXT_ID_MISSING");
    await expect(createStagehandV4Session({
      ...shared,
      timeoutMs: 60_000,
      solveCaptchas: false,
      persistContext: false,
      url: "https://example.com/",
    })).rejects.toThrow("STAGEHAND_V4_URL_NOT_ALLOWED");
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it("releases a newly allocated provider session when initialization fails", async () => {
    const testBrowser = browser();
    mocks.launch.mockResolvedValue(testBrowser);
    mocks.stagehandCreate.mockRejectedValue(Object.assign(new Error("provider"), { status: 402 }));

    await expect(createStagehandV4Session({
      ...shared,
      timeoutMs: 60_000,
      solveCaptchas: false,
      persistContext: false,
      url: "https://roomscout.dev/",
    })).rejects.toMatchObject({ status: 402 });
    expect(testBrowser.close).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledWith("bb-session-1", {
      status: "REQUEST_RELEASE",
    });
  });
});

describe("connectStagehandV4Session", () => {
  it("attaches once to the sole live page and preserves the provider session on failure", async () => {
    const blank = page("about:blank");
    const live = page("https://roomscout.dev/verify");
    const testBrowser = browser({ pages: [blank, live] });
    const testStagehand = stagehand();
    mocks.connect.mockResolvedValue(testBrowser);
    mocks.stagehandCreate.mockResolvedValue(testStagehand);

    const session = await connectStagehandV4Session({
      ...shared,
      sessionId: "bb-session-1",
    });
    expect(session.page).toBe(live);
    expect(mocks.connect).toHaveBeenCalledOnce();

    mocks.stagehandCreate.mockRejectedValueOnce(new Error("init"));
    await expect(connectStagehandV4Session({
      ...shared,
      sessionId: "bb-session-1",
    })).rejects.toThrow("init");
    expect(mocks.release).not.toHaveBeenCalled();
  });
});

describe("v4 primitives", () => {
  it("unwraps data, disables per-operation cache, and caps operation timeouts", async () => {
    const actions = [{ selector: "#email", description: "Email", method: "fill" }];
    const testStagehand = stagehand({ observeData: actions, extractData: { ok: true } });
    const testPage = page();
    const primitives = createStagehandV4Primitives({
      stagehand: testStagehand as never,
      page: testPage as never,
      timeoutMs: 480_000,
    });

    await expect(primitives.observe({ instruction: "Find email" })).resolves.toEqual(actions);
    await expect(primitives.extract({
      instruction: "Read state",
      schema: z.object({ ok: z.boolean() }),
    })).resolves.toEqual({ ok: true });
    await primitives.act({ action: actions[0]! });

    expect(testStagehand.observe).toHaveBeenCalledWith("Find email", {
      page: testPage,
      timeout: 120_000,
      cache: false,
    });
    expect(testStagehand.act).toHaveBeenCalledWith(actions[0], {
      page: testPage,
      timeout: 120_000,
      cache: false,
    });
  });

  it("fails a false act result and inspects forms through a static string expression", async () => {
    const testStagehand = stagehand({ actSuccess: false });
    const inspection = {
      count: 1,
      visible: true,
      editable: true,
      name: "emailAddress",
      type: "email",
      autocomplete: "email",
      required: true,
      value: "user@example.test",
      formValid: true,
    };
    const testPage = page();
    testPage.evaluate.mockResolvedValue(inspection);
    const primitives = createStagehandV4Primitives({
      stagehand: testStagehand as never,
      page: testPage as never,
    });

    await expect(primitives.act({
      action: { selector: "#submit", description: "Submit" },
    })).rejects.toThrow("STAGEHAND_V4_ACT_FAILED");
    await expect(primitives.inspectForm({
      selector: "xpath=//input[@name='emailAddress']",
      role: "email",
    })).resolves.toEqual(inspection);
    const expression = testPage.evaluate.mock.calls.at(-1)?.[0];
    expect(typeof expression).toBe("string");
    expect(expression).toContain("document.evaluate");
    expect(expression).not.toContain("__name");
  });

  it("emits browser-valid JavaScript that reads exact DOM form state", async () => {
    document.body.innerHTML = `
      <form id="signup">
        <input id="email" name="emailAddress" type="email" autocomplete="email"
          required value="thedoors@example.test" />
      </form>`;
    const element = document.querySelector("#email") as HTMLInputElement;
    vi.spyOn(element, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    const testPage = page();
    testPage.evaluate.mockImplementation(async (expression: string) => window.eval(expression));
    const primitives = createStagehandV4Primitives({
      stagehand: stagehand() as never,
      page: testPage as never,
    });

    await expect(primitives.inspectForm({ selector: "#email", role: "email" }))
      .resolves.toEqual({
        count: 1,
        visible: true,
        editable: true,
        name: "emailAddress",
        type: "email",
        autocomplete: "email",
        required: true,
        value: "thedoors@example.test",
        formValid: true,
      });
  });
});

describe("session cleanup", () => {
  it("closes Stagehand before disconnecting the browser and is idempotent", async () => {
    const order: string[] = [];
    const testBrowser = browser({
      close: vi.fn(async () => { order.push("browser"); }),
    });
    const testStagehand = stagehand({
      close: vi.fn(async () => { order.push("stagehand"); }),
    });
    mocks.connect.mockResolvedValue(testBrowser);
    mocks.stagehandCreate.mockResolvedValue(testStagehand);
    const session = await connectStagehandV4Session({ ...shared, sessionId: "bb-session-1" });

    await Promise.all([session.close(), session.close()]);
    expect(order).toEqual(["stagehand", "browser"]);
    expect(testStagehand.close).toHaveBeenCalledOnce();
    expect(testBrowser.close).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("still disconnects the browser and exposes only a fixed cleanup error", async () => {
    const testBrowser = browser({ close: vi.fn().mockRejectedValue(new Error("secret browser detail")) });
    const testStagehand = stagehand({ close: vi.fn().mockRejectedValue(new Error("secret model detail")) });
    mocks.connect.mockResolvedValue(testBrowser);
    mocks.stagehandCreate.mockResolvedValue(testStagehand);
    const session = await connectStagehandV4Session({ ...shared, sessionId: "bb-session-1" });

    await expect(session.close()).rejects.toBeInstanceOf(StagehandV4CleanupError);
    await expect(session.close()).rejects.toThrow("STAGEHAND_V4_CLEANUP_FAILED");
    expect(testBrowser.close).toHaveBeenCalledOnce();
  });
});
