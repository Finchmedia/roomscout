import {
  ORIGIN, interactCode, interactPrompt, log, program, requireEnv, scrapeExtras, scrapeWithProfile, stopInteraction,
} from "./firecrawl-local-lib.mjs";

// One local, explicitly requested UI message through Firecrawl /interact,
// reusing the persistent profile written by firecrawl-local-signup.mjs.
// TEST_FILL_MODE=prompt lets Firecrawl's own browser agent fill the form
// (the Stagehand act() equivalent); default "code" uses direct Playwright fills.
requireEnv(["FIRECRAWL_API_KEY", "TEST_FIRECRAWL_PROFILE", "TEST_LISTING_URL", "TEST_SENDER_LABEL", "TEST_MESSAGE"]);
const url = new URL(process.env.TEST_LISTING_URL);
if (url.origin !== ORIGIN || !url.pathname.startsWith("/listings/")) {
  throw new Error("Expected a roomscout.dev test listing");
}
const sender = process.env.TEST_SENDER_LABEL;
const message = process.env.TEST_MESSAGE;
const fillMode = process.env.TEST_FILL_MODE === "prompt" ? "prompt" : "code";

let scrapeId;
let step = "scrape-listing";
try {
  const scrape = await scrapeWithProfile(url.href, { name: process.env.TEST_FIRECRAWL_PROFILE, saveChanges: true }, scrapeExtras());
  scrapeId = scrape.scrapeId;
  log(step, { scrapeId, statusCode: scrape.statusCode, composerInMarkdown: /Message the listing owner/.test(scrape.markdown) });

  step = "open-listing";
  const opened = await interactCode(scrapeId, step, program(`
    if (page.url() !== url) await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // The composer is server-rendered from the session cookie, so it can appear
    // before clerk-js has hydrated; wait for Clerk before reading the client state.
    await page.waitForSelector('[data-roomscout-compose="new-message"]', { state: "visible", timeout: 30000 });
    await page.waitForFunction(() => window.Clerk?.loaded === true, undefined, { timeout: 15000 }).catch(() => undefined);
    out.title = await page.evaluate(() => document.querySelector("h1")?.textContent ?? null);
    out.authenticated = await page.evaluate(() => Boolean(window.Clerk?.user && window.Clerk?.session));
  `, { url: url.href }), { timeout: 90, mutating: false });
  if (!opened.authenticated) throw new Error("Profile did not restore an authenticated Clerk session");

  step = `fill-message-${fillMode}`;
  if (fillMode === "prompt") {
    await interactPrompt(scrapeId, step,
      `In the "Message the listing owner" form, fill the "Your public name" input with exactly: ${sender}\nThen fill the "Message" textarea with exactly: ${message}\nDo not click Send and do not submit anything.`,
      { timeout: 150 });
  } else {
    await interactCode(scrapeId, step, program(`
      await page.locator('[data-roomscout-write="sender-label"]').fill(sender);
      await page.locator('[data-roomscout-write="body"]').fill(message);
      out.filled = true;
    `, { sender, message }), { timeout: 60 });
  }

  step = "verify-exact-content";
  const values = await interactCode(scrapeId, step, program(`
    Object.assign(out, await page.evaluate(() => ({
      sender: document.querySelector('[data-roomscout-write="sender-label"]')?.value,
      body: document.querySelector('[data-roomscout-write="body"]')?.value,
    })));
  `), { timeout: 30, mutating: false });
  if (values.sender !== sender || values.body !== message) {
    throw new Error("Message fields do not match the requested content");
  }

  step = "send-once";
  const receipt = await interactCode(scrapeId, step, program(`
    await page.locator('[data-roomscout-write="send"]').click();
    await page.waitForSelector('[data-roomscout-write-result]', { state: "visible", timeout: 30000 });
    Object.assign(out, await page.evaluate(() => {
      const el = document.querySelector('[data-roomscout-write-result]');
      return {
        status: el?.getAttribute('data-roomscout-write-result'),
        code: el?.getAttribute('data-roomscout-error-code'),
        messageId: el?.getAttribute('data-roomscout-provider-message-id'),
        threadId: el?.getAttribute('data-roomscout-provider-thread-id'),
        text: (el?.textContent ?? '').trim(),
      };
    }));
  `), { timeout: 90 });
  if (receipt.status !== "sent" || !receipt.messageId) {
    throw new Error("Portal did not confirm storage; no automatic retry");
  }

  step = "read-back-thread";
  const thread = await interactCode(scrapeId, step, program(`
    await page.goto(ORIGIN + "/inbox/" + threadId, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('[data-roomscout-thread-state="ready"]', { state: "visible", timeout: 30000 });
    Object.assign(out, await page.evaluate(() => {
      const row = document.querySelector('[data-roomscout-thread-state="ready"]');
      return {
        providerThreadId: row?.dataset.roomscoutThreadId ?? null,
        messages: Array.from(row?.querySelectorAll('[data-roomscout-message-id]') ?? []).map((m) => ({
          id: m.dataset.roomscoutMessageId, direction: m.dataset.roomscoutDirection,
          body: (m.querySelector('[data-roomscout-body]')?.textContent ?? '').trim().slice(0, 120),
        })),
      };
    }));
  `, { ORIGIN, threadId: receipt.threadId }), { timeout: 60, mutating: false });
  const stored = thread.messages?.some((m) => m.id === receipt.messageId && m.direction === "outbound" && m.body === message.slice(0, 120));
  if (!stored) throw new Error("Sent message not found in the portal thread read-back");

  step = "stop-session";
  await stopInteraction(scrapeId);
  scrapeId = undefined;
  log("SUCCESS", { fillMode, threadUrl: `${ORIGIN}/inbox/${receipt.threadId}`, messageId: receipt.messageId });
} catch (error) {
  log("FAILED", { at: step, error: String(error.message).slice(0, 600) });
  process.exitCode = 1;
} finally {
  if (scrapeId) await stopInteraction(scrapeId).catch(() => undefined);
}
