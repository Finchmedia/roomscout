import { describe, expect, it, vi } from "vitest";
import { readFirecrawlPortalInboxBatch } from "./firecrawlPortalEngine";
import type { FirecrawlPortalSession } from "./firecrawlPortalRuntime";

type ProgramVars = Record<string, unknown>;

function executingSession(page: {
  goto: (url: string) => Promise<void>;
  url: () => Promise<string>;
  evaluate: <T, A>(fn: (arg: A) => T, arg?: A) => Promise<T>;
  waitForFunction: <A>(fn: (arg: A) => unknown, arg: A) => Promise<void>;
}) {
  const runProgram = vi.fn(async (program: string, vars: ProgramVars) => {
    const execute = new Function("page", "vars", `return (async () => {${program}})()`);
    return await execute(page, vars);
  });
  return { runProgram } as unknown as FirecrawlPortalSession;
}

describe("Firecrawl inbox DOM readiness", () => {
  it("waits for a streaming thread to expose its owned ready state", async () => {
    let currentUrl = "https://roomscout.dev/inbox";
    let detailPolls = 0;
    const page = {
      goto: vi.fn(async (url: string) => {
        currentUrl = url;
        window.history.replaceState({}, "", new URL(url).pathname);
        document.body.innerHTML = url.endsWith("/inbox")
          ? '<div data-roomscout-inbox-state="ready"><a href="/inbox/thread_1" data-roomscout-thread-id="thread_1"></a></div>'
          : "<main>Streaming thread shell</main>";
      }),
      url: vi.fn(async () => currentUrl),
      evaluate: async <T, A>(fn: (arg: A) => T, arg?: A) => fn(arg as A),
      waitForFunction: async <A>(fn: (arg: A) => unknown, arg: A) => {
        if (fn(arg)) return;
        detailPolls += 1;
        document.body.innerHTML = `
          <section data-roomscout-thread-state="ready" data-roomscout-thread-id="thread_1" data-roomscout-last-message-at="42">
            <h1 data-roomscout-subject>Modul Ost</h1>
            <span data-roomscout-participant>Owner</span>
            <article data-roomscout-message-id="message_1" data-roomscout-direction="inbound" data-roomscout-sent-at="42">
              <strong data-roomscout-sender>Owner</strong><p data-roomscout-body>Available</p>
            </article>
          </section>`;
        if (!fn(arg)) throw new Error("readiness timeout");
      },
    };

    const batch = await readFirecrawlPortalInboxBatch({
      session: executingSession(page),
      requestedThreadIds: ["thread_1"],
      maxThreads: 1,
      navigationTimeoutMs: 1_000,
      overallTimeoutMs: 5_000,
    });

    expect(detailPolls).toBe(1);
    expect(batch.threads).toEqual([expect.objectContaining({
      providerThreadId: "thread_1",
      subject: "Modul Ost",
      messages: [expect.objectContaining({ providerMessageId: "message_1" })],
    })]);
    expect(batch.missingThreadIds).toEqual([]);
    expect(batch.failedThreadIds).toEqual([]);
  });

  it("classifies only an explicit unavailable state as missing", async () => {
    let currentUrl = "https://roomscout.dev/inbox";
    const page = {
      goto: vi.fn(async (url: string) => {
        currentUrl = url;
        window.history.replaceState({}, "", new URL(url).pathname);
        document.body.innerHTML = url.endsWith("/inbox")
          ? '<div data-roomscout-inbox-state="empty"></div>'
          : '<section data-roomscout-thread-state="unavailable"></section>';
      }),
      url: vi.fn(async () => currentUrl),
      evaluate: async <T, A>(fn: (arg: A) => T, arg?: A) => fn(arg as A),
      waitForFunction: async <A>(fn: (arg: A) => unknown, arg: A) => {
        if (!fn(arg)) throw new Error("readiness timeout");
      },
    };

    const batch = await readFirecrawlPortalInboxBatch({
      session: executingSession(page),
      requestedThreadIds: ["thread_missing"],
      maxThreads: 1,
      navigationTimeoutMs: 1_000,
      overallTimeoutMs: 5_000,
    });

    expect(batch.threads).toEqual([]);
    expect(batch.missingThreadIds).toEqual(["thread_missing"]);
    expect(batch.failedThreadIds).toEqual([]);
  });

  it("keeps a shell that never becomes terminal in failed, not missing", async () => {
    let currentUrl = "https://roomscout.dev/inbox";
    const page = {
      goto: vi.fn(async (url: string) => {
        currentUrl = url;
        window.history.replaceState({}, "", new URL(url).pathname);
        document.body.innerHTML = url.endsWith("/inbox")
          ? '<div data-roomscout-inbox-state="ready"><a href="/inbox/thread_1" data-roomscout-thread-id="thread_1"></a></div>'
          : "<main>Streaming thread shell</main>";
      }),
      url: vi.fn(async () => currentUrl),
      evaluate: async <T, A>(fn: (arg: A) => T, arg?: A) => fn(arg as A),
      waitForFunction: async <A>(fn: (arg: A) => unknown, arg: A) => {
        if (!fn(arg)) throw new Error("readiness timeout");
      },
    };

    const batch = await readFirecrawlPortalInboxBatch({
      session: executingSession(page),
      requestedThreadIds: ["thread_1"],
      maxThreads: 1,
      navigationTimeoutMs: 1_000,
      overallTimeoutMs: 5_000,
    });

    expect(batch.missingThreadIds).toEqual([]);
    expect(batch.failedThreadIds).toEqual(["thread_1"]);
  });
});
