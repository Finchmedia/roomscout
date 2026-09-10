"use node";

import { Browserbase } from "@browserbasehq/sdk";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { assertControlledProofDevelopment } from "./controlledPersonalInboxProof";
import {
  evaluateControlledRegistrationPolicy,
  type ControlledRegistrationEvidence,
} from "./integrations/controlledPortalPolicy";
import { envValue } from "./integrations/env";
import type { StagehandObservedAction } from "./integrations/stagehandPortalDriver";
import {
  createStagehandV4Session,
  type StagehandV4Session,
} from "./integrations/stagehandV4Runtime";

const ORIGIN = "https://roomscout.dev";
const EMAIL = "roomscout-smoke@example.invalid";
const SESSION_TIMEOUT_MS = 120_000;

export function selectPlaceholderAction(
  actions: StagehandObservedAction[],
  variable: string,
): StagehandObservedAction | null {
  const placeholder = `%${variable}%`;
  const matching = actions.filter(
    (action) =>
      action.selector.length > 0 &&
      action.method === "fill" &&
      action.arguments?.includes(placeholder),
  );
  return matching.length === 1 ? matching[0]! : null;
}

export function isReviewedVisibleTerms(
  evidence: ControlledRegistrationEvidence,
  visible: boolean,
): boolean {
  return (
    visible &&
    evidence.terms.kind === "present" &&
    evaluateControlledRegistrationPolicy(evidence).allowed
  );
}

export function termsTransitionDiagnostic(input: {
  evidence: ControlledRegistrationEvidence;
  termsGateVisible: boolean;
  formPresent: boolean;
}): string {
  const decision = evaluateControlledRegistrationPolicy(input.evidence);
  const reason = decision.allowed ? "allowed" : decision.reason;
  return `policy=${reason};terms=${input.evidence.terms.kind};gate=${input.termsGateVisible};form=${input.formPresent}`;
}

function stagehandConfig() {
  const apiKey = envValue("BROWSERBASE_API_KEY");
  const modelApiKey = envValue("OPENAI_API_KEY");
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY_MISSING");
  if (!modelApiKey) throw new Error("STAGEHAND_MODEL_API_KEY_MISSING");
  return {
    apiKey,
    modelApiKey,
    modelName: envValue("BROWSERBASE_MODEL") ?? "openai/gpt-4o",
  };
}

async function closeAndRelease(
  session: StagehandV4Session,
  apiKey: string,
): Promise<void> {
  let cleanupFailed = false;
  try {
    await session.close();
  } catch {
    cleanupFailed = true;
  }
  try {
    await new Browserbase({ apiKey }).sessions.update(session.sessionId, {
      status: "REQUEST_RELEASE",
    });
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed) throw new Error("STAGEHAND_FORM_SMOKE_CLEANUP_FAILED");
}

async function registrationState(session: StagehandV4Session) {
  const evidence = await session.primitives.readEvidence({ kind: "registration" });
  if (evidence.kind !== "registration") {
    throw new Error("STAGEHAND_FORM_SMOKE_EVIDENCE_INVALID");
  }
  const form = await session.primitives.inspectForm({
    selector:
      'input[type="email"],input[name="emailAddress"],input[autocomplete="email"]',
    role: "email",
  });
  return {
    evidence: {
      adapterKey: "roomscout-dev-v1",
      pageUrl: await session.primitives.getUrl(),
      terms: evidence.terms,
      captcha: evidence.captcha,
      paymentOrContractDetected: evidence.paymentOrContractDetected,
    } satisfies ControlledRegistrationEvidence,
    termsGateVisible: evidence.termsGateVisible,
    formPresent: form.count === 1 && form.visible,
    emailValue: form.value,
  };
}

/** Development-only v4 form proof. It accepts only reviewed demo terms and fills
 * one inert email value; it never submits sign-up, handles OTP, or sends a message. */
