import { describe, expect, it, vi } from "vitest";
import {
  readFirecrawlPortalInboxBatch,
  readFirecrawlPortalPageState,
  signUpOnFirecrawlPortal,
  submitFirecrawlPortalVerification,
  writeFirecrawlPortalMessage,
} from "./firecrawlPortalEngine";
import { buildFirecrawlProgram } from "./firecrawlProgram";
import {
  createFirecrawlPortalSession,
  FIRECRAWL_PORTAL_URL_PROGRAM,
  type FirecrawlPortalSession,
} from "./firecrawlPortalRuntime";

describe("firecrawlPortalEngine", () => {
  it("runs one bounded program and returns explicit partial state", async () => {
    const runProgram = vi.fn(async (...args: Parameters<FirecrawlPortalSession["runProgram"]>) => {
      void args;
      return ({
      threads: [{
        providerThreadId: "thread_1", subject: "Room", participants: ["Owner"],
        lastMessageAt: 42,
        messages: [{ providerMessageId: "message_1", direction: "inbound", bodyText: "Available", sentAt: 42 }],
      }],
      missingThreadIds: ["thread_2"], failedThreadIds: ["thread_3"],
      bodyTruncatedThreadIds: [],
      historyTruncatedThreadIds: [],
      discoveredThreadIds: ["thread_1", "thread_2", "thread_3"],
      truncated: true, timedOut: false, nextOffset: 0,
      });
    });
    const result = await readFirecrawlPortalInboxBatch({
      session: { runProgram } as unknown as FirecrawlPortalSession,
      requestedThreadIds: ["thread_3", "thread_3"], startOffset: 2,
      maxThreads: 3, navigationTimeoutMs: 5_000, overallTimeoutMs: 20_000,
    });
    expect(result).toMatchObject({ truncated: true, failedThreadIds: ["thread_3"] });
    expect(runProgram).toHaveBeenCalledOnce();
    const [body, vars, mutating, timeout] = runProgram.mock.calls[0]!;
    expect(body).toContain('timeout: vars.limits.navigationTimeoutMs');
    expect(body).toContain('new URL(await page.url()).origin');
    expect(vars.requestedThreadIds).toEqual(["thread_3"]);
    expect(mutating).toBe(false);
    expect(timeout).toBe(20_000);
  });

  it("reads the latest bounded message window and reports omitted history", async () => {
    const runProgram = vi.fn(async (...args: Parameters<FirecrawlPortalSession["runProgram"]>) => {
      void args;
      return ({
      threads: [], missingThreadIds: [], failedThreadIds: [], bodyTruncatedThreadIds: [],
      historyTruncatedThreadIds: ["thread_1"], discoveredThreadIds: ["thread_1"],
      truncated: true, timedOut: false, nextOffset: 0,
      });
    });
    const result = await readFirecrawlPortalInboxBatch({ session: { runProgram } as unknown as FirecrawlPortalSession });
    const [body] = runProgram.mock.calls[0]!;
    expect(body).toContain("allMessageRows.slice(-maxMessages)");
    expect(body).toContain("allMessageRows.length > maxMessages");
    expect(result).toMatchObject({ historyTruncatedThreadIds: ["thread_1"], truncated: true });
  });

  it("rejects malformed ids before browser execution", async () => {
    const runProgram = vi.fn();
    await expect(readFirecrawlPortalInboxBatch({
      session: { runProgram } as unknown as FirecrawlPortalSession,
      requestedThreadIds: ["../escape"],
    })).rejects.toThrow();
    expect(runProgram).not.toHaveBeenCalled();
  });

  it("maps malformed provider output to one safe error", async () => {
    const runProgram = vi.fn(async () => ({ threads: "secret provider body" }));
    await expect(readFirecrawlPortalInboxBatch({
      session: { runProgram } as unknown as FirecrawlPortalSession,
    })).rejects.toThrow("FIRECRAWL_PORTAL_READ_RESULT_INVALID");
  });
});

