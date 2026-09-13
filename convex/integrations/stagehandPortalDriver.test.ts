import { describe, expect, it, vi } from "vitest";
import {
  controlledRegistrationFailureCode,
  ensureControlledPortalRegistration,
  ensurePortalAccess,
  readPortalInbox,
  readPortalThread,
  sendControlledPortalMessage,
  sendPortalMessage,
  type PortalDomEvidence,
  type StagehandPortalPrimitives,
} from "./stagehandPortalDriver";

describe("ensureControlledPortalRegistration", () => {
  it("uses the exact selector fallback when instruction-based act is absent", async () => {
    const mock = client({ getUrl: vi.fn(async () => "https://roomscout.dev/sign-up") });
    mock.actInstruction = undefined;
    await expect(ensureControlledPortalRegistration({
      client: mock,
      email: "musician@example.test",
      password: "ephemeral-password",
    })).resolves.toEqual({ outcome: "awaiting_code" });
    expect(mock.fillSelector).toHaveBeenCalledWith({
      selector: 'input[name="emailAddress"]', value: "musician@example.test",
    });
    expect(mock.fillSelector).toHaveBeenCalledWith({
      selector: 'input[name="password"]', value: "ephemeral-password",
    });
  });

  it("reports only a fixed failing stage when a provider primitive throws", async () => {
    const mock = client({ navigate: vi.fn(async () => { throw new Error("sensitive provider detail"); }) });
    const error = await ensureControlledPortalRegistration({
      client: mock,
      email: "musician@example.test",
      password: "ephemeral-password",
    }).catch((value: unknown) => value);
    expect(controlledRegistrationFailureCode(error)).toBe(
      "CONTROLLED_REGISTRATION_SIGNUP_NAVIGATE_FAILED",
    );
    expect(String(error)).not.toContain("sensitive provider detail");
  });

  it("runs the reviewed signup as direct exact fills without page classification", async () => {
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"),
      extract: vi.fn(async () => { throw new Error("classifier must not run"); }),
    });
    await expect(ensureControlledPortalRegistration({
      client: mock,
      email: "musician@example.test",
      password: "ephemeral-password",
    })).resolves.toEqual({ outcome: "awaiting_code" });
    expect(mock.navigate).toHaveBeenCalledOnce();
    expect(mock.navigate).toHaveBeenCalledWith({ url: "https://roomscout.dev/sign-up" });
    expect(mock.actInstruction).toHaveBeenNthCalledWith(1, {
      instruction: "Fill the email address input with %email%. Do not submit.",
      variables: { email: "musician@example.test" },
    });
    expect(mock.actInstruction).toHaveBeenNthCalledWith(2, {
      instruction: "Fill the password input with %password%. Do not submit.",
      variables: { password: "ephemeral-password" },
    });
    expect(mock.clickSelector).toHaveBeenCalledWith({
      selector: 'button[data-localization-key="formButtonPrimary"]',
    });
  });

  it("does not click submit when Clerk authenticates after the OTP fill", async () => {
    const mock = client({ extract: vi.fn(async () => { throw new Error("classifier must not run"); }) });
    await expect(ensureControlledPortalRegistration({
      client: mock,
      verificationCode: "123456",
    })).resolves.toEqual({ outcome: "authenticated" });
    expect(mock.fillSelector).toHaveBeenCalledWith({
      selector: 'input[autocomplete="one-time-code"],input[name="code"]',
      value: "123456",
    });
    expect(vi.mocked(mock.actInstruction!).mock.calls.some(
      ([call]) => call.instruction.includes("Click"),
    )).toBe(false);
  });

  it("recognizes OTP auto-submit when the code field disappears during readback", async () => {
    const mock = client();
    const originalInspect = mock.inspectForm;
    let codeInspections = 0;
    mock.inspectForm = vi.fn(async (input) => {
      if (input.role !== "verification_code") return await originalInspect(input);
      codeInspections += 1;
      if (codeInspections <= 2) return await originalInspect(input);
      return {
        count: 0, visible: false, editable: false, name: null, type: null,
        autocomplete: null, required: false, value: null, formValid: null,
      };
    });
    await expect(ensureControlledPortalRegistration({
      client: mock,
      verificationCode: "123456",
    })).resolves.toEqual({ outcome: "authenticated" });
    expect(mock.fillSelector).toHaveBeenCalledOnce();
    expect(mock.clickSelector).not.toHaveBeenCalled();
  });

  it("refuses submit when exact form readback differs", async () => {
    const mock = client({ getUrl: vi.fn(async () => "https://roomscout.dev/sign-up") });
    const originalInspect = mock.inspectForm;
    mock.inspectForm = vi.fn(async (input) => {
      const result = await originalInspect(input);
      if (input.role === "email" && result.value === "musician@example.test") {
        return { ...result, value: "changed@example.test" };
      }
      return result;
    });
    await expect(ensureControlledPortalRegistration({
      client: mock,
      email: "musician@example.test",
      password: "ephemeral-password",
    })).resolves.toEqual({ outcome: "human_required", blocker: "policy_human_presence" });
    expect(mock.actInstruction).toHaveBeenCalledTimes(2);
    expect(vi.mocked(mock.actInstruction!).mock.calls.some(
      ([call]) => call.instruction.includes("Click"),
    )).toBe(false);
  });

  it("accepts an already authenticated context redirected away from signup", async () => {
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/"),
      inspectForm: vi.fn(async ({ role }) => ({
        count: 0, visible: false, editable: false, name: null, type: null,
        autocomplete: null, required: false, value: null,
        formValid: role === "submit" ? false : null,
      })),
    });
    await expect(ensureControlledPortalRegistration({
      client: mock,
      email: "musician@example.test",
      password: "unused-ephemeral-password",
    })).resolves.toEqual({ outcome: "authenticated" });
    expect(mock.actInstruction).not.toHaveBeenCalled();
  });
});

