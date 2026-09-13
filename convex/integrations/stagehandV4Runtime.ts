"use node";

import {
  browserbase,
  Stagehand,
  type Action,
  type ModelName,
  type Page,
  type StagehandBrowser,
} from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import { z, type ZodType } from "zod";
import { readPortalDomEvidenceFromPage } from "./portalDomEvidence";
import { inspectPortalFormOnPage } from "./portalFormInspection";
import {
  REVIEWED_PORTAL_ORIGIN,
  reviewedPortalUrl,
} from "./reviewedPortalUrl";
import type {
  PortalDomEvidence,
  PortalFormInspection,
  PortalFormRole,
  StagehandObservedAction,
  StagehandPortalPrimitives,
} from "./stagehandPortalDriver";

const DEFAULT_OPERATION_TIMEOUT_MS = 120_000;
const MIN_PROVIDER_TIMEOUT_SECONDS = 60;
const MAX_PROVIDER_TIMEOUT_SECONDS = 21_600;

export interface StagehandV4PortalPrimitives extends StagehandPortalPrimitives {
  inspectForm(input: {
    selector: string;
    role: PortalFormRole;
  }): Promise<PortalFormInspection>;
}

export type StagehandV4Session = {
  sessionId: string;
  browser: StagehandBrowser;
  stagehand: Stagehand;
  page: Page;
  primitives: StagehandV4PortalPrimitives;
  close(): Promise<void>;
};

type SharedSessionConfig = {
  apiKey: string;
  modelApiKey: string;
  modelName: string;
  timeoutMs?: number;
};

export type CreateStagehandV4SessionConfig = SharedSessionConfig & {
  contextId?: string;
  timeoutMs: number;
  solveCaptchas: boolean;
  persistContext: boolean;
  url: string;
};

export type ConnectStagehandV4SessionConfig = SharedSessionConfig & {
  sessionId: string;
};

export class StagehandV4CleanupError extends Error {
  readonly code = "STAGEHAND_V4_CLEANUP_FAILED";

  constructor() {
    super("STAGEHAND_V4_CLEANUP_FAILED");
    this.name = "StagehandV4CleanupError";
  }
}

function required(value: string, code: string): string {
  if (value.trim().length === 0) throw new Error(code);
  return value;
}

function operationTimeout(timeoutMs: number | undefined): number {
  const value = timeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("STAGEHAND_V4_TIMEOUT_INVALID");
  }
  return Math.floor(value);
}

function primitiveTimeout(timeoutMs: number | undefined): number {
  return Math.min(DEFAULT_OPERATION_TIMEOUT_MS, operationTimeout(timeoutMs));
}

function providerTimeoutSeconds(timeoutMs: number): number {
  return Math.min(
    MAX_PROVIDER_TIMEOUT_SECONDS,
    Math.max(MIN_PROVIDER_TIMEOUT_SECONDS, Math.ceil(timeoutMs / 1_000)),
  );
}

function asAction(action: StagehandObservedAction): Action {
  return {
    selector: action.selector,
    description: action.description,
    ...(action.method ? { method: action.method } : {}),
    ...(action.arguments ? { arguments: action.arguments } : {}),
  };
}

