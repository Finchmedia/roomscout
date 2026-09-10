import { beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import {
  PORTAL_DOM_EXPRESSIONS,
  fingerprintRenderedTerms,
  readPortalDomEvidenceFromPage,
} from "./portalDomEvidence";

const page = {
  evaluate: async <Result>(expression: string) => window.eval(expression) as Result,
  url: () => "https://roomscout.dev/inbox",
};

describe("portalDomEvidence", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as typeof window & { Clerk?: unknown }).Clerk;
  });

  it("hashes the actual rendered terms text together with its path", async () => {
    document.body.innerHTML = `
      <form data-roomscout-terms-kind="present" data-roomscout-terms-path="/demo-terms/v1">
        <p class="eyebrow">Controlled demo account</p>
        <p>RoomScout controlled-demo terms v1: This free test account is for the nonbinding roomscout.dev demo only. No payment, booking, contract, or real-world service is created.</p>
      </form>`;
    await expect(readPortalDomEvidenceFromPage(page, "registration")).resolves.toEqual({
      kind: "registration",
      terms: {
        kind: "present",
        path: "/demo-terms/v1",
        contentFingerprint:
          "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1",
      },
      captcha: { kind: "absent" },
      paymentOrContractDetected: false,
      termsGateVisible: true,
    });
    expect(fingerprintRenderedTerms("/changed", "same text")).not.toBe(
      fingerprintRenderedTerms("/demo-terms/v1", "same text"),
    );
  });

  it("ignores an empty CAPTCHA placeholder but detects a visible challenge", async () => {
    document.body.innerHTML = '<div class="cl-captcha"></div>';
    await expect(readPortalDomEvidenceFromPage(page, "registration")).resolves
      .toMatchObject({ captcha: { kind: "absent" } });

    document.body.innerHTML = `
      <div class="cl-captcha"><iframe title="captcha challenge"></iframe></div>`;
    await expect(readPortalDomEvidenceFromPage(page, "registration")).resolves
      .toMatchObject({ captcha: { kind: "present_unsolved" } });

    document.body.innerHTML = `
      <textarea name="cf-turnstile-response">native-token</textarea>`;
    await expect(readPortalDomEvidenceFromPage(page, "registration")).resolves
      .toMatchObject({ captcha: { kind: "browserbase_native_solved" } });
  });

  it("survives bundled identifier minification without closure references", async () => {
    document.body.innerHTML = '<div class="cl-captcha"></div>';
    const source = `
      export async function run(page) {
        return await page.evaluate(${JSON.stringify(PORTAL_DOM_EXPRESSIONS.registration)});
      }
    `;
    const bundled = execFileSync(
      path.join(process.cwd(), "node_modules/.bin/esbuild"),
      ["--format=cjs", "--keep-names", "--minify-identifiers", "--target=es2022"],
      { encoding: "utf8", input: source },
    );
    const module = { exports: {} as { run?: (target: typeof page) => Promise<unknown> } };
    vm.runInNewContext(bundled, { module, exports: module.exports });
    await expect(module.exports.run?.(page)).resolves.toMatchObject({
      captchaKind: "absent",
    });
  });

  it("confirms authentication only from the exact visible inbox contract", async () => {
    document.body.innerHTML = '<div data-roomscout-inbox-state="ready"></div>';
    await expect(readPortalDomEvidenceFromPage(page, "access")).resolves.toEqual({
      kind: "access",
      authenticated: true,
    });
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://roomscout.dev/sign-in",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: false });
    document.body.innerHTML += '<div data-roomscout-inbox-state="empty"></div>';
    await expect(readPortalDomEvidenceFromPage(page, "access")).resolves.toEqual({
      kind: "access",
      authenticated: false,
    });
  });

  it("uses path-specific stable access contracts for threads and listings", async () => {
    document.body.innerHTML = `
      <section data-roomscout-thread-state="ready"></section>
      <form data-roomscout-compose="reply">
        <textarea data-roomscout-write="body"></textarea>
      </form>`;
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://roomscout.dev/inbox/thread_1",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: true });
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://roomscout.dev/listings/listing_1",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: true });
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://roomscout.dev/sign-in",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: false });
  });

  it("confirms a signed-in portal home from Clerk's loaded session state", async () => {
    (window as typeof window & { Clerk?: unknown }).Clerk = {
      loaded: true, user: { id: "user_1" }, session: { id: "session_1" },
    };
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://roomscout.dev/",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: true });
    (window as typeof window & { Clerk?: unknown }).Clerk = {
      loaded: true, user: null, session: null,
    };
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://roomscout.dev/",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: false });
  });

  it("recognizes Clerk's authenticated post-signup redirect without allowing other paths", async () => {
    (window as typeof window & { Clerk?: unknown }).Clerk = {
      loaded: true, user: { id: "user_1" }, session: { id: "session_1" },
    };
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://roomscout.dev/listings/new",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: true });
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://roomscout.dev/sign-up",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: false });
    await expect(readPortalDomEvidenceFromPage({
      ...page,
      url: () => "https://outside.example/listings/new",
    }, "access")).resolves.toEqual({ kind: "access", authenticated: false });
  });

  it("reads exact composer and receipt attributes without interpretation", async () => {
    document.body.innerHTML = `
      <textarea data-roomscout-write="body">Approved body</textarea>
      <p data-roomscout-write-result="sent"
         data-roomscout-provider-thread-id="thread_1"
         data-roomscout-provider-message-id="message_1">Sent</p>`;
    await expect(readPortalDomEvidenceFromPage(page, "composer")).resolves.toEqual({
      kind: "composer",
      body: "Approved body",
    });
    await expect(readPortalDomEvidenceFromPage(page, "receipt")).resolves.toEqual({
      kind: "receipt",
      visible: true,
      providerThreadId: "thread_1",
      providerMessageId: "message_1",
    });
  });

  it("bounds inbox ids and reads the stable thread contract", async () => {
    document.body.innerHTML = `
      <a href="/inbox/thread_1" data-roomscout-thread-id="thread_1"></a>
      <section data-roomscout-thread-state="ready" data-roomscout-thread-id="thread_1" data-roomscout-last-message-at="42">
        <h1 data-roomscout-subject>Room</h1><span data-roomscout-participant>Owner</span>
        <article data-roomscout-message-id="message_1" data-roomscout-direction="inbound" data-roomscout-sent-at="42">
          <strong data-roomscout-sender>Owner</strong><p data-roomscout-body>Available</p>
        </article>
      </section>`;
    await expect(readPortalDomEvidenceFromPage(page, "inbox")).resolves.toEqual({
      kind: "inbox",
      providerThreadIds: ["thread_1"],
    });
    await expect(readPortalDomEvidenceFromPage(page, "thread")).resolves.toEqual({
      kind: "thread",
      thread: {
        providerThreadId: "thread_1",
        subject: "Room",
        participants: ["Owner"],
        lastMessageAt: 42,
        messages: [{
          providerMessageId: "message_1",
          direction: "inbound",
          senderLabel: "Owner",
          bodyText: "Available",
          sentAt: 42,
        }],
      },
    });
  });
});