describe("sendControlledPortalMessage", () => {
  it("fills exact values, claims once, clicks once, and verifies the receipt", async () => {
    const body = "Hello from the controlled test";
    const beforeSubmit = vi.fn(async () => undefined);
    let receiptReads = 0;
    const wait = vi.fn(async () => undefined);
    const mock = client({
      wait,
      readEvidence: async ({ kind }) => {
        if (kind === "access") return { kind, authenticated: true };
        if (kind === "composer") return { kind, body };
        if (kind === "receipt") {
          receiptReads += 1;
          return receiptReads === 1
            ? { kind, visible: false }
            : { kind, visible: true, providerThreadId: "thread_1", providerMessageId: "message_1" };
        }
        if (kind === "thread") return {
          kind,
          thread: {
            providerThreadId: "thread_1",
            participants: ["band", "owner"],
            lastMessageAt: 1,
            messages: [{
              providerMessageId: "message_1", direction: "outbound", bodyText: body, sentAt: 1,
            }],
          },
        };
        if (kind === "inbox") return { kind, providerThreadIds: [] };
        return {
          kind: "registration", terms: { kind: "absent" }, captcha: { kind: "absent" },
          paymentOrContractDetected: false, termsGateVisible: false,
        };
      },
    });
    await expect(sendControlledPortalMessage({
      client: mock,
      baseUrl: "https://roomscout.dev",
      adapterKey: "roomscout-dev-v1",
      targetPath: "/listings/listing_1",
      senderLabel: "test-band",
      body,
      beforeSubmit,
    })).resolves.toEqual({
      outcome: "succeeded", submitted: true,
      providerThreadId: "thread_1", providerMessageId: "message_1",
    });
    expect(beforeSubmit).toHaveBeenCalledOnce();
    expect(mock.actInstruction).toHaveBeenCalledTimes(2);
    expect(mock.clickSelector).toHaveBeenLastCalledWith({
      selector: '[data-roomscout-write="send"]',
    });
    expect(wait).toHaveBeenCalledWith(1_000);
  });
});