describe("writeFirecrawlPortalMessage", () => {
  const BODY = "Hallo, ist das Zimmer noch frei?";

  function prepared(overrides: Record<string, unknown> = {}) {
    return {
      url: "https://roomscout.dev/inbox/thread_1",
      authenticated: true,
      existingIds: ["message_old"],
      values: { body: BODY },
      send: { count: 1, visible: true, enabled: true },
      ...overrides,
    };
  }
  function sent(overrides: Record<string, unknown> = {}) {
    return {
      receipt: {
        status: "sent", errorCode: null,
        providerMessageId: "message_new", providerThreadId: "thread_1", text: "Gesendet",
      },
      thread: {
        providerThreadId: "thread_1",
        messages: [
          { id: "message_old", direction: "inbound", body120: "Frei ab Oktober" },
          { id: "message_new", direction: "outbound", body120: BODY.slice(0, 120) },
        ],
      },
      home: { authenticated: true },
      ...overrides,
    };
  }
  /** A transport that answers the two programs in order and counts the calls. */
  function transport(results: unknown[]) {
    const calls: Array<{ body: string; vars: Record<string, unknown>; mutating?: boolean; timeout?: number }> = [];
    const runProgram = vi.fn(async (
      body: string, vars: Record<string, unknown>, mutating?: boolean, timeout?: number,
    ) => {
      calls.push({ body, vars, mutating, timeout });
      const next = results[calls.length - 1];
      if (next instanceof Error) throw next;
      return next;
    });
    return { calls, session: { runProgram } as unknown as FirecrawlPortalSession, runProgram };
  }

  it("prepares in one read-only program that carries the origin guard and the reviewed selectors", async () => {
    const fake = transport([prepared(), sent()]);
    const beforeSubmit = vi.fn(async () => undefined);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit,
    })).resolves.toEqual({
      outcome: "succeeded", submitted: true,
      providerThreadId: "thread_1", providerMessageId: "message_new", profileAuthenticated: true,
    });
    const [prepare, send] = fake.calls;
    expect(prepare!.body).toContain("new URL(await page.url()).origin");
    expect(send!.body).toContain("new URL(await page.url()).origin");
    expect(prepare!.body).toContain("page.locator(vars.bodySelector).fill(vars.body)");
    expect(prepare!.body).toContain("page.locator(vars.senderSelector).fill(vars.senderLabel)");
    expect(prepare!.vars).toMatchObject({
      body: BODY, senderLabel: null, path: "/inbox/thread_1",
      readySelector: '[data-roomscout-thread-state="ready"]',
      bodySelector: '[data-roomscout-write="body"]',
    });
    // Exact values travel as JSON variables, never inside the program text.
    expect(prepare!.body).not.toContain(BODY);
    expect(prepare!.mutating).toBe(false);
    expect(prepare!.timeout).toBe(60_000);
    expect(send!.timeout).toBe(90_000);
  });

  it("sends exactly one mutating program, and only after the claim", async () => {
    const order: string[] = [];
    const fake = transport([prepared(), sent()]);
    fake.runProgram.mockImplementation(async (
      body: string, vars: Record<string, unknown>, mutating?: boolean, timeout?: number,
    ) => {
      order.push(mutating === true ? "mutating" : "read");
      fake.calls.push({ body, vars, mutating, timeout });
      return fake.calls.length === 1 ? prepared() : sent();
    });
    await writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1",
      beforeSubmit: async () => { order.push("claim"); },
    });
    expect(order).toEqual(["read", "claim", "mutating"]);
    expect(order.filter((step) => step === "mutating")).toHaveLength(1);
    // Scrape and stop are the session's own two calls: four round trips a message.
    expect(fake.runProgram).toHaveBeenCalledTimes(2);
  });

  it("fills the sender label only for a listing composer", async () => {
    const fake = transport([
      prepared({ url: "https://roomscout.dev/listings/listing_1", values: { senderLabel: "Dana", body: BODY } }),
      sent(),
    ]);
    await writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, targetPath: "/listings/listing_1",
      senderLabel: "Dana", beforeSubmit: async () => undefined,
    });
    expect(fake.calls[0]!.vars).toMatchObject({
      path: "/listings/listing_1", senderLabel: "Dana",
      readySelector: '[data-roomscout-compose="new-message"]',
    });
  });

  it("reports a readback mismatch as a retryable code, never as human_required", async () => {
    const fake = transport([prepared({ values: { body: `${BODY} ` } })]);
    const beforeSubmit = vi.fn(async () => undefined);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit,
    })).rejects.toThrow("FIRECRAWL_WRITE_PREPARE_MISMATCH");
    expect(beforeSubmit).not.toHaveBeenCalled();
    expect(fake.runProgram).toHaveBeenCalledOnce();
  });

  it("treats an unusable send button as a mismatch rather than a policy stop", async () => {
    const fake = transport([prepared({ send: { count: 1, visible: true, enabled: false } })]);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    })).rejects.toThrow("FIRECRAWL_WRITE_PREPARE_MISMATCH");
  });

  it("stops at the missing login without filling or submitting", async () => {
    const fake = transport([prepared({ authenticated: false, values: { body: null }, send: { count: 0, visible: false, enabled: false } })]);
    const beforeSubmit = vi.fn(async () => undefined);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit,
    })).resolves.toEqual({ outcome: "human_required", submitted: false, blocker: "password", profileAuthenticated: false });
    expect(beforeSubmit).not.toHaveBeenCalled();
    expect(fake.runProgram).toHaveBeenCalledOnce();
  });

  it("reports a missing receipt as unknown and keeps the home observation", async () => {
    const fake = transport([prepared(), sent({
      receipt: { status: null, errorCode: null, providerMessageId: null, providerThreadId: null, text: "" },
      thread: { providerThreadId: null, messages: [] },
    })]);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    })).resolves.toEqual({
      outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN", profileAuthenticated: true,
    });
  });

  it("treats the portal receipt as delivery proof and only warns when the thread read-back misses the message", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = transport([prepared(), sent({
      thread: { providerThreadId: "thread_1", messages: [{ id: "message_old", direction: "inbound", body120: "Frei" }] },
    })]);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    })).resolves.toMatchObject({ outcome: "succeeded", submitted: true });
    expect(warn).toHaveBeenCalledWith("FIRECRAWL_PORTAL_WRITE_READBACK_MISMATCH", expect.any(Object));
    warn.mockRestore();
  });

  it("accepts a read-back whose whitespace the portal collapsed", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const body = "Hallo,\n\nwir nehmen das Angebot an.\nMonatliche Gesamtkosten: 350 €.";
    const fake = transport([prepared({ values: { body } }), sent({
      receipt: { status: "sent", errorCode: null, providerMessageId: "message_new", providerThreadId: "thread_1", text: "sent" },
      thread: { providerThreadId: "thread_1", messages: [{ id: "message_new", direction: "outbound", body120: body.replace(/\s+/g, " ").slice(0, 120) }] },
    })]);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body, providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    })).resolves.toMatchObject({ outcome: "succeeded" });
    expect(warn).not.toHaveBeenCalledWith("FIRECRAWL_PORTAL_WRITE_READBACK_MISMATCH", expect.any(Object));
    warn.mockRestore();
  });

  it("never retries a failure after the claim", async () => {
    const fake = transport([prepared(), new Error("FIRECRAWL_INTERACT_EXECUTION_FAILED:connection lost")]);
    const beforeSubmit = vi.fn(async () => undefined);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit,
    })).resolves.toEqual({ outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" });
    expect(beforeSubmit).toHaveBeenCalledOnce();
    expect(fake.runProgram).toHaveBeenCalledTimes(2);
  });

  it("refuses a target outside the reviewed write paths before any program runs", async () => {
    const fake = transport([]);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, targetPath: "/sign-in", beforeSubmit: async () => undefined,
    })).rejects.toThrow("PORTAL_TARGET_PATH_INVALID");
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "../escape", beforeSubmit: async () => undefined,
    })).rejects.toThrow("FIRECRAWL_PORTAL_THREAD_ID_INVALID");
    expect(fake.runProgram).not.toHaveBeenCalled();
  });

  it("emits programs the sandbox wrapper can parse", async () => {
    const fake = transport([prepared(), sent()]);
    await writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    });
    for (const call of fake.calls) {
      const program = buildFirecrawlProgram(call.body, call.vars);
      // A syntax slip inside a template string would otherwise only surface as
      // an opaque sandbox failure in production.
      expect(() => new Function("page", `return (async () => { ${program} })();`)).not.toThrow();
    }
  });

  it("maps a malformed program result to one safe error", async () => {
    const fake = transport([{ authenticated: "yes" }]);
    await expect(writeFirecrawlPortalMessage({
      session: fake.session, body: BODY, providerThreadId: "thread_1", beforeSubmit: async () => undefined,
    })).rejects.toThrow("FIRECRAWL_PORTAL_WRITE_RESULT_INVALID");
  });
});

