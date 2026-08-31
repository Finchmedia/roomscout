"use node";

import { browserbase, type StagehandBrowser } from "@browserbasehq/stagehand";
import Firecrawl from "firecrawl";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { envValue } from "./integrations/env";
import {
  assertReviewedProbeUrl,
  normalizeProbeObservation,
  resolveReviewedProbeAdapter,
  type RawProbeObservation,
  type SourceProbeExecutor,
  type SourceProbeFlow,
} from "./integrations/sourceProbeAdapters";
import {
  isAllowedHostname,
  sanitizeProviderError,
} from "./integrations/portalSafety";

type ClaimedProbe = {
  runId: Id<"sourceFlowProbeRuns">;
  probeId: Id<"sourceFlowProbes">;
  platformId: Id<"sourcePlatforms">;
  bindingId: Id<"sourceAdapterBindings">;
  flow: SourceProbeFlow;
  safetyLevel: "read_only" | "prepare_only";
  executor: SourceProbeExecutor;
  config:
    | {
        kind: "firecrawl";
        extractionProfileKey: string;
        monitorDriven: boolean;
      }
    | {
        kind: "browserbase";
        workflowKey: string;
        contextRequired: boolean;
      }
    | { kind: "agentmail"; purpose: "outreach" | "reply" }
    | { kind: "direct_api"; integrationKey: string }
    | { kind: "manual"; instructionKey: string };
  adapterKey: string;
  adapterVersion: number;
  canonicalDomain: string;
  targetUrl: string;
  allowedDomains: string[];
  allowedPaths: string[];
  sourceId?: Id<"sources">;
  sourceTargetId?: Id<"sourceTargets">;
  geoAreaId?: Id<"geoAreas">;
  sourceSide?: "supply" | "demand" | "both";
  connectionId?: Id<"portalConnections">;
  browserContextId?: Id<"browserContexts">;
  providerContextId?: string;
  maxItems: number;
  timeoutMs: number;
};

function knownFailureCode(error: unknown): string {
  if (error instanceof Error) {
    const value = `${error.name} ${error.message}`.toUpperCase();
    for (const code of [
      "PROBE_ADAPTER_NOT_REVIEWED",
      "PROBE_TARGET_DOMAIN_NOT_ALLOWED",
      "DOMAIN_NOT_ALLOWED",
      "PATH_NOT_ALLOWED",
      "HTTPS_REQUIRED",
      "PROVIDER_TIMEOUT",
    ]) {
      if (value.includes(code)) return code;
    }
  }
  const sanitized = sanitizeProviderError(error);
  return sanitized === "PROVIDER_ERROR" ? "PROBE_PROVIDER_ERROR" : sanitized;
}

function assertFinalProbeUrl(claim: ClaimedProbe, value: string): string {
  return assertReviewedProbeUrl({
    targetUrl: value,
    canonicalDomain: claim.canonicalDomain,
    allowedDomains: claim.allowedDomains,
    allowedPaths: claim.allowedPaths,
  });
}

