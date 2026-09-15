import { randomBytes } from "node:crypto";
import {
  CLERK_PRIMARY, ORIGIN, OTP_SELECTOR, agentmail, interactCode, log, program, requireEnv,
  scrapeExtras, scrapeWithProfile, stopInteraction, waitForVerificationCode,
} from "./firecrawl-local-lib.mjs";

// Standalone test: Firecrawl scrape + /interact registers a roomscout.dev
// account, the Clerk code arrives in an AgentMail inbox, and the persistent
// Firecrawl profile plays the role of a Browserbase Context. No Convex, no Scout.
requireEnv(["FIRECRAWL_API_KEY", "AGENTMAIL_API_KEY"]);
const startedAt = Date.now();
const profileName = process.env.TEST_FIRECRAWL_PROFILE ?? `roomscout-local-signup-${startedAt}`;
const password = `Rs!${randomBytes(24).toString("base64url")}9a`;
const redact = (text) => String(text).replaceAll(password, "[redacted]");
// TEST_HUMAN_CAPTCHA_WAIT_S=240 keeps the session open after "Continue" so a
// person can solve Clerk's Turnstile in the interactive live view.
const humanWaitSeconds = Number(process.env.TEST_HUMAN_CAPTCHA_WAIT_S ?? 0);

async function ensureInbox() {
  if (process.env.TEST_SIGNUP_EMAIL) return process.env.TEST_SIGNUP_EMAIL;
  const inbox = await agentmail("/inboxes", {
    method: "POST",
    body: {
      username: `roomscout-fc-${startedAt}`,
      domain: "agentmail.to",
      display_name: "RoomScout Firecrawl local signup",
      client_id: `roomscout-fc-local-signup-${startedAt}`,
    },
  });
  const email = inbox.inbox_id ?? inbox.email;
  if (!email) throw new Error("AgentMail inbox creation returned no address");
  return email;
}

