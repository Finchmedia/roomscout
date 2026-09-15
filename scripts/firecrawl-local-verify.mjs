import { ORIGIN, interactCode, log, program, requireEnv, scrapeExtras, scrapeWithProfile, stopInteraction } from "./firecrawl-local-lib.mjs";

// Read-only check that a Firecrawl profile still carries an authenticated
// roomscout.dev session (Browserbase Context equivalent). saveChanges:false
// never writes back to the profile.
requireEnv(["FIRECRAWL_API_KEY", "TEST_FIRECRAWL_PROFILE"]);
let scrapeId;
try {
  const scrape = await scrapeWithProfile(`${ORIGIN}/`, { name: process.env.TEST_FIRECRAWL_PROFILE, saveChanges: false }, scrapeExtras());
  scrapeId = scrape.scrapeId;
  log("scrape-home", { scrapeId, statusCode: scrape.statusCode });
  for (const path of ["/", "/inbox"]) {
    await interactCode(scrapeId, `verify:${path}`, program(`
      const response = await page.goto(ORIGIN + path, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => window.Clerk?.loaded === true, undefined, { timeout: 10000 }).catch(() => undefined);
      out.http = response?.status() ?? null;
      Object.assign(out, await page.evaluate(() => ({
        path: location.pathname,
        authenticated: Boolean(window.Clerk?.user && window.Clerk?.session),
        inboxState: document.querySelector("[data-roomscout-inbox-state]")?.getAttribute("data-roomscout-inbox-state") ?? null,
        threadLinks: document.querySelectorAll("a[data-roomscout-thread-id]").length,
        heading: document.querySelector("h1")?.textContent ?? null,
        applicationError: (document.body.textContent ?? "").includes("Application error"),
        userButtonTriggers: document.querySelectorAll(".cl-userButtonTrigger").length,
        localStorageKeys: Object.keys(localStorage).slice(0, 12),
      })));
      // Names and domains only: shows what the profile restored without exposing values.
      out.cookies = (await page.context().cookies()).map((c) => c.domain + ":" + c.name).slice(0, 20);
    `, { ORIGIN, path }), { timeout: 60, mutating: false });
  }
} finally {
  if (scrapeId) await stopInteraction(scrapeId).catch(() => undefined);
}
