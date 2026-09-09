"use node";

import { Browserbase } from "@browserbasehq/sdk";
import { browserbase, type StagehandBrowser } from "@browserbasehq/stagehand";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { detectRegistrationHumanBlocker, initializePortalBrowser, registrationSessionOptions } from "./browserbasePortal";

function safeReason(error: unknown, apiKey: string): string {
  return (error instanceof Error ? error.message : "UNKNOWN_SESSION_FAILURE")
    .replaceAll(apiKey, "[credential]")
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[inbox]")
    .replace(/\b[a-f0-9]{8}-[a-f0-9-]{27,}\b/gi, "[id]").slice(0, 500);
}

/** Diagnoses session parameters without Stagehand swallowing the provider error.
 * No extension, navigation, credentials, page interaction or registration. */
export const diagnose = internalAction({
  args: { confirmation: v.literal("RUN_CONTROLLED_PERSONAL_INBOX_PROOF_DEVELOPMENT") },
  returns: v.object({ ready: v.boolean(), status: v.optional(v.number()), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.controlledPersonalInboxProof.resolveActors, args);
    const apiKey = process.env.BROWSERBASE_API_KEY;
    if (!apiKey) throw new Error("BROWSERBASE_API_KEY_MISSING");
    const client = new Browserbase({ apiKey });
    let contextId: string | undefined;
    let sessionId: string | undefined;
    try {
      const context = await client.contexts.create({ name: "roomscout-session-parameter-health" });
      contextId = context.id;
      const session = await client.sessions.create(registrationSessionOptions({ allowedDomains: ["roomscout.dev"], providerContextId: context.id }));
      sessionId = session.id;
      return { ready: true };
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : undefined;
      // Only a bounded, redacted provider diagnostic reaches trusted CLI tooling.
      // Never return the SDK error object (it includes request headers).
      const reason = safeReason(error, apiKey);
      return { ready: false, status, reason };
    } finally {
      if (sessionId) await client.sessions.update(sessionId, { status: "REQUEST_RELEASE" }).catch(() => undefined);
      if (contextId) await client.contexts.delete(contextId).catch(() => undefined);
    }
  },
});

/** Fixed-origin read-only probe. Never fills fields or submits the signup form. */
export const inspectSignup = internalAction({
  args: { confirmation: v.literal("RUN_CONTROLLED_PERSONAL_INBOX_PROOF_DEVELOPMENT") },
  returns: v.object({ ready: v.boolean(), stage: v.string(), emailFields: v.optional(v.number()), reason: v.optional(v.string()), scriptHosts: v.optional(v.array(v.string())), publicPageState: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.controlledPersonalInboxProof.resolveActors, args);
    const apiKey = process.env.BROWSERBASE_API_KEY;
    if (!apiKey) throw new Error("BROWSERBASE_API_KEY_MISSING");
    const client = new Browserbase({ apiKey });
    let contextId: string | undefined;
    let browser: StagehandBrowser | undefined;
    let stage = "context";
    try {
      contextId = (await client.contexts.create({ name: "roomscout-signup-read-only-health" })).id;
      stage = "launch";
      browser = await initializePortalBrowser(await browserbase.launch({ apiKey, ...registrationSessionOptions({ allowedDomains: ["roomscout.dev"], providerContextId: contextId }) }), apiKey);
      stage = "pages";
      const page = (await browser.context.pages())[0] ?? await browser.context.newPage();
      stage = "navigation";
      await page.goto("https://roomscout.dev/sign-up");
      stage = "load";
      await page.waitForLoadState("domcontentloaded", 20_000);
      await page.waitForTimeout(2_000);
      if (new URL(await page.url()).origin !== "https://roomscout.dev") throw new Error("UNEXPECTED_ORIGIN");
      stage = "human_check";
      const blocker = await detectRegistrationHumanBlocker(page);
      stage = blocker ? `human_${blocker}` : "fields";
      const emailFields = await page.locator('input[type="email"],input[name="emailAddress"],input[autocomplete="email"]').count();
      const scriptHosts = await page.evaluate(() => [...new Set([...document.scripts].map(s => s.src).filter(Boolean).map(src => new URL(src).hostname))].slice(0, 12));
      const publicPageState = await page.evaluate(() => document.body.innerText.slice(0, 1_000));
      return { ready: emailFields > 0, stage, emailFields, scriptHosts, publicPageState: safeReason(new Error(publicPageState), apiKey) };
    } catch (error) {
      return { ready: false, stage, reason: safeReason(error, apiKey) };
    } finally {
      if (browser) {
        await browser.close().catch(() => undefined);
        if (browser.sessionId) await client.sessions.update(browser.sessionId, { status: "REQUEST_RELEASE" }).catch(() => undefined);
      }
      if (contextId) await client.contexts.delete(contextId).catch(() => undefined);
    }
  },
});
