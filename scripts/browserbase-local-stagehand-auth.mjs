import { browserbase, Stagehand } from "@browserbasehq/stagehand";

for (const key of ["BROWSERBASE_API_KEY", "OPENAI_API_KEY", "TEST_BROWSER_CONTEXT_ID"]) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

let browser;
let stagehand;
try {
  browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY,
    api_timeout: 120,
    keepAlive: false,
    region: "eu-central-1",
    proxies: false,
    browserSettings: {
      allowedDomains: ["roomscout.dev"],
      logSession: false,
      recordSession: false,
      context: { id: process.env.TEST_BROWSER_CONTEXT_ID, persist: false },
    },
  });
  stagehand = await Stagehand.create({
    browser,
    model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
    cache: false,
    logging: { level: "off" },
  });
  const page = await browser.context.activePage() ?? await browser.context.newPage();
  await page.goto("https://roomscout.dev/");
  const observations = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await page.evaluate(`({
      loaded: window.Clerk?.loaded === true,
      authenticated: Boolean(window.Clerk?.user && window.Clerk?.session),
      path: location.pathname
    })`);
    observations.push(state);
    if (state.authenticated) break;
    await page.waitForTimeout(500);
  }
  console.log(JSON.stringify({
    authenticated: observations.at(-1)?.authenticated === true,
    loaded: observations.at(-1)?.loaded === true,
    path: observations.at(-1)?.path ?? null,
    attempts: observations.length,
  }));
} finally {
  await stagehand?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