async function runFirecrawlProbe(
  claim: ClaimedProbe,
): Promise<RawProbeObservation> {
  if (claim.config.kind !== "firecrawl") {
    throw new Error("PROBE_ADAPTER_NOT_REVIEWED");
  }
  const adapter = resolveReviewedProbeAdapter({
    executor: "firecrawl",
    adapterKey: claim.adapterKey,
    configKey: claim.config.extractionProfileKey,
    flow: claim.flow,
  });
  if (adapter === null) throw new Error("PROBE_ADAPTER_NOT_REVIEWED");
  const apiKey = envValue("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_NOT_CONFIGURED");
  const targetUrl = assertFinalProbeUrl(claim, claim.targetUrl);
  const client = new Firecrawl({
    apiKey,
    timeoutMs: claim.timeoutMs,
    maxRetries: 1,
  });
  const document = await client.scrape(targetUrl, {
    formats: ["markdown", "links"],
    onlyMainContent: false,
    maxAge: 0,
    storeInCache: false,
  });
  const finalUrl = assertFinalProbeUrl(
    claim,
    document.metadata?.sourceURL ?? document.metadata?.url ?? targetUrl,
  );
  const links = (document.links ?? []).slice(0, 10_000);
  let sameDomainLinkCount = 0;
  for (const link of links) {
    try {
      const url = new URL(link, finalUrl);
      if (
        url.protocol === "https:" &&
        isAllowedHostname(url.hostname, claim.allowedDomains)
      ) {
        sameDomainLinkCount += 1;
      }
    } catch {
      // Untrusted malformed links never become probe observations.
    }
  }
  // Probe evidence is hashed and discarded; cap the transient material too so
  // an unexpectedly large page cannot exhaust the action runtime.
  const markdown = (document.markdown ?? "").slice(0, 2_000_000);
  const contactSurface =
    /kontaktformular|contact\s+form|deine\s+nachricht|your\s+message/i.test(
      markdown,
    );
  const submitSurface =
    /e-?mail\s+senden|nachricht\s+senden|send\s+(email|message)/i.test(
      markdown,
    );
  const captchaPresent = /re-?captcha|hcaptcha|kein\s+roboter|captcha/i.test(
    markdown,
  );
  const loginSurfacePresent =
    /passwort|password|anmelden|einloggen|log\s*in/i.test(markdown);
  return {
    finalUrl,
    linkCount: links.length,
    sameDomainLinkCount,
    formCount: contactSurface ? 1 : 0,
    passwordFieldCount: loginSurfacePresent ? 1 : 0,
    submitControlCount: submitSurface ? 1 : 0,
    captchaPresent,
    loginSurfacePresent,
    sourceMaterial: markdown,
  };
}

