import { browserbase, Stagehand } from "@browserbasehq/stagehand";

// One local, explicitly requested UI message. No Scout or Convex orchestration.
for (const key of ["BROWSERBASE_API_KEY", "OPENAI_API_KEY", "TEST_BROWSER_CONTEXT_ID", "TEST_LISTING_URL", "TEST_SENDER_LABEL", "TEST_MESSAGE"]) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
const url = new URL(process.env.TEST_LISTING_URL);
if (url.origin !== "https://roomscout.dev" || !url.pathname.startsWith("/listings/")) {
  throw new Error("Expected a roomscout.dev test listing");
}
const log = (step, data = {}) => console.log(JSON.stringify({ step, ...data }));
let browser;
let stagehand;
let step = "launch";
try {
  browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY, region: "eu-central-1", proxies: false,
    api_timeout: 240, keepAlive: false,
    browserSettings: { context: { id: process.env.TEST_BROWSER_CONTEXT_ID, persist: true },
      recordSession: false, logSession: false },
  });
  log(step, { sessionId: browser.sessionId });
  stagehand = await Stagehand.create({ browser,
    model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
    cache: false, logging: { level: "off" },
  });
  const page = await browser.context.activePage() ?? await browser.context.newPage();
  step = "open-listing";
  await page.goto(url.href);
  await page.waitForSelector('[data-roomscout-compose="new-message"]', { state: "visible", timeout: 30_000 });
  log(step, await page.evaluate('({title:document.querySelector("h1")?.textContent,authenticated:Boolean(window.Clerk?.user && window.Clerk?.session)})'));
  step = "fill-message";
  for (const [instruction, variables] of [
    ["Fill the public name field with %sender%.", { sender: process.env.TEST_SENDER_LABEL }],
    ["Fill the message textarea with %message%. Do not click Send.", { message: process.env.TEST_MESSAGE }],
  ]) {
    const result = await stagehand.act(instruction, { page, timeout: 45_000, cache: false, variables });
    if (!result.data.success) throw new Error("Fill action failed");
  }
  const values = await page.evaluate('({sender:document.querySelector("[data-roomscout-write=sender-label]")?.value,body:document.querySelector("[data-roomscout-write=body]")?.value})');
  if (values.sender !== process.env.TEST_SENDER_LABEL || values.body !== process.env.TEST_MESSAGE) {
    throw new Error("Message fields do not match the requested content");
  }
  log(step, { exactContentVerified: true });
  step = "send-once";
  await page.locator('[data-roomscout-write="send"]').click();
  log(step);
  step = "verify-receipt";
  await page.waitForSelector('[data-roomscout-write-result]', { state: "visible", timeout: 30_000 });
  const receipt = await page.evaluate('(() => { const el=document.querySelector("[data-roomscout-write-result]");return {status:el?.getAttribute("data-roomscout-write-result"),code:el?.getAttribute("data-roomscout-error-code"),messageId:el?.getAttribute("data-roomscout-provider-message-id"),threadId:el?.getAttribute("data-roomscout-provider-thread-id"),text:el?.textContent}; })()');
  log(step, receipt);
  if (receipt.status !== "sent" || !receipt.messageId) {
    const authCheck = await page.evaluate('async () => {try {const token=await window.Clerk?.session?.getToken({template:"convex"}); return {convexTokenAvailable:Boolean(token)};}catch(e){return {convexTokenAvailable:false,code:e.errors?.[0]?.code??null,message:e.errors?.[0]?.message??null};}}');
    log("portal-auth-diagnostic", authCheck);
    throw new Error("Portal did not confirm storage; no automatic retry");
  }
  log("SUCCESS", { threadUrl: `${url.origin}/inbox/${receipt.threadId}`, messageId: receipt.messageId });
} catch (error) {
  log("FAILED", { at: step, error: String(error.message).slice(0, 500) });
  process.exitCode = 1;
} finally {
  await stagehand?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