export function createStagehandV4Primitives(input: {
  stagehand: Stagehand;
  page: Page;
  timeoutMs?: number;
}): StagehandV4PortalPrimitives {
  const timeout = primitiveTimeout(input.timeoutMs);
  return {
    async navigate({ url }) {
      await input.page.goto(reviewedPortalUrl(url, "STAGEHAND_V4_URL_NOT_ALLOWED"));
      const current = new URL(await input.page.url());
      if (current.origin !== REVIEWED_PORTAL_ORIGIN) {
        throw new Error("STAGEHAND_V4_NAVIGATION_ESCAPED");
      }
    },
    async getUrl() {
      return await input.page.url();
    },
    async observe({ instruction, options }) {
      const result = await input.stagehand.observe(instruction, {
        page: input.page,
        timeout,
        cache: false,
        ...(options?.variables ? { variables: options.variables } : {}),
      });
      return result.data;
    },
    async act({ action, options }) {
      const result = await input.stagehand.act(asAction(action), {
        page: input.page,
        timeout,
        cache: false,
        ...(options?.variables ? { variables: options.variables } : {}),
      });
      if (!result.data.success) throw new Error("STAGEHAND_V4_ACT_FAILED");
    },
    async actInstruction({ instruction, variables }) {
      const result = await input.stagehand.act(instruction, {
        page: input.page,
        timeout,
        cache: false,
        ...(variables ? { variables } : {}),
      });
      if (!result.data.success) throw new Error("STAGEHAND_V4_ACT_FAILED");
    },
    async clickSelector({ selector }) {
      await input.page.locator(selector).click();
    },
    async fillSelector({ selector, value }) {
      await input.page.locator(selector).fill(value);
    },
    async extract<Schema extends ZodType>({ instruction, schema }: {
      instruction: string;
      schema: Schema;
    }): Promise<z.output<Schema>> {
      const result = await input.stagehand.extract(instruction, schema, {
        page: input.page,
        timeout,
        cache: false,
      });
      return result.data;
    },
    async readEvidence({ kind }: { kind: PortalDomEvidence["kind"] }) {
      const currentUrl = await input.page.url();
      return await readPortalDomEvidenceFromPage({
        evaluate: async <Result>(expression: string) =>
          await input.page.evaluate<Result>(expression),
        url: () => currentUrl,
      }, kind);
    },
    async inspectForm(formInput) {
      return await inspectPortalFormOnPage(input.page, formInput);
    },
    async wait(milliseconds) {
      await input.page.waitForTimeout(milliseconds);
    },
  };
}

function stagehandConfig(config: SharedSessionConfig, browser: StagehandBrowser) {
  return {
    browser,
    model: {
      modelName: required(config.modelName, "STAGEHAND_V4_MODEL_NAME_MISSING") as ModelName,
      apiKey: required(config.modelApiKey, "STAGEHAND_V4_MODEL_API_KEY_MISSING"),
    },
    cache: false as const,
    logging: { level: "off" as const },
  };
}

function validateSharedConfig(config: SharedSessionConfig): void {
  required(config.apiKey, "STAGEHAND_V4_API_KEY_MISSING");
  required(config.modelApiKey, "STAGEHAND_V4_MODEL_API_KEY_MISSING");
  required(config.modelName, "STAGEHAND_V4_MODEL_NAME_MISSING");
  operationTimeout(config.timeoutMs);
}

function sessionHandle(input: {
  browser: StagehandBrowser;
  stagehand: Stagehand;
  page: Page;
  timeoutMs?: number;
}): StagehandV4Session {
  const sessionId = input.browser.sessionId;
  if (!sessionId) throw new Error("STAGEHAND_V4_SESSION_ID_MISSING");
  let closePromise: Promise<void> | undefined;
  return {
    sessionId,
    browser: input.browser,
    stagehand: input.stagehand,
    page: input.page,
    primitives: createStagehandV4Primitives(input),
    close() {
      closePromise ??= (async () => {
        let failed = false;
        try {
          await input.stagehand.close();
        } catch {
          failed = true;
        }
        try {
          await input.browser.close();
        } catch {
          failed = true;
        }
        if (failed) throw new StagehandV4CleanupError();
      })();
      return closePromise;
    },
  };
}

async function cleanFailedInitialization(
  stagehand: Stagehand | undefined,
  browser: StagehandBrowser,
  releaseProviderSession: boolean,
  apiKey: string,
): Promise<void> {
  try {
    await stagehand?.close();
  } catch {
    // Initialization errors remain the useful failure; cleanup details may contain provider data.
  }
  try {
    await browser.close();
  } catch {
    // The application owns the separate provider-session release operation.
  }
  if (releaseProviderSession && browser.sessionId) {
    try {
      const client = new Browserbase({ apiKey });
      await client.sessions.update(browser.sessionId, { status: "REQUEST_RELEASE" });
    } catch {
      // Preserve the initialization failure and never surface provider response bodies.
    }
  }
}