function evidenceSequence(...values: PortalDomEvidence[]): StagehandPortalPrimitives["readEvidence"] {
  let index = 0;
  return async () => values[index++] ?? { kind: "registration", terms: { kind: "unknown" }, captcha: { kind: "unknown" }, paymentOrContractDetected: false, termsGateVisible: false };
}

function client(overrides: Partial<StagehandPortalPrimitives> = {}): StagehandPortalPrimitives {
  const values = new Map<string, string>();
  const authenticatedExtract: StagehandPortalPrimitives["extract"] = async ({ schema }) =>
    schema.parse({ authenticated: true, stage: "authenticated", blocker: null });
  const base: StagehandPortalPrimitives = {
    navigate: vi.fn(async () => undefined),
    getUrl: vi.fn(async () => "https://roomscout.dev/inbox"),
    observe: vi.fn(async ({ instruction }) => {
      const placeholder = instruction.match(/%[A-Za-z]+%/)?.[0];
      const selector = placeholder === "%email%" ? "xpath=/email"
        : placeholder === "%password%" ? "xpath=/password"
        : placeholder === "%verificationCode%" ? "xpath=/code"
        : placeholder === "%senderLabel%" ? "xpath=/sender"
        : placeholder === "%body%" ? "xpath=/body"
        : "xpath=/one";
      return [{ description: "one", selector, method: placeholder ? "fill" : "click", ...(placeholder ? { arguments: [placeholder] } : {}) }];
    }),
    act: vi.fn(async ({ action, options }) => {
      const value = options?.variables && Object.values(options.variables)[0];
      if (value !== undefined) values.set(action.selector, value);
    }),
    actInstruction: vi.fn(async ({ instruction, variables }) => {
      const value = variables && Object.values(variables)[0];
      if (value === undefined) return;
      const selector = instruction.includes("email address") ? 'input[name="emailAddress"]'
        : instruction.includes("password input") ? 'input[name="password"]'
        : instruction.includes("sender label") ? '[data-roomscout-write="sender-label"]'
        : instruction.includes("message textarea") ? '[data-roomscout-write="body"]'
        : 'input[autocomplete="one-time-code"],input[name="code"]';
      values.set(selector, value);
    }),
    clickSelector: vi.fn(async () => undefined),
    fillSelector: vi.fn(async ({ selector, value }) => {
      values.set(selector, value);
    }),
    extract: authenticatedExtract,
    readEvidence: async ({ kind }) => {
      if (kind === "access") return { kind, authenticated: true };
      if (kind === "registration") return { kind, terms: { kind: "absent" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: false };
      if (kind === "composer") return { kind, body: null };
      if (kind === "receipt") return { kind, visible: false };
      if (kind === "thread") return { kind, thread: null };
      return { kind, providerThreadIds: [] };
    },
    inspectForm: vi.fn(async ({ selector, role }) => ({
      count: 1,
      visible: true,
      editable: role !== "submit",
      name: role === "email" ? "emailAddress"
        : role === "password" ? "password"
        : role === "verification_code" ? "code"
        : role === "message_body" ? "messageBody"
        : role === "sender_label" ? "senderLabel"
        : null,
      type: role === "password" ? "password"
        : role === "email" ? "email"
        : role === "message_body" ? "textarea"
        : role === "submit" ? "submit"
        : "text",
      autocomplete: role === "verification_code" ? "one-time-code" : null,
      required: role !== "sender_label" && role !== "submit",
      value: values.get(selector) ?? "",
      formValid: role === "submit" ? true : null,
    })),
  };
  return {
    ...base,
    ...overrides,
  };
}

const scope = { baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", mode: "register" as const };

describe("ensurePortalAccess", () => {
  it("fails closed outside the exact reviewed origin and adapter", async () => {
    await expect(ensurePortalAccess({
      client: client(), baseUrl: "https://evil.example", adapterKey: "roomscout-dev-v1",
      mode: "register",
    })).rejects.toThrow("PORTAL_ADAPTER_NOT_REVIEWED");
  });

  it("passes OTP only as an exact action variable", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "verification", blocker: null })
      .mockResolvedValueOnce({ authenticated: true, stage: "authenticated", blocker: null });
    const mock = client({ extract });
    await expect(ensurePortalAccess({ ...scope, client: mock, verificationCode: "123456" }))
      .resolves.toEqual({ outcome: "authenticated" });
    expect(mock.act).toHaveBeenNthCalledWith(1, {
      action: { description: "one", selector: "xpath=/code", method: "fill", arguments: ["%verificationCode%"] },
      options: { variables: { verificationCode: "123456" } },
    });
    expect(vi.mocked(mock.observe).mock.calls[0]?.[0].instruction).not.toContain("123456");
    expect(vi.mocked(mock.observe).mock.calls[0]?.[0].options?.variables).toEqual({ verificationCode: "123456" });
    expect(mock.navigate).toHaveBeenCalledOnce();
    expect(vi.mocked(mock.act).mock.invocationCallOrder[0]!)
      .toBeLessThan(vi.mocked(mock.navigate).mock.invocationCallOrder[0]!);
  });

  it("rejects an observed email action when the DOM field has the wrong semantic role", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null });
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"),
      extract,
      inspectForm: vi.fn(async () => ({
        count: 1, visible: true, editable: true, name: "displayName", type: "text",
        autocomplete: null, required: true, value: "", formValid: null,
      })),
    });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "human_required", blocker: "policy_human_presence" });
    expect(mock.act).not.toHaveBeenCalled();
  });

  it("rejects a fill whose exact value cannot be read back from the same field", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null });
    const inspectForm = vi.fn()
      .mockResolvedValueOnce({
        count: 1, visible: true, editable: true, name: "emailAddress", type: "email",
        autocomplete: "email", required: true, value: "", formValid: null,
      })
      .mockResolvedValueOnce({
        count: 1, visible: true, editable: true, name: "emailAddress", type: "email",
        autocomplete: "email", required: true, value: "rewritten@example.test", formValid: null,
      });
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"), extract, inspectForm,
    });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "human_required", blocker: "policy_human_presence" });
    expect(mock.act).toHaveBeenCalledOnce();
  });

  it("rechecks both fields and refuses submit when the second fill overwrites the email", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null });
    let emailInspections = 0;
    const inspectForm: StagehandPortalPrimitives["inspectForm"] = vi.fn(async ({ role }) => {
      if (role === "email") {
        emailInspections += 1;
        return {
          count: 1, visible: true, editable: true, name: "emailAddress", type: "email",
          autocomplete: "email", required: true,
          value: emailInspections === 1 ? ""
            : emailInspections === 2 ? "musician@example.test"
            : "ephemeral",
          formValid: null,
        };
      }
      return {
        count: 1, visible: true, editable: true, name: "password", type: "password",
        autocomplete: "new-password", required: true, value: "ephemeral", formValid: null,
      };
    });
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"),
      extract,
      inspectForm,
      act: vi.fn(async () => undefined),
    });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "human_required", blocker: "policy_human_presence" });
    expect(mock.act).toHaveBeenCalledTimes(2);
    expect(vi.mocked(mock.act).mock.calls.every(([call]) => call.action.method === "fill")).toBe(true);
    expect(inspectForm).toHaveBeenCalledWith({ selector: "xpath=/email", role: "email" });
  });

  it("does not submit while the native form reports an untouched required field", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null });
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"), extract,
    });
    const originalInspectForm = mock.inspectForm;
    mock.inspectForm = vi.fn(async (input) => {
      const result = await originalInspectForm(input);
      return input.role === "submit" ? { ...result, formValid: false } : result;
    });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "human_required", blocker: "policy_human_presence" });
    expect(mock.act).toHaveBeenCalledTimes(2);
    expect(vi.mocked(mock.act).mock.calls.every(([call]) => call.action.method === "fill")).toBe(true);
  });

  it("refuses the fixed Clerk primary selector when it is not unique and visible", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null });
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"), extract,
    });
    const originalInspectForm = mock.inspectForm;
    mock.inspectForm = vi.fn(async (input) => {
      const result = await originalInspectForm(input);
      return input.role === "submit" ? { ...result, count: 2 } : result;
    });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "human_required", blocker: "policy_human_presence" });
    expect(mock.act).toHaveBeenCalledTimes(2);
    expect(vi.mocked(mock.act).mock.calls.every(([call]) => call.action.method === "fill")).toBe(true);
  });

  it("waits boundedly when OTP submission leaves the old verification DOM during hydration", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "verification", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "verification", blocker: null })
      .mockResolvedValueOnce({ authenticated: true, stage: "authenticated", blocker: null });
    const wait = vi.fn(async () => undefined);
    const mock = client({ extract, wait });
    await expect(ensurePortalAccess({ ...scope, client: mock, verificationCode: "123456" }))
      .resolves.toEqual({ outcome: "authenticated" });
    expect(wait).toHaveBeenCalledWith(500);
    expect(mock.act).toHaveBeenCalledTimes(2);
  });

  it("returns awaiting_code without acting", async () => {
    const awaitingCodeExtract: StagehandPortalPrimitives["extract"] = async ({ schema }) =>
      schema.parse({ authenticated: false, stage: "verification", blocker: null });
    const mock = client({
      extract: awaitingCodeExtract,
    });
    await expect(ensurePortalAccess({ ...scope, client: mock })).resolves.toEqual({ outcome: "awaiting_code" });
    expect(mock.act).not.toHaveBeenCalled();
  });

  it("routes a new-account run from inbox sign-in to the reviewed signup", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_in", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: "terms" })
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "verification", blocker: null });
    const urls = ["https://roomscout.dev/sign-in", "https://roomscout.dev/sign-up"];
    const mock = client({
      getUrl: vi.fn(async () => urls.shift() ?? "https://roomscout.dev/sign-up"),
      extract,
      readEvidence: evidenceSequence(
        { kind: "registration", terms: { kind: "present", path: "/demo-terms/v1", contentFingerprint: "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: true },
        { kind: "registration", terms: { kind: "present", path: "/demo-terms/v1", contentFingerprint: "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: true }),
    });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "awaiting_code" });
    expect(mock.navigate).toHaveBeenNthCalledWith(1, { url: "https://roomscout.dev/inbox" });
    expect(mock.navigate).toHaveBeenNthCalledWith(2, { url: "https://roomscout.dev/sign-up" });
  });

  it("waits boundedly for Browserbase native CAPTCHA solving", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "unknown", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "verification", blocker: null });
    const wait = vi.fn(async () => undefined);
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"), extract, wait,
      readEvidence: evidenceSequence(
        { kind: "registration", terms: { kind: "absent" }, captcha: { kind: "present_unsolved" }, paymentOrContractDetected: false, termsGateVisible: false },
        { kind: "registration", terms: { kind: "absent" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: false },
        { kind: "registration", terms: { kind: "absent" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: false }),
    });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral", displayName: "Musician",
    })).resolves.toEqual({ outcome: "awaiting_code" });
    expect(wait).toHaveBeenCalledWith(2_000);
    expect(wait).toHaveBeenCalledWith(250);
    expect(mock.act).toHaveBeenCalledTimes(3);
    expect(mock.act).toHaveBeenNthCalledWith(3, {
      action: {
        description: "Submit the reviewed Clerk authentication form",
        selector: 'xpath=//button[@data-localization-key="formButtonPrimary"]',
        method: "click",
        arguments: [],
      },
    });
    expect(vi.mocked(mock.observe).mock.calls.every(([call]) => !call.instruction.includes("musician@example.test"))).toBe(true);
    expect(vi.mocked(mock.observe).mock.calls.every(([call]) => !call.instruction.includes("ephemeral"))).toBe(true);
    expect(vi.mocked(mock.observe).mock.calls.every(([call]) => !call.instruction.includes("display-name"))).toBe(true);
  });

  it("stops on unreviewed registration terms", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null });
    const mock = client({ getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"), extract,
      readEvidence: evidenceSequence({ kind: "registration", terms: { kind: "present", path: "/terms", contentFingerprint: "v1:changed" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: true }) });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "human_required", blocker: "terms" });
    expect(mock.act).not.toHaveBeenCalled();
  });

  it("stops if reviewed terms change immediately before acceptance", async () => {
    const extract = vi.fn().mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: "terms" });
    const mock = client({ getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"), extract,
      readEvidence: evidenceSequence(
        { kind: "registration", terms: { kind: "present", path: "/demo-terms/v1", contentFingerprint: "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: true },
        { kind: "registration", terms: { kind: "present", path: "/demo-terms/v1", contentFingerprint: "v1:changed" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: true }) });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "human_required", blocker: "terms" });
    expect(mock.act).not.toHaveBeenCalled();
  });

  it("accepts only the pinned demo terms before opening Clerk signup", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "verification", blocker: null });
    const mock = client({ getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"), extract,
      readEvidence: evidenceSequence(
        { kind: "registration", terms: { kind: "present", path: "/demo-terms/v1", contentFingerprint: "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: true },
        { kind: "registration", terms: { kind: "present", path: "/demo-terms/v1", contentFingerprint: "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1" }, captcha: { kind: "absent" }, paymentOrContractDetected: false, termsGateVisible: true }) });
    await expect(ensurePortalAccess({
      ...scope, client: mock, email: "musician@example.test", password: "ephemeral",
    })).resolves.toEqual({ outcome: "awaiting_code" });
    expect(mock.act).toHaveBeenCalledTimes(5);
    expect(mock.act).toHaveBeenNthCalledWith(1, {
      action: { description: "one", selector: "xpath=/one", method: "click" },
    });
  });

  it("waits for the Clerk form after the reviewed terms gate transitions", async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "unknown", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "sign_up", blocker: null })
      .mockResolvedValueOnce({ authenticated: false, stage: "verification", blocker: null });
    const wait = vi.fn(async () => undefined);
    const reviewedTerms: PortalDomEvidence = {
      kind: "registration",
      terms: { kind: "present", path: "/demo-terms/v1", contentFingerprint: "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1" },
      captcha: { kind: "absent" },
      paymentOrContractDetected: false,
      termsGateVisible: true,
    };
    const mock = client({
      getUrl: vi.fn(async () => "https://roomscout.dev/sign-up"),
      extract,
      wait,
      readEvidence: evidenceSequence(reviewedTerms, reviewedTerms),
    });
    await expect(ensurePortalAccess({
      ...scope,
      client: mock,
      email: "musician@example.test",
      password: "ephemeral",
    })).resolves.toEqual({ outcome: "awaiting_code" });
    expect(wait).toHaveBeenCalledWith(500);
  });
});