async function runBrowserbaseProbe(
  claim: ClaimedProbe,
): Promise<RawProbeObservation> {
  if (claim.config.kind !== "browserbase") {
    throw new Error("PROBE_ADAPTER_NOT_REVIEWED");
  }
  const adapter = resolveReviewedProbeAdapter({
    executor: "browserbase",
    adapterKey: claim.adapterKey,
    configKey: claim.config.workflowKey,
    flow: claim.flow,
  });
  if (adapter === null) throw new Error("PROBE_ADAPTER_NOT_REVIEWED");
  const apiKey = envValue("BROWSERBASE_API_KEY");
  if (!apiKey) throw new Error("BROWSERBASE_NOT_CONFIGURED");
  const targetUrl = assertFinalProbeUrl(claim, claim.targetUrl);
  let browser: StagehandBrowser | undefined;
  try {
    browser = await browserbase.launch({
      apiKey,
      api_timeout: Math.max(60, Math.ceil(claim.timeoutMs / 1_000)),
      keepAlive: false,
      region: "eu-central-1",
      proxies: [{ type: "none" }],
      browserSettings: {
        allowedDomains: claim.allowedDomains,
        solveCaptchas: false,
        recordSession: false,
        logSession: false,
        context: claim.providerContextId
          ? { id: claim.providerContextId, persist: false }
          : undefined,
      },
      userMetadata: {
        product: "roomscout",
        mode: "source_probe_read_only",
      },
    });
    const pages = await browser.context.pages();
    const page = pages[0] ?? (await browser.context.newPage());
    await page.goto(targetUrl);
    await page.waitForLoadState(
      "domcontentloaded",
      Math.min(30_000, claim.timeoutMs),
    );
    const finalUrl = assertFinalProbeUrl(claim, await page.url());
    const structural = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href]"),
      ).slice(0, 10_000);
      const forms = document.querySelectorAll("form").length;
      const passwords = document.querySelectorAll(
        'input[type="password"]',
      ).length;
      const submitControls = document.querySelectorAll(
        'button[type="submit"], input[type="submit"]',
      ).length;
      const captchaPresent = Boolean(
        document.querySelector(
          '[class*="captcha" i], [id*="captcha" i], iframe[src*="captcha" i], iframe[src*="recaptcha" i], iframe[src*="hcaptcha" i]',
        ),
      );
      const loginSurfacePresent =
        passwords > 0 ||
        Boolean(
          document.querySelector(
            'form[action*="login" i], form[action*="signin" i], form[action*="anmeld" i]',
          ),
        );
      return {
        links: links.map((link) => link.href),
        forms,
        passwords,
        submitControls,
        captchaPresent,
        loginSurfacePresent,
      };
    });
    let sameDomainLinkCount = 0;
    for (const link of structural.links) {
      try {
        const url = new URL(link, finalUrl);
        if (
          url.protocol === "https:" &&
          isAllowedHostname(url.hostname, claim.allowedDomains)
        ) {
          sameDomainLinkCount += 1;
        }
      } catch {
        // Ignore malformed links from the untrusted page.
      }
    }
    const evidenceShape = {
      finalUrl,
      linkCount: structural.links.length,
      sameDomainLinkCount,
      formCount: structural.forms,
      passwordFieldCount: structural.passwords,
      submitControlCount: structural.submitControls,
      captchaPresent: structural.captchaPresent,
      loginSurfacePresent: structural.loginSurfacePresent,
    };
    return {
      ...evidenceShape,
      sourceMaterial: JSON.stringify(evidenceShape),
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

export const run = internalAction({
  args: { runId: v.id("sourceFlowProbeRuns") },
  returns: v.object({
    claimed: v.boolean(),
    status: v.union(
      v.literal("skipped"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
  }),
  handler: async (ctx, args): Promise<{
    claimed: boolean;
    status: "skipped" | "succeeded" | "failed";
  }> => {
    const claim: ClaimedProbe | null = await ctx.runMutation(
      internal.sourceProbes.claimReadOnlyRun,
      { runId: args.runId },
    );
    if (claim === null) return { claimed: false, status: "skipped" };
    try {
      const observation =
        claim.executor === "firecrawl"
          ? await runFirecrawlProbe(claim)
          : await runBrowserbaseProbe(claim);
      const normalized = await normalizeProbeObservation({
        flow: claim.flow,
        maxItems: claim.maxItems,
        observation,
      });
      await ctx.runMutation(internal.sourceProbes.recordSucceededRun, {
        runId: claim.runId,
        summary: normalized.summary,
        evidenceHash: normalized.evidenceHash,
        resultCode: normalized.resultCode,
        itemsObserved: normalized.itemsObserved,
        facts: normalized.facts,
      });
      return { claimed: true, status: "succeeded" };
    } catch (error) {
      const resultCode = knownFailureCode(error);
      await ctx.runMutation(internal.sourceProbes.appendStep, {
        runId: claim.runId,
        ordinal: 1,
        kind: "assert",
        status:
          resultCode === "PROBE_ADAPTER_NOT_REVIEWED" ||
          resultCode === "PROBE_TARGET_DOMAIN_NOT_ALLOWED" ||
          resultCode === "DOMAIN_NOT_ALLOWED" ||
          resultCode === "PATH_NOT_ALLOWED"
            ? "blocked"
            : "failed",
        summary: `Probe stopped safely (${resultCode}); no write was attempted.`,
      });
      await ctx.runMutation(internal.sourceProbes.completeRun, {
        runId: claim.runId,
        status:
          resultCode === "PROBE_ADAPTER_NOT_REVIEWED" ||
          resultCode === "PROBE_TARGET_DOMAIN_NOT_ALLOWED" ||
          resultCode === "DOMAIN_NOT_ALLOWED" ||
          resultCode === "PATH_NOT_ALLOWED"
            ? "blocked"
            : "failed",
        resultCode,
        itemsObserved: 0,
        error: resultCode,
      });
      return { claimed: true, status: "failed" };
    }
  },
});
