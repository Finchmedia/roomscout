// Shared helpers for the standalone Firecrawl Interact tests. No Convex imports,
// no Scout orchestration: plain REST calls against api.firecrawl.dev and
// api.agentmail.to using keys from the environment.

export const ORIGIN = "https://roomscout.dev";
export const OTP_SELECTOR = 'input[autocomplete="one-time-code"],input[name="code"]';
export const CLERK_PRIMARY = 'button[data-localization-key="formButtonPrimary"]';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const log = (step, data = {}) => console.log(JSON.stringify({ step, ...data }));

export function requireEnv(keys) {
  for (const key of keys) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
}

async function firecrawlRequest(path, { method = "POST", body, timeoutMs = 120_000 } = {}) {
  const response = await fetch(`https://api.firecrawl.dev/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  if (!response.ok) {
    throw new Error(`Firecrawl ${method} ${path} HTTP ${response.status}: ${(json.error ?? json.raw ?? "").toString().slice(0, 300)}`);
  }
  return json;
}

/** POST /v2/scrape with a persistent profile. Returns the scrapeId that owns the browser session. */
export async function scrapeWithProfile(url, profile, extra = {}) {
  const result = await firecrawlRequest("/scrape", {
    body: { url, formats: ["markdown"], maxAge: 0, storeInCache: false, profile, ...extra },
    timeoutMs: 120_000,
  });
  const document = result.data ?? result;
  const scrapeId = document.metadata?.scrapeId;
  if (!scrapeId) throw new Error("Scrape returned no scrapeId (no interactive session)");
  return { scrapeId, statusCode: document.metadata?.statusCode, markdown: document.markdown ?? "" };
}

let liveViewLogged = false;

/**
 * POST /v2/scrape/{id}/interact in code mode. The program runs inside Firecrawl's
 * sandbox with a Playwright `page`; it must print exactly one JSON line as its
 * last stdout line. Variables are injected as JSON literals.
 */
export async function interactCode(scrapeId, label, program, { timeout = 120, mutating = true } = {}) {
  const started = Date.now();
  const result = await firecrawlRequest(`/scrape/${encodeURIComponent(scrapeId)}/interact`, {
    body: { code: program, language: "node", timeout, origin: "roomscout-local-test" },
    timeoutMs: (timeout + 30) * 1_000,
  });
  if (!liveViewLogged && (result.liveViewUrl || result.interactiveLiveViewUrl)) {
    liveViewLogged = true;
    log("live-view", { liveViewUrl: result.liveViewUrl, interactiveLiveViewUrl: result.interactiveLiveViewUrl });
  }
  // Node code mode returns the program's last expression in `result`
  // (a JSON string when the program ends with JSON.stringify). stdout is the
  // fallback for runtimes that capture console output instead.
  const stdout = String(result.stdout ?? result.output ?? "");
  let parsed = null;
  const candidates = [result.result, ...stdout.split(/\r?\n/).map((line) => line.trim()).reverse()];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    if (typeof candidate === "object") { parsed = candidate; break; }
    try { parsed = JSON.parse(candidate); break; } catch { /* diagnostic line */ }
  }
  const meta = { ms: Date.now() - started, exitCode: result.exitCode, killed: result.killed === true };
  if (!result.success || (result.exitCode ?? 0) !== 0 || result.killed) {
    const stderr = String(result.stderr ?? result.error ?? "").slice(0, 600);
    log(label, { ...meta, ok: false, stderr, stdoutTail: stdout.slice(-400) });
    throw new Error(`Interact step "${label}" failed (exit ${result.exitCode}${result.killed ? ", killed" : ""}): ${stderr || stdout.slice(-200)}`);
  }
  if (parsed === null) {
    log(label, { ...meta, ok: false, stdoutTail: stdout.slice(-400) });
    throw new Error(`Interact step "${label}" printed no JSON result`);
  }
  if (parsed.error) {
    log(label, { ...meta, ok: false, ...parsed });
    throw new Error(`Interact step "${label}": ${parsed.error}`);
  }
  log(label, { ...meta, ok: true, ...parsed, mutating });
  return parsed;
}

/** POST /v2/scrape/{id}/interact in prompt mode (Firecrawl's own browser agent). */
export async function interactPrompt(scrapeId, label, prompt, { timeout = 120 } = {}) {
  const started = Date.now();
  const result = await firecrawlRequest(`/scrape/${encodeURIComponent(scrapeId)}/interact`, {
    body: { prompt, timeout, origin: "roomscout-local-test" },
    timeoutMs: (timeout + 30) * 1_000,
  });
  const meta = { ms: Date.now() - started, exitCode: result.exitCode, killed: result.killed === true };
  if (!result.success) {
    log(label, { ...meta, ok: false, error: String(result.error ?? "").slice(0, 400) });
    throw new Error(`Prompt step "${label}" failed: ${result.error ?? "unknown"}`);
  }
  log(label, { ...meta, ok: true, output: String(result.output ?? "").slice(0, 600) });
  return result;
}

/** DELETE /v2/scrape/{id}/interact: closes the session and persists profile changes. */
export async function stopInteraction(scrapeId) {
  const result = await firecrawlRequest(`/scrape/${encodeURIComponent(scrapeId)}/interact`, { method: "DELETE", timeoutMs: 60_000 });
  log("stop-session", { sessionDurationMs: result.sessionDurationMs, creditsBilled: result.creditsBilled });
  return result;
}

/**
 * Wraps a sandbox program so that any thrown error becomes a JSON result with
 * page diagnostics instead of a bare exit code.
 *
 * The Node runtime is a persistent REPL per session: top-level `const`
 * declarations would collide on the next call and `return` is a syntax error,
 * so everything lives inside one async IIFE whose awaited value (a JSON string)
 * is the last expression and therefore comes back in `result`.
 */
export function program(body, vars = {}) {
  const injected = Object.entries(vars)
    .map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`)
    .join("\n");
  return `await (async () => {
${injected}
const __diag = async () => {
  try {
    return await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      clerkLoaded: window.Clerk?.loaded === true,
      authenticated: Boolean(window.Clerk?.user && window.Clerk?.session),
      captchaFrames: document.querySelectorAll('iframe[src*="captcha" i], iframe[src*="turnstile" i], iframe[src*="hcaptcha" i]').length,
      captchaContainers: Array.from(document.querySelectorAll('#clerk-captcha, [data-sitekey], [class*="captcha" i], [id*="captcha" i]')).map((el) => ({ id: el.id, children: el.childElementCount, visible: el.getClientRects().length > 0 })),
      formErrors: Array.from(document.querySelectorAll('[class*="formFieldErrorText"], [class*="alertText"], [role="alert"]')).map((el) => (el.textContent ?? '').trim()).filter(Boolean).slice(0, 5),
      textSnippet: (document.body?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 400),
    }));
  } catch (error) { return { diagError: String(error?.message ?? error).slice(0, 200) }; }
};
const out = {};
try {
${body}
  return JSON.stringify(out);
} catch (error) {
  return JSON.stringify({ error: String(error?.message ?? error).slice(0, 400), partial: out, diag: await __diag() });
}
})()`;
}