let scrapeId;
let step = "create-inbox";
try {
  const email = await ensureInbox();
  log(step, { email, created: !process.env.TEST_SIGNUP_EMAIL });

  step = "scrape-signup";
  const scrape = await scrapeWithProfile(`${ORIGIN}/sign-up`, { name: profileName, saveChanges: true }, scrapeExtras());
  scrapeId = scrape.scrapeId;
  log(step, { scrapeId, statusCode: scrape.statusCode, profile: profileName, extras: scrapeExtras(), termsGateInMarkdown: /Demo terms/.test(scrape.markdown) });

  step = "open-signup-and-submit";
  const signup = await interactCode(scrapeId, step, program(`
    // Clerk's bot protection (Cloudflare Turnstile) never yields a token inside
    // Firecrawl's browser, so the sign-up hangs. A Clerk Testing Token (dev
    // instances only) is the documented E2E bypass: append it to every
    // Frontend API request, exactly like @clerk/testing does for Playwright.
    let tokenisedRequests = 0;
    if (testingToken) {
      // Register on the browser context (like @clerk/testing) and start from a
      // fresh Clerk client: FAPI marks captcha_bypass on the client it sees the
      // token with, and the scrape phase already created one without it.
      await page.context().route(/https:\\/\\/[^/]+\\.clerk\\.accounts\\.dev\\/v1\\//, async (route) => {
        const url = new URL(route.request().url());
        url.searchParams.set("__clerk_testing_token", testingToken);
        tokenisedRequests += 1;
        await route.continue({ url: url.toString() });
      });
      await page.context().clearCookies();
      out.clerkTestingTokenInjected = true;
    }
    if (!page.url().startsWith(ORIGIN + "/sign-up") || testingToken) {
      await page.goto(ORIGIN + "/sign-up", { waitUntil: "domcontentloaded", timeout: 30000 });
    }
    out.initialUrl = page.url();
    if (await page.locator('[data-roomscout-write="demo-terms"]').count()) {
      await page.locator('[data-roomscout-write="demo-terms"]').click();
      await page.locator('[data-roomscout-write="accept-demo-terms"]').click();
      out.termsAccepted = true;
    }
    await page.waitForSelector('input[name="emailAddress"]', { state: "visible", timeout: 45000 });
    out.tokenisedRequests = tokenisedRequests;
    out.clerk = await page.evaluate(() => ({
      captchaBypass: window.Clerk?.client?.captchaBypass ?? null,
      captchaPublicKey: Boolean(window.Clerk?.__unstable__environment?.displayConfig?.captchaPublicKey),
      frontendApi: window.Clerk?.frontendApi ?? null,
      instanceType: window.Clerk?.instanceType ?? null,
      captchaContainers: document.querySelectorAll('#clerk-captcha, [data-sitekey]').length,
      captchaFrames: document.querySelectorAll('iframe[src*="captcha" i], iframe[src*="turnstile" i]').length,
    }));
    await page.locator('input[name="emailAddress"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    const values = await page.evaluate(() => ({
      email: document.querySelector('input[name="emailAddress"]')?.value,
      password: document.querySelector('input[name="password"]')?.value,
    }));
    if (values.email !== email || values.password !== password) throw new Error("Form values did not match");
    out.exactValuesVerified = true;
    await page.locator(CLERK_PRIMARY).click();
    try {
      await page.waitForSelector(OTP_SELECTOR, { state: "visible", timeout: humanWaitSeconds > 0 ? 15000 : 45000 });
      out.otpFieldVisible = true;
    } catch (error) {
      if (humanWaitSeconds <= 0) throw error;
      out.otpFieldVisible = false;
    }
    out.url = page.url();
  `, { ORIGIN, CLERK_PRIMARY, OTP_SELECTOR, email, password, testingToken: process.env.TEST_CLERK_TESTING_TOKEN ?? "", humanWaitSeconds }), { timeout: 120 });

  if (!signup.otpFieldVisible && humanWaitSeconds > 0) {
    // Human-in-the-loop experiment: open the interactiveLiveViewUrl logged at
    // the first interact call, solve the CAPTCHA by hand, and this loop picks
    // up as soon as Clerk shows the verification-code step.
    step = "wait-for-human-captcha";
    log(step, { hint: "open interactiveLiveViewUrl from the live-view line and solve the challenge", seconds: humanWaitSeconds });
    const deadline = Date.now() + humanWaitSeconds * 1_000;
    while (Date.now() < deadline && !signup.otpFieldVisible) {
      const poll = await interactCode(scrapeId, "poll-captcha", program(`
        out.otpFieldVisible = (await page.locator(OTP_SELECTOR).count()) > 0;
        out.turnstileToken = await page.evaluate(() => (document.querySelector('input[name="cf-turnstile-response"]')?.value ?? "").length);
        out.iframes = await page.evaluate(() => document.querySelectorAll("iframe").length);
        out.url = page.url();
        if (!out.otpFieldVisible) await page.waitForTimeout(12000);
      `, { OTP_SELECTOR }), { timeout: 30, mutating: false });
      signup.otpFieldVisible = poll.otpFieldVisible;
    }
  }
  if (!signup.otpFieldVisible) throw new Error("Verification form not shown after signup");

  step = "wait-for-email-code";
  const verification = await waitForVerificationCode(email, startedAt);
  log(step, { subject: verification.subject, from: verification.from, waitedMs: verification.waitedMs });

  step = "submit-verification";
  const verified = await interactCode(scrapeId, step, program(`
    await page.locator(OTP_SELECTOR).fill(code);
    try { await page.locator(CLERK_PRIMARY).click({ timeout: 5000 }); out.clickedPrimary = true; } catch { out.clickedPrimary = false; }
    out.authenticated = false;
    for (let attempt = 0; attempt < 30 && !out.authenticated; attempt += 1) {
      out.authenticated = await page.evaluate(() => Boolean(window.Clerk?.user && window.Clerk?.session));
      if (!out.authenticated) await page.waitForTimeout(500);
    }
    out.urlAfterVerify = page.url();
    if (!out.authenticated) {
      await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: 30000 });
      for (let attempt = 0; attempt < 20 && !out.authenticated; attempt += 1) {
        out.authenticated = await page.evaluate(() => Boolean(window.Clerk?.user && window.Clerk?.session));
        if (!out.authenticated) await page.waitForTimeout(500);
      }
    }
    out.clerkUserId = await page.evaluate(() => window.Clerk?.user?.id ?? null);
    out.url = page.url();
  `, { ORIGIN, CLERK_PRIMARY, OTP_SELECTOR, code: verification.code }), { timeout: 120 });
  if (!verified.authenticated) throw new Error("Authenticated session not reached");

  step = "stop-session";
  await stopInteraction(scrapeId);
  scrapeId = undefined;
  log("SUCCESS", { authenticated: true, profile: profileName, email });
} catch (error) {
  log("FAILED", { at: step, error: redact(error.message).slice(0, 600) });
  process.exitCode = 1;
} finally {
  if (scrapeId) await stopInteraction(scrapeId).catch(() => undefined);
}