export const run = internalAction({
  args: { confirmation: v.literal("FORM_ONLY_STAGEHAND_SMOKE") },
  returns: v.object({
    observedPlaceholder: v.boolean(),
    filledExactly: v.boolean(),
    termsAccepted: v.boolean(),
  }),
  handler: async () => {
    assertControlledProofDevelopment({
      cloudUrl: envValue("CONVEX_CLOUD_URL"),
      siteUrl: envValue("CONVEX_SITE_URL"),
    });
    const config = stagehandConfig();
    const session = await createStagehandV4Session({
      ...config,
      url: `${ORIGIN}/sign-up`,
      timeoutMs: SESSION_TIMEOUT_MS,
      solveCaptchas: false,
      persistContext: false,
    });
    let result:
      | { observedPlaceholder: boolean; filledExactly: boolean; termsAccepted: boolean }
      | undefined;
    let operationError: unknown;
    try {
      const before = await registrationState(session);
      if (!isReviewedVisibleTerms(before.evidence, before.termsGateVisible)) {
        throw new Error("STAGEHAND_FORM_SMOKE_TERMS_NOT_REVIEWED");
      }

      const checkboxActions = await session.primitives.observe({
        instruction:
          "Find only the visible checkbox for accepting the RoomScout controlled demo terms.",
      });
      if (checkboxActions.length !== 1) {
        throw new Error("STAGEHAND_FORM_SMOKE_TERMS_ACTION_AMBIGUOUS");
      }
      await session.primitives.act({ action: checkboxActions[0]! });

      const continueActions = await session.primitives.observe({
        instruction:
          "Find only the visible continue button belonging to the RoomScout controlled demo terms gate.",
      });
      if (continueActions.length !== 1) {
        throw new Error("STAGEHAND_FORM_SMOKE_TERMS_ACTION_AMBIGUOUS");
      }
      await session.primitives.act({ action: continueActions[0]! });

      let afterTerms = await registrationState(session);
      for (
        let attempt = 0;
        attempt < 6 && (afterTerms.termsGateVisible || !afterTerms.formPresent);
        attempt += 1
      ) {
        await session.primitives.wait?.(500);
        afterTerms = await registrationState(session);
      }
      const afterPolicy = evaluateControlledRegistrationPolicy(afterTerms.evidence);
      const termsAccepted =
        afterPolicy.allowed &&
        !afterTerms.termsGateVisible &&
        afterTerms.evidence.terms.kind === "absent" &&
        afterTerms.formPresent;
      if (!termsAccepted) {
        throw new Error(
          `STAGEHAND_FORM_SMOKE_TERMS_NOT_ACCEPTED:${termsTransitionDiagnostic(afterTerms)}`,
        );
      }

      const emailActions = await session.primitives.observe({
        instruction:
          "Find only the visible sign-up email input and prepare to fill it with %email%. Do not submit.",
        options: { variables: { email: EMAIL } },
      });
      const emailAction = selectPlaceholderAction(emailActions, "email");
      if (!emailAction) throw new Error("STAGEHAND_FORM_SMOKE_EMAIL_ACTION_INVALID");

      // Stagehand v4 observe supplies the reviewed field selector; the exact value
      // is then entered deterministically through the v4 page locator.
      await session.page.locator(emailAction.selector).fill(EMAIL);
      const filledExactly = (await registrationState(session)).emailValue === EMAIL;
      result = { observedPlaceholder: true, filledExactly, termsAccepted };
    } catch (error) {
      operationError = error;
    }

    let cleanupError: unknown;
    try {
      await closeAndRelease(session, config.apiKey);
    } catch (error) {
      cleanupError = error;
    }
    if (operationError !== undefined) throw operationError;
    if (cleanupError !== undefined) throw cleanupError;
    if (!result) throw new Error("STAGEHAND_FORM_SMOKE_RESULT_MISSING");
    return result;
  },
});