export async function agentmail(path, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.agentmail.to/v0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`AgentMail ${method} ${path} HTTP ${response.status}`);
  return response.json();
}

/** Same rule as the Browserbase script: one fresh, unambiguous 6-digit code from a verification mail. */
export async function waitForVerificationCode(email, startedAt, { attempts = 36, intervalMs = 5_000 } = {}) {
  const path = `/inboxes/${encodeURIComponent(email)}/messages`;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const inbox = await agentmail(`${path}?limit=10`);
    for (const message of inbox.messages ?? []) {
      const received = Date.parse(message.created_at ?? message.timestamp ?? "");
      if (!Number.isFinite(received) || received < startedAt - 5_000) continue;
      const full = await agentmail(`${path}/${encodeURIComponent(message.message_id)}`);
      const subject = full.subject ?? "";
      if (!/verif|code|bestätig/i.test(subject)) continue;
      const content = [subject, full.extracted_text ?? full.text ?? ""].join("\n");
      const codes = [...new Set(content.match(/\b\d{6}\b/g) ?? [])];
      if (codes.length === 1) return { code: codes[0], subject, from: full.from ?? null, waitedMs: attempt * intervalMs };
    }
    await sleep(intervalMs);
  }
  throw new Error("No fresh unambiguous verification code received");
}

/**
 * Optional scrape knobs for experiments. The interact session reuses the
 * scrape's browser, so proxy and ad-blocking choices apply to the whole flow.
 *   TEST_FIRECRAWL_PROXY=stealth|basic|enhanced|auto
 *   TEST_FIRECRAWL_BLOCK_ADS=0|1
 */
export function scrapeExtras() {
  const extras = {};
  if (process.env.TEST_FIRECRAWL_PROXY) extras.proxy = process.env.TEST_FIRECRAWL_PROXY;
  if (process.env.TEST_FIRECRAWL_BLOCK_ADS !== undefined) extras.blockAds = process.env.TEST_FIRECRAWL_BLOCK_ADS !== "0";
  // Firecrawl support's Turnstile recipe: give the challenge time to settle
  // before content is captured, and raise the request timeout to match.
  if (process.env.TEST_FIRECRAWL_WAIT_FOR) extras.waitFor = Number(process.env.TEST_FIRECRAWL_WAIT_FOR);
  if (process.env.TEST_FIRECRAWL_TIMEOUT) extras.timeout = Number(process.env.TEST_FIRECRAWL_TIMEOUT);
  return extras;
}
