import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readFirecrawlPortalInboxBatch,
  signUpOnFirecrawlPortal,
  submitFirecrawlPortalVerification,
  writeFirecrawlPortalMessage,
} from "./firecrawlPortalEngine";
import { buildFirecrawlProgram } from "./firecrawlProgram";
import {
  createFirecrawlPortalSession,
  FIRECRAWL_PORTAL_URL_PROGRAM,
  type FirecrawlPortalTransport,
} from "./firecrawlPortalRuntime";

/**
 * Round-trip parity with the proven local scripts (plan §0 and slice S7).
 *
 * Every other Firecrawl test stubs `runProgram` and therefore cannot see what
 * actually leaves the process. This one records the transport itself — the
 * three calls that are real HTTP requests against api.firecrawl.dev: one
 * `POST /v2/scrape`, N × `POST /v2/scrape/{id}/interact`, one
 * `DELETE /v2/scrape/{id}`. The budgets below are the ones
 * `scripts/firecrawl-local-{message,signup}.mjs` proved in production:
 *
 *   message      ≤ 4   (scrape · prepare · send · stop)
 *   inbox sync   ≤ 3   (scrape · one batch program · stop), up to 10 threads
 *   registration ≤ 6   (scrape · sign-up · verify · stop), keepalives excluded
 *
 * A regression that reintroduces a primitive per browser action — the shape
 * that cost 16 to 46 round trips a message — fails here instead of in prod.
 */

/**
 * The line prefix `buildFirecrawlProgram` prints its encoded result behind.
 * Pinned here on purpose: it is the wire contract between our program text and
 * `parseInteractEnvelope`, and the assertion below fails if either side drifts.
 */
const RESULT_MARKER = "__ROOMSCOUT_RESULT__";

type RecordedCall =
  | { kind: "scrape" }
  | { kind: "interact"; mutating: boolean; keepalive: boolean; code: string }
  | { kind: "stop" };

/**
 * A transport that answers each Interact request with the next queued program
 * result and records what it was asked to do. Keepalives are tagged so the
 * registration budget can exclude the AgentMail wait, which holds the browser
 * open but is not part of the registration's own work.
 */
function recordingTransport(results: unknown[]): {
  transport: FirecrawlPortalTransport;
  calls: RecordedCall[];
  interacts(): Extract<RecordedCall, { kind: "interact" }>[];
  /** HTTP round trips that belong to the operation's own budget. */
  budgeted(): RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const queue = [...results];
  const interacts = () => calls.filter((call): call is Extract<RecordedCall, { kind: "interact" }> => call.kind === "interact");
  return {
    calls,
    interacts,
    budgeted: () => calls.filter((call) => call.kind !== "interact" || !call.keepalive),
    transport: {
      async scrape() {
        calls.push({ kind: "scrape" });
        return { data: { metadata: { scrapeId: "scrape_parity_1" } } };
      },
      async interact(_scrapeId, options) {
        const keepalive = options.code.includes(FIRECRAWL_PORTAL_URL_PROGRAM);
        calls.push({ kind: "interact", mutating: options.mutating, keepalive, code: options.code });
        const next = keepalive ? { url: "https://roomscout.dev/" } : queue.shift();
        if (next instanceof Error) throw next;
        const completionKey = options.code.match(/__roomscoutRun_[A-Za-z0-9_-]+/)?.[0];
        const completed = completionKey === undefined ? next : {
          __roomscoutCompletion: { id: completionKey, state: "done", value: next },
        };
        // Firecrawl's own `result` field is deliberately left unrelated: the
        // marker line in `output` is the authoritative channel (slice S0).
        return {
          success: true,
          exitCode: 0,
          killed: false,
          result: { unrelated: "provider structured value" },
          output: `some provider chatter\n${RESULT_MARKER}${JSON.stringify(completed)}\n`,
        };
      },
      async stop() {
        calls.push({ kind: "stop" });
        return {};
      },
    },
  };
}

const BODY = "Hallo, ist das Zimmer im Oktober noch frei?";

function preparedResult() {
  return {
    url: "https://roomscout.dev/inbox/thread_1",
    authenticated: true,
    existingIds: ["message_old"],
    values: { body: BODY },
    send: { count: 1, visible: true, enabled: true },
  };
}

