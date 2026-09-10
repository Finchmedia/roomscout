import { randomBytes } from "node:crypto";
import { Browserbase } from "@browserbasehq/sdk";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";

// Standalone test: no Convex imports, Scout, database or application rate limits.
const email = process.env.TEST_SIGNUP_EMAIL;
for (const key of ["BROWSERBASE_API_KEY", "OPENAI_API_KEY", "AGENTMAIL_API_KEY", "TEST_SIGNUP_EMAIL"]) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
const password = `Rs!${randomBytes(24).toString("base64url")}9a`;
const provider = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY, maxRetries: 0 });
const startedAt = Date.now();
const origin = "https://roomscout.dev";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (step, data = {}) => console.log(JSON.stringify({ step, ...data }));

async function mail(path) {
  const response = await fetch(`https://api.agentmail.to/v0${path}`, {
    headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`AgentMail HTTP ${response.status}`);
  return response.json();
}

async function verificationCode() {
  const path = `/inboxes/${encodeURIComponent(email)}/messages`;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const inbox = await mail(`${path}?limit=10`);
    for (const message of inbox.messages ?? []) {
      const received = Date.parse(message.created_at ?? message.timestamp ?? "");
      if (!Number.isFinite(received) || received < startedAt - 5_000) continue;
      const full = await mail(`${path}/${encodeURIComponent(message.message_id)}`);
      const subject = full.subject ?? "";
      if (!/verif|code|bestätig/i.test(subject)) continue;
      const content = [subject, full.extracted_text ?? full.text ?? ""].join("\n");
      const codes = [...new Set(content.match(/\b\d{6}\b/g) ?? [])];
      if (codes.length === 1) return codes[0];
    }
    await sleep(5_000);
  }
  throw new Error("No fresh unambiguous verification code received");
}

let browser;
let stagehand;
let step = "create-context";
try {
  const context = await provider.contexts.create({ name: `roomscout-local-signup-${startedAt}` });
  log(step, { contextId: context.id });
  step = "launch-browser";
  browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY, region: "eu-central-1", proxies: false,
    api_timeout: 600, keepAlive: false,
    browserSettings: { solveCaptchas: true, logSession: false, recordSession: false,
      context: { id: context.id, persist: true } },
  });
  log(step, { sessionId: browser.sessionId });
  stagehand = await Stagehand.create({ browser,
    model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
    cache: false, logging: { level: "off" },
  });
  const page = await browser.context.activePage() ?? await browser.context.newPage();
  const act = async (instruction, variables) => {
    const result = await stagehand.act(instruction, { page, timeout: 45_000, cache: false, variables });
    if (!result.data.success) throw new Error(`Action failed at ${step}`);
  };
  step = "open-signup";
  await page.goto(`${origin}/sign-up`);
  log(step);
  if (await page.evaluate('Boolean(document.querySelector("[data-roomscout-write=demo-terms]"))')) {
    step = "accept-demo-terms";
    await page.locator('[data-roomscout-write="demo-terms"]').click();
    await page.locator('[data-roomscout-write="accept-demo-terms"]').click();
    log(step);
  }
  await page.waitForSelector('input[name="emailAddress"]', { state: "visible", timeout: 30_000 });
  step = "fill-email";
  await act("Fill the email address input with %email%. Do not submit.", { email });
  log(step);
  step = "fill-password";
  await act("Fill the password input with %password%. Do not submit.", { password });
  log(step);
  const values = await page.evaluate('({email:document.querySelector("input[name=emailAddress]")?.value,password:document.querySelector("input[name=password]")?.value})');
  if (values.email !== email || values.password !== password) throw new Error("Form values did not match");
  step = "submit-signup";
  await page.locator('button[data-localization-key="formButtonPrimary"]').click();
  log(step);
  const otpSelector = 'input[autocomplete="one-time-code"],input[name="code"]';
  if (!(await page.waitForSelector(otpSelector, { state: "visible", timeout: 45_000 }))) {
    throw new Error("Verification form not shown after signup");
  }
  step = "wait-for-email-code";
  log(step);
  const code = await verificationCode();
  step = "submit-verification";
  await page.locator(otpSelector).fill(code);
  await page.locator('button[data-localization-key="formButtonPrimary"]').click();
  log(step);
  await sleep(2_000);
  // Verify account creation independently from the portal's inbox backend.
  step = "verify-authenticated-session";
  await page.goto(origin);
  let authenticated = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    authenticated = await page.evaluate("Boolean(window.Clerk?.user && window.Clerk?.session)");
    if (authenticated) break;
    await sleep(500);
  }
  if (!authenticated) throw new Error("Authenticated session not reached");
  log("SUCCESS", { authenticated: true, contextId: context.id });
} catch (error) {
  log("FAILED", { at: step, error: String(error.message).replaceAll(password, "[redacted]").replaceAll(email, "[test-inbox]").slice(0, 500) });
  process.exitCode = 1;
} finally {
  await stagehand?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
