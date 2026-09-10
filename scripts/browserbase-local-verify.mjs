import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

if (!process.env.BROWSERBASE_API_KEY || !process.env.TEST_BROWSER_CONTEXT_ID) {
  throw new Error("Set BROWSERBASE_API_KEY and TEST_BROWSER_CONTEXT_ID");
}
const provider = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY, maxRetries: 0 });
const session = await provider.sessions.create({
  api_timeout: 120, region: "eu-central-1", proxies: false, keepAlive: false,
  browserSettings: { context: { id: process.env.TEST_BROWSER_CONTEXT_ID, persist: false },
    recordSession: false, logSession: false,
    ...(process.env.TEST_ALLOWED_DOMAINS === "1" ? { allowedDomains: ["roomscout.dev"] } : {}) },
});
let browser;
try {
  browser = await chromium.connectOverCDP(session.connectUrl);
  const page = browser.contexts()[0].pages()[0] ?? await browser.contexts()[0].newPage();
  for (const path of ["/", "/inbox"]) {
    const response = await page.goto(`https://roomscout.dev${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => window.Clerk?.loaded === true, undefined, { timeout: 10_000 }).catch(() => undefined);
    const state = await page.evaluate(() => ({
      authenticated: Boolean(window.Clerk?.user && window.Clerk?.session),
      inboxState: document.querySelector("[data-roomscout-inbox-state]")?.getAttribute("data-roomscout-inbox-state") ?? null,
      heading: document.querySelector("h1")?.textContent ?? null,
      applicationError: (document.body.textContent ?? "").includes("Application error"),
      signedInDom: {
        postListingLinks: document.querySelectorAll('a[href="/listings/new"]').length,
        inboxLinks: document.querySelectorAll('a[href="/inbox"]').length,
        userButtonTriggers: document.querySelectorAll('.cl-userButtonTrigger').length,
        clerkUserButtons: document.querySelectorAll('[class*="userButton"]').length,
      },
    }));
    console.log(JSON.stringify({ path: new URL(page.url()).pathname, http: response?.status(), ...state }));
  }
} finally {
  await browser?.close();
  await provider.sessions.update(session.id, { status: "REQUEST_RELEASE" });
}