function sentResult() {
  return {
    receipt: {
      status: "sent",
      errorCode: null,
      providerMessageId: "message_new",
      providerThreadId: "thread_1",
      text: "Gesendet",
    },
    thread: {
      providerThreadId: "thread_1",
      messages: [
        { id: "message_old", direction: "inbound", body120: "Frei ab Oktober" },
        { id: "message_new", direction: "outbound", body120: BODY.slice(0, 120) },
      ],
    },
    home: { authenticated: true },
  };
}

function inboxBatch(threadCount: number) {
  const threads = Array.from({ length: threadCount }, (_unused, index) => ({
    providerThreadId: `thread_${index + 1}`,
    subject: "Zimmer",
    participants: ["Vermietung"],
    lastMessageAt: 1_700_000_000_000 + index,
    messages: [{
      providerMessageId: `message_${index + 1}`,
      direction: "inbound" as const,
      bodyText: "Noch frei.",
      sentAt: 1_700_000_000_000 + index,
    }],
  }));
  return {
    threads,
    missingThreadIds: [],
    failedThreadIds: [],
    bodyTruncatedThreadIds: [],
    historyTruncatedThreadIds: [],
    discoveredThreadIds: threads.map((thread) => thread.providerThreadId),
    truncated: false,
    timedOut: false,
    nextOffset: 0,
  };
}