async function creationPage(browser: StagehandBrowser): Promise<Page> {
  const pages = await browser.context.pages();
  if (pages.length === 0) return await browser.context.newPage();
  if (pages.length !== 1) throw new Error("STAGEHAND_V4_LIVE_PAGE_AMBIGUOUS");
  return pages[0]!;
}

async function connectedPage(browser: StagehandBrowser): Promise<Page> {
  const pages = await browser.context.pages();
  const withUrls = await Promise.all(pages.map(async (page) => ({
    page,
    url: await page.url(),
  })));
  const live = withUrls.filter(({ url }) => url !== "about:blank" && url.length > 0);
  if (live.length !== 1) throw new Error("STAGEHAND_V4_LIVE_PAGE_AMBIGUOUS");
  return live[0]!.page;
}

export async function createStagehandV4Session(
  config: CreateStagehandV4SessionConfig,
): Promise<StagehandV4Session> {
  validateSharedConfig(config);
  const apiKey = required(config.apiKey, "STAGEHAND_V4_API_KEY_MISSING");
  const timeoutMs = operationTimeout(config.timeoutMs);
  const url = reviewedPortalUrl(config.url, "STAGEHAND_V4_URL_NOT_ALLOWED");
  if (config.persistContext && !config.contextId) {
    throw new Error("STAGEHAND_V4_CONTEXT_ID_MISSING");
  }
  const browser = await browserbase.launch({
    apiKey,
    api_timeout: providerTimeoutSeconds(timeoutMs),
    keepAlive: true,
    region: "eu-central-1",
    proxies: false,
    browserSettings: {
      allowedDomains: ["roomscout.dev"],
      solveCaptchas: config.solveCaptchas,
      logSession: false,
      recordSession: false,
      ...(config.contextId
        ? { context: { id: config.contextId, persist: config.persistContext } }
        : {}),
    },
  });
  let stagehand: Stagehand | undefined;
  try {
    stagehand = await Stagehand.create(stagehandConfig(config, browser));
    const page = await creationPage(browser);
    await page.goto(url);
    const current = new URL(await page.url());
    if (current.origin !== REVIEWED_PORTAL_ORIGIN) {
      throw new Error("STAGEHAND_V4_NAVIGATION_ESCAPED");
    }
    return sessionHandle({ browser, stagehand, page, timeoutMs });
  } catch (error) {
    await cleanFailedInitialization(stagehand, browser, true, apiKey);
    throw error;
  }
}

export async function connectStagehandV4Session(
  config: ConnectStagehandV4SessionConfig,
): Promise<StagehandV4Session> {
  validateSharedConfig(config);
  const apiKey = required(config.apiKey, "STAGEHAND_V4_API_KEY_MISSING");
  const sessionId = required(config.sessionId, "STAGEHAND_V4_SESSION_ID_MISSING");
  const timeoutMs = operationTimeout(config.timeoutMs);
  const browser = await browserbase.connect({ apiKey, sessionId });
  let stagehand: Stagehand | undefined;
  try {
    stagehand = await Stagehand.create(stagehandConfig(config, browser));
    const page = await connectedPage(browser);
    const current = new URL(await page.url());
    if (current.origin !== REVIEWED_PORTAL_ORIGIN) {
      throw new Error("STAGEHAND_V4_NAVIGATION_ESCAPED");
    }
    return sessionHandle({ browser, stagehand, page, timeoutMs });
  } catch (error) {
    await cleanFailedInitialization(stagehand, browser, false, apiKey);
    throw error;
  }
}