describe("Firecrawl portal registration programs", () => {
  const EMAIL = "agent-7f3@agentmail.to";
  const PASSWORD = "Rs!0f2c9b1e4d7a6f5aA1";

  /** A session that answers each program in order and records what it got. */
  function transport(results: unknown[]) {
    const calls: Array<{ body: string; vars: Record<string, unknown>; mutating?: boolean; timeout?: number }> = [];
    const runProgram = vi.fn(async (
      body: string, vars: Record<string, unknown>, mutating?: boolean, timeout?: number,
    ) => {
      calls.push({ body, vars, mutating, timeout });
      const next = results[calls.length - 1];
      if (next instanceof Error) throw next;
      return next;
    });
    return { calls, session: { runProgram } as unknown as FirecrawlPortalSession, runProgram };
  }

  it("reports a visible captcha in one program instead of polling for it", async () => {
    const fake = transport([{ stage: "captcha", url: "https://roomscout.dev/sign-up", formErrors: [] }]);
    await expect(signUpOnFirecrawlPortal({ session: fake.session, email: EMAIL, password: PASSWORD }))
      .resolves.toEqual({ outcome: "human_required", blocker: "captcha", url: "https://roomscout.dev/sign-up" });
    expect(fake.runProgram).toHaveBeenCalledOnce();
    const [signup] = fake.calls;
    expect(signup!.timeout).toBe(120_000);
    expect(signup!.body).toContain("new URL(await page.url()).origin");
    // The captcha verdict is read before anything is typed into the form.
    expect(signup!.body.indexOf("readCaptcha()")).toBeLessThan(signup!.body.indexOf("fill(vars.email)"));
  });

  it("carries the sign-up through to the verification program in two calls", async () => {
    const fake = transport([
      { stage: "awaiting_code", url: "https://roomscout.dev/sign-up/verify-email-address", formErrors: [] },
      { authenticated: true, url: "https://roomscout.dev/", formErrors: [] },
    ]);
    await expect(signUpOnFirecrawlPortal({ session: fake.session, email: EMAIL, password: PASSWORD }))
      .resolves.toMatchObject({ outcome: "awaiting_code" });
    await expect(submitFirecrawlPortalVerification({ session: fake.session, code: "123456" }))
      .resolves.toEqual({ authenticated: true, url: "https://roomscout.dev/" });
    expect(fake.runProgram).toHaveBeenCalledTimes(2);
    const [signup, verify] = fake.calls;
    // Exact values travel as JSON variables, never inside the program text.
    expect(signup!.vars).toMatchObject({ email: EMAIL, password: PASSWORD, signupPath: "/sign-up" });
    expect(signup!.body).not.toContain(EMAIL);
    expect(signup!.body).not.toContain(PASSWORD);
    expect(verify!.vars).toMatchObject({ code: "123456" });
    expect(verify!.body).not.toContain("123456");
    expect(verify!.timeout).toBe(120_000);
    // The OTP wait and the authentication polls happen inside the sandbox.
    expect(verify!.body).toContain("vars.polls.attempts");
    expect(verify!.body).toContain("page.waitForTimeout(vars.polls.intervalMs)");
  });

  it("reports a field that did not read back exactly as a typed mismatch", async () => {
    const fake = transport([{ stage: "mismatch", url: "https://roomscout.dev/sign-up", formErrors: [] }]);
    await expect(signUpOnFirecrawlPortal({ session: fake.session, email: EMAIL, password: PASSWORD }))
      .resolves.toEqual({ outcome: "mismatch", url: "https://roomscout.dev/sign-up" });
  });

  it("treats an unclassifiable sign-up page as a human stop", async () => {
    const fake = transport([{ stage: "unknown", url: "https://roomscout.dev/sign-up", formErrors: ["Bitte erneut versuchen"] }]);
    await expect(signUpOnFirecrawlPortal({ session: fake.session, email: EMAIL, password: PASSWORD }))
      .resolves.toMatchObject({ outcome: "human_required", blocker: "policy_human_presence" });
  });

  it("refuses an unusable credential or code before any program runs", async () => {
    const fake = transport([]);
    await expect(signUpOnFirecrawlPortal({ session: fake.session, email: "", password: PASSWORD }))
      .rejects.toThrow("PORTAL_REGISTRATION_EMAIL_INVALID");
    await expect(submitFirecrawlPortalVerification({ session: fake.session, code: "12 34 56" }))
      .rejects.toThrow("PORTAL_VERIFICATION_CODE_INVALID");
    await expect(readFirecrawlPortalPageState({ session: fake.session, path: "https://evil.example" }))
      .rejects.toThrow("PORTAL_TARGET_PATH_INVALID");
    expect(fake.runProgram).not.toHaveBeenCalled();
  });

  it("maps a malformed registration result to one safe error", async () => {
    const fake = transport([{ stage: "signed-up" }, { authenticated: "yes" }, { stage: "sign_up" }]);
    await expect(signUpOnFirecrawlPortal({ session: fake.session, email: EMAIL, password: PASSWORD }))
      .rejects.toThrow("FIRECRAWL_PORTAL_REGISTRATION_RESULT_INVALID");
    await expect(submitFirecrawlPortalVerification({ session: fake.session, code: "123456" }))
      .rejects.toThrow("FIRECRAWL_PORTAL_VERIFICATION_RESULT_INVALID");
    await expect(readFirecrawlPortalPageState({ session: fake.session, path: "/" }))
      .rejects.toThrow("FIRECRAWL_PORTAL_PAGE_STATE_INVALID");
  });

  it("classifies a saved profile in one read-only program", async () => {
    const fake = transport([{
      url: "https://roomscout.dev/", authenticated: true, stage: "authenticated",
      hasPasswordField: false, hasCodeField: false, captcha: false,
    }]);
    await expect(readFirecrawlPortalPageState({ session: fake.session, path: "/" }))
      .resolves.toMatchObject({ authenticated: true, stage: "authenticated" });
    const [state] = fake.calls;
    expect(state!.mutating).toBe(false);
    expect(state!.body).toContain("new URL(await page.url()).origin");
    expect(state!.vars).toMatchObject({ path: "/" });
  });

  it("emits registration programs the sandbox wrapper can parse", async () => {
    const fake = transport([
      { stage: "awaiting_code", url: "https://roomscout.dev/sign-up", formErrors: [] },
      { authenticated: true, url: "https://roomscout.dev/", formErrors: [] },
      { url: "https://roomscout.dev/", authenticated: true, stage: "authenticated", hasPasswordField: false, hasCodeField: false, captcha: false },
    ]);
    await signUpOnFirecrawlPortal({ session: fake.session, email: EMAIL, password: PASSWORD });
    await submitFirecrawlPortalVerification({ session: fake.session, code: "123456" });
    await readFirecrawlPortalPageState({ session: fake.session, path: "/" });
    for (const call of fake.calls) {
      const program = buildFirecrawlProgram(call.body, call.vars);
      expect(() => new Function("page", `return (async () => { ${program} })();`)).not.toThrow();
    }
  });

  it("spends at most six HTTP round trips on a full registration", async () => {
    const interactions: string[] = [];
    let stops = 0;
    const results = [
      { stage: "awaiting_code", url: "https://roomscout.dev/sign-up", formErrors: [] },
      { authenticated: true, url: "https://roomscout.dev/", formErrors: [] },
    ];
    const session = await createFirecrawlPortalSession({
      transport: {
        scrape: async () => { interactions.push("scrape"); return { metadata: { scrapeId: "scrape_1" } }; },
        interact: async (_id, options) => {
          const keepalive = options.code.includes(FIRECRAWL_PORTAL_URL_PROGRAM);
          interactions.push(keepalive ? "keepalive" : "interact");
          return {
            success: true, exitCode: 0, killed: false,
            result: JSON.stringify(keepalive ? { url: "https://roomscout.dev/sign-up" } : results.shift()),
          };
        },
        stop: async () => { stops += 1; return {}; },
      },
      url: "https://roomscout.dev/sign-up", profileName: "profile_1", saveChanges: true, timeoutMs: 420_000,
    });
    await expect(signUpOnFirecrawlPortal({ session, email: EMAIL, password: PASSWORD }))
      .resolves.toMatchObject({ outcome: "awaiting_code" });
    // The AgentMail wait keeps the browser alive; those calls are not part of
    // the registration's own round-trip budget.
    await session.runProgram(FIRECRAWL_PORTAL_URL_PROGRAM, {}, false, 15_000);
    await expect(submitFirecrawlPortalVerification({ session, code: "123456" }))
      .resolves.toMatchObject({ authenticated: true });
    await session.stop();

    expect(interactions.filter((step) => step !== "keepalive")).toEqual(["scrape", "interact", "interact"]);
    expect(interactions.filter((step) => step !== "keepalive").length + stops).toBeLessThanOrEqual(6);
    expect(stops).toBe(1);
  });
});