describe("Firecrawl round-trip parity with the local proof", () => {
  it("pins the result marker the recording transport speaks", () => {
    // If `buildFirecrawlProgram` stops emitting this prefix, every budget below
    // would silently pass against a transport nothing can decode.
    expect(buildFirecrawlProgram("return { ok: true };", {})).toContain(RESULT_MARKER);
  });

  it("sends one message in at most four HTTP round trips", async () => {
    const fake = recordingTransport([preparedResult(), sentResult()]);
    const session = await createFirecrawlPortalSession({
      transport: fake.transport,
      url: "https://roomscout.dev/inbox/thread_1",
      profileName: "profile_parity",
      saveChanges: false,
      timeoutMs: 300_000,
    });
    await expect(writeFirecrawlPortalMessage({
      session,
      body: BODY,
      providerThreadId: "thread_1",
      beforeSubmit: async () => undefined,
    })).resolves.toMatchObject({ outcome: "succeeded", providerMessageId: "message_new" });
    await session.stop();

    expect(fake.calls.map((call) => call.kind)).toEqual(["scrape", "interact", "interact", "stop"]);
    expect(fake.budgeted()).toHaveLength(4);
  });

  it("performs exactly one mutating request, and only after the Convex claim", async () => {
    const order: string[] = [];
    const fake = recordingTransport([preparedResult(), sentResult()]);
    const session = await createFirecrawlPortalSession({
      transport: {
        ...fake.transport,
        interact: async (scrapeId, options) => {
          order.push(options.mutating ? "mutating" : "read");
          return await fake.transport.interact(scrapeId, options);
        },
      },
      url: "https://roomscout.dev/inbox/thread_1",
      profileName: "profile_parity",
      saveChanges: false,
      timeoutMs: 300_000,
    });
    await writeFirecrawlPortalMessage({
      session,
      body: BODY,
      providerThreadId: "thread_1",
      beforeSubmit: async () => { order.push("claim"); },
    });
    await session.stop();

    expect(order).toEqual(["read", "claim", "mutating"]);
    expect(fake.interacts().filter((call) => call.mutating)).toHaveLength(1);
  });

  it("never issues a second mutating request when the send program fails", async () => {
    const fake = recordingTransport([
      preparedResult(),
      new Error("FIRECRAWL_INTERACT_EXECUTION_FAILED:connection lost"),
    ]);
    const session = await createFirecrawlPortalSession({
      transport: fake.transport,
      url: "https://roomscout.dev/inbox/thread_1",
      profileName: "profile_parity",
      saveChanges: false,
      timeoutMs: 300_000,
    });
    await expect(writeFirecrawlPortalMessage({
      session,
      body: BODY,
      providerThreadId: "thread_1",
      beforeSubmit: async () => undefined,
    })).resolves.toEqual({ outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" });
    await session.stop();

    expect(fake.interacts().filter((call) => call.mutating)).toHaveLength(1);
    expect(fake.budgeted()).toHaveLength(4);
  });

  it("reads an inbox of ten threads in at most three HTTP round trips", async () => {
    const fake = recordingTransport([inboxBatch(10)]);
    const session = await createFirecrawlPortalSession({
      transport: fake.transport,
      url: "https://roomscout.dev/inbox",
      profileName: "profile_parity",
      saveChanges: false,
      timeoutMs: 120_000,
    });
    const batch = await readFirecrawlPortalInboxBatch({ session });
    await session.stop();

    expect(batch.threads).toHaveLength(10);
    expect(batch.truncated).toBe(false);
    expect(fake.calls.map((call) => call.kind)).toEqual(["scrape", "interact", "stop"]);
    expect(fake.budgeted()).toHaveLength(3);
    // A read must never be dispatched as a mutating request.
    expect(fake.interacts().every((call) => !call.mutating)).toBe(true);
  });

  it("registers an account in at most six HTTP round trips, keepalives excluded", async () => {
    const fake = recordingTransport([
      { stage: "awaiting_code", url: "https://roomscout.dev/sign-up/verify-email-address", formErrors: [] },
      { authenticated: true, url: "https://roomscout.dev/", formErrors: [] },
    ]);
    const session = await createFirecrawlPortalSession({
      transport: fake.transport,
      url: "https://roomscout.dev/sign-up",
      profileName: "profile_parity",
      saveChanges: true,
      timeoutMs: 420_000,
    });
    await expect(signUpOnFirecrawlPortal({
      session,
      email: "agent-7f3@agentmail.to",
      password: "Rs!0f2c9b1e4d7a6f5aA1",
    })).resolves.toMatchObject({ outcome: "awaiting_code" });
    // The host-side AgentMail wait keeps the browser alive between the two
    // programs; those calls do not belong to the registration's own budget.
    await session.runProgram(FIRECRAWL_PORTAL_URL_PROGRAM, {}, false, 15_000);
    await session.runProgram(FIRECRAWL_PORTAL_URL_PROGRAM, {}, false, 15_000);
    await expect(submitFirecrawlPortalVerification({ session, code: "123456" }))
      .resolves.toMatchObject({ authenticated: true });
    await session.stop();

    expect(fake.budgeted().map((call) => call.kind)).toEqual(["scrape", "interact", "interact", "stop"]);
    expect(fake.budgeted().length).toBeLessThanOrEqual(6);
    expect(fake.interacts().filter((call) => call.keepalive)).toHaveLength(2);
  });

  it("keeps the Firecrawl path free of the reviewed Browserbase driver", () => {
    // The primitive-per-call shape came from importing the Stagehand driver.
    // Browserbase still owns that driver; Firecrawl must not reach into it, or
    // the round-trip budgets above stop describing what production does.
    const firecrawlSources = [
      "convex/firecrawlPortal.ts",
      "convex/integrations/firecrawlPortalEngine.ts",
      "convex/integrations/firecrawlPortalRuntime.ts",
      "convex/integrations/firecrawlProgram.ts",
    ];
    for (const path of firecrawlSources) {
      expect(readFileSync(resolve(process.cwd(), path), "utf8")).not.toContain("stagehandPortalDriver");
    }
  });

  it("reads the same receipt attributes the local message proof reads", async () => {
    // `scripts/firecrawl-local-*.mjs` are the conformance template (plan §7);
    // reading the file keeps both sides from drifting apart unnoticed.
    const local = readFileSync(resolve(process.cwd(), "scripts/firecrawl-local-message.mjs"), "utf8");
    const receiptAttributes = [
      "data-roomscout-write-result",
      "data-roomscout-error-code",
      "data-roomscout-provider-message-id",
      "data-roomscout-provider-thread-id",
      // The thread read-back is the second half of the success condition.
      "data-roomscout-message-id",
    ];
    const fake = recordingTransport([preparedResult(), sentResult()]);
    const session = await createFirecrawlPortalSession({
      transport: fake.transport,
      url: "https://roomscout.dev/inbox/thread_1",
      profileName: "profile_parity",
      saveChanges: false,
      timeoutMs: 300_000,
    });
    await writeFirecrawlPortalMessage({
      session,
      body: BODY,
      providerThreadId: "thread_1",
      beforeSubmit: async () => undefined,
    });
    const send = fake.interacts().find((call) => call.mutating)!;
    for (const attribute of receiptAttributes) {
      expect(local).toContain(attribute);
      expect(send.code).toContain(attribute);
    }
    // Exact reviewed values travel as JSON variables, never in program prose.
    const prepare = fake.interacts().find((call) => !call.mutating)!;
    expect(prepare.code.split(JSON.stringify(BODY))).toHaveLength(2);
  });
});