describe("portal reads and writes", () => {
  const thread = {
    providerThreadId: "thread_1",
    subject: "Room",
    participants: ["Owner"],
    lastMessageAt: 42,
    messages: [{
      providerMessageId: "message_1", direction: "outbound", senderLabel: "You",
      bodyText: "Exact approved body", sentAt: 42,
    }],
  };

  it("parses a bounded reviewed thread", async () => {
    const readEvidence = evidenceSequence(
      { kind: "access", authenticated: true },
      { kind: "thread", thread },
    );
    await expect(readPortalThread({ ...scope, client: client({ readEvidence }), providerThreadId: "thread_1" }))
      .resolves.toEqual(thread);
  });

  it("does not invent missing thread timestamps or identifiers", async () => {
    const readEvidence = evidenceSequence(
      { kind: "access", authenticated: true },
      { kind: "thread", thread: { providerThreadId: "thread_1", participants: [], messages: [] } },
    );
    await expect(readPortalThread({ ...scope, client: client({ readEvidence }), providerThreadId: "thread_1" }))
      .resolves.toBeNull();
  });

  it("enumerates stable inbox IDs and reads each thread", async () => {
    const readEvidence = evidenceSequence(
      { kind: "access", authenticated: true },
      { kind: "inbox", providerThreadIds: ["thread_1", "thread_1", "../bad"] },
      { kind: "access", authenticated: true },
      { kind: "thread", thread });
    await expect(readPortalInbox({ ...scope, client: client({ readEvidence }) })).resolves.toEqual([thread]);
  });

  it("reads back, claims, submits once, and verifies the exact sent body", async () => {
    const readEvidence = evidenceSequence(
      { kind: "access", authenticated: true },
      { kind: "thread", thread: { ...thread, messages: [] } },
      { kind: "composer", body: "Exact approved body" },
      { kind: "receipt", visible: true, providerThreadId: "thread_1", providerMessageId: "message_1" },
      { kind: "access", authenticated: true },
      { kind: "thread", thread });
    const mock = client({ readEvidence });
    const beforeSubmit = vi.fn(async () => undefined);
    await expect(sendPortalMessage({
      ...scope, client: mock, providerThreadId: "thread_1",
      body: "Exact approved body", beforeSubmit,
    })).resolves.toEqual({
      outcome: "succeeded", submitted: true,
      providerThreadId: "thread_1", providerMessageId: "message_1",
    });
    expect(beforeSubmit).toHaveBeenCalledOnce();
    expect(mock.act).toHaveBeenCalledTimes(2); // exact fill, then one submit
    expect(mock.act).toHaveBeenNthCalledWith(1, {
      action: { description: "one", selector: "xpath=/body", method: "fill", arguments: ["%body%"] },
      options: { variables: { body: "Exact approved body" } },
    });
    expect(vi.mocked(mock.observe).mock.calls.every(([call]) => !call.instruction.includes("Exact approved body"))).toBe(true);
  });

  it("returns unknown after submit when the receipt cannot be verified", async () => {
    const readEvidence = evidenceSequence(
      { kind: "access", authenticated: true },
      { kind: "thread", thread: { ...thread, messages: [] } },
      { kind: "composer", body: "Body" },
      { kind: "receipt", visible: false });
    const mock = client({ readEvidence });
    await expect(sendPortalMessage({
      ...scope, client: mock, providerThreadId: "thread_1", body: "Body",
      beforeSubmit: async () => undefined,
    })).resolves.toEqual({ outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" });
    expect(mock.act).toHaveBeenCalledTimes(2);
  });

  it("refuses a fill action that does not preserve the exact placeholder", async () => {
    const beforeSubmit = vi.fn(async () => undefined);
    const mock = client({
      observe: vi.fn(async () => [{
        description: "fill body", selector: "xpath=/textarea", method: "fill", arguments: ["rewritten text"],
      }]),
      readEvidence: evidenceSequence(
        { kind: "access", authenticated: true },
        { kind: "thread", thread: { ...thread, messages: [] } },
      ),
    });
    await expect(sendPortalMessage({
      ...scope, client: mock, providerThreadId: "thread_1", body: "Exact approved body", beforeSubmit,
    })).resolves.toEqual({ outcome: "human_required", submitted: false, blocker: "policy_human_presence" });
    expect(mock.act).not.toHaveBeenCalled();
    expect(beforeSubmit).not.toHaveBeenCalled();
  });
});
