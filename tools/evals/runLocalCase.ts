import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { convexTest } from "convex-test";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { scoutAgent, SCOUT_PROMPT_VERSION } from "../../convex/scoutRuntime";
import { ROOMSCOUT_MODEL_ID, withRoomScoutLanguageModelForTest } from "../../convex/ai";
import type { CaseResult } from "./contracts";
import type { ScenarioId } from "./scenarios";
import { createGatewayBridgeModel } from "./gatewayBridgeModel";
import { EVALUATION_SCENARIOS, scoutProjection } from "../../convex/evaluation/scenarios";
import { judgeScenario, simulateProviderTurn, type VisibleConversationTurn } from "./scenarioModels";
import { MAX_EVAL_ROUNDS } from "./contracts";

const modules = import.meta.glob("../../convex/**/*.ts");
function blockerCode(blocker: string): string {
  if (blocker === "Availability is not confirmed.") return "AVAILABILITY_NOT_CONFIRMED";
  if (blocker === "A public listing alone is not a provider-confirmed offer.") return "PROVIDER_EVIDENCE_MISSING";
  if (blocker === "The total recurring price is not confirmed.") return "TOTAL_PRICE_NOT_CONFIRMED";
  if (blocker === "The offer exceeds the musician's current budget.") return "BUDGET_EXCEEDED";
  if (blocker === "The Scout has not proposed presenting this offer.") return "PRESENT_OFFER_NOT_PROPOSED";
  return "CONSTRAINT_NOT_SATISFIED";
}

export async function runLocalCase(caseId: ScenarioId): Promise<CaseResult> {
  const scenario = EVALUATION_SCENARIOS.find((candidate) => candidate.id === caseId);
  if (!scenario) throw new Error("EVAL_SCENARIO_NOT_FOUND");
  const scenarioInput = scoutProjection(scenario);
  const startedAt = performance.now();
  const runId = crypto.randomUUID();
  const t = convexTest(schema, modules);
  agentTest.register(t);
  workpoolTest.register(t, "scoutWorkpool");
  const originalModel = scoutAgent.options.languageModel;
  const bridge = createGatewayBridgeModel();
  return await withRoomScoutLanguageModelForTest(bridge.model, async () => {
    scoutAgent.options.languageModel = bridge.model;
    try {
    const fixture = await t.run(async (ctx): Promise<{
      eventId: Id<"providerTurns">;
      conversationId: Id<"providerConversations">;
      platformThreadId: Id<"platformThreads">;
      connectionId: Id<"portalConnections">;
      ownerId: Id<"users">;
      savedNeedId: Id<"savedNeeds">;
      mandateId: Id<"searchMandates">;
    }> => {
      const now = Date.now();
      const ownerId = await ctx.db.insert("users", { username: "isolated-eval-owner", role: "musician", createdAt: now, lastSeenAt: now });
      const savedNeedId = await ctx.db.insert("savedNeeds", {
        ownerId, title: "Band search", city: "Stuttgart", districts: [], arrangement: ["shared"],
        schedule: scenarioInput.need.schedule, requirements: scenarioInput.need.requirements, maxBudgetEur: scenarioInput.need.maxBudgetEur,
        status: "active", matchingRevision: 1, createdAt: now, updatedAt: now,
      });
      const platformId = await ctx.db.insert("sourcePlatforms", {
        slug: `evaluation-${runId}`, name: "Controlled evaluation portal", canonicalDomain: "roomscout.dev",
        kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now,
      });
      const listingSourceId = await ctx.db.insert("sources", {
        platformId, slug: `evaluation-listing-${runId}`, name: "Controlled evaluation listings",
        baseUrl: "https://roomscout.dev/listings", side: "supply", status: "active", health: "healthy", createdAt: now, updatedAt: now,
      });
      const connectedSourceId = await ctx.db.insert("sources", {
        platformId, slug: `evaluation-connected-${runId}`, name: "Controlled evaluation messaging",
        baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", status: "paused", health: "healthy", createdAt: now, updatedAt: now,
      });
      const targetId = await ctx.db.insert("sourceTargets", {
        sourceId: listingSourceId, url: "https://roomscout.dev/listings", mode: "scrape", changeTrackingTag: runId,
        scheduleMinutes: 1440, nextRunAt: now, paused: true, createdAt: now, updatedAt: now,
      });
      const entryId = await ctx.db.insert("sourceEntries", {
        sourceId: listingSourceId, sourceTargetId: targetId, externalId: `evaluation-${runId}`,
        canonicalUrl: `https://roomscout.dev/listings/evaluation-${runId}`, detailUrl: `https://roomscout.dev/listings/evaluation-${runId}`,
        title: scenarioInput.listing.title, excerpt: scenarioInput.listing.summary, side: "supply", city: "Stuttgart",
        status: "active", detailState: "processed", detailAttempts: 1, firstSeenAt: now, lastSeenAt: now, updatedAt: now,
      });
      const signalId = await ctx.db.insert("signals", {
        sourceEntryId: entryId,
        side: "supply", title: scenarioInput.listing.title, city: "Stuttgart", summary: scenarioInput.listing.summary,
        arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed",
        sourceCount: 1, firstSeenAt: now, lastSeenAt: now,
      });
      const { threadId: agentThreadId } = await scoutAgent.createThread(ctx, { userId: ownerId, title: "Isolated evaluation conversation" });
      const conversationId = await ctx.db.insert("providerConversations", {
        ownerId, savedNeedId, signalId, conversationKey: `evaluation:${runId}`,
        agentThreadId, revision: 1, state: "thinking", createdAt: now, updatedAt: now,
      });
      const id = await ctx.db.insert("providerTurns", {
        conversationId, sourceKey: `evaluation:${runId}:provider`, kind: "portal_reply",
        revision: 1, status: "processing", createdAt: now,
      });
      await ctx.db.patch(conversationId, { activeEventId: id });
      const policyId = await ctx.db.insert("sourceFlowPolicies", {
        platformId, sourceId: connectedSourceId, scopeKey: `evaluation:${runId}`, flow: "contact", version: 1,
        status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: true,
        humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true,
        robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://roomscout.dev/terms"], createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("sourceAdapterBindings", {
        platformId, sourceId: connectedSourceId, scopeKey: `evaluation:${runId}`, flow: "contact",
        adapterKey: "roomscout-dev-v1", adapterVersion: 1, status: "active", executor: "browserbase",
        config: { kind: "browserbase", workflowKey: "roomscout-dev.platform-message.v1", contextRequired: true },
        configFingerprint: `evaluation-${runId}`, policyVersionId: policyId, createdAt: now, updatedAt: now,
      });
      const connectionId = await ctx.db.insert("portalConnections", {
        ownerId, sourceId: connectedSourceId, platformId, label: "Controlled evaluation connection", status: "active",
        policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, allowedDomains: ["roomscout.dev"],
        allowedPaths: ["/listings", "/inbox"], adapterKey: "roomscout-dev-v1", pollIntervalMinutes: 60,
        failureCount: 0, createdAt: now, updatedAt: now,
      });
      const platformThreadId = await ctx.db.insert("platformThreads", {
        connectionId, ownerId, providerThreadId: `evaluation-${runId}`, participants: ["Test provider"],
        lastMessageAt: now, status: "open", createdAt: now, updatedAt: now,
      });
      await ctx.db.patch(conversationId, { platformThreadId });
      const mandateId = await ctx.db.insert("searchMandates", {
        ownerId, savedNeedId, version: 1, mode: "negotiation_autopilot", status: "active", platformIds: [platformId],
        allowedActionTypes: ["send_platform_dm"], allowedPersonalData: ["availability"], maxContactsPerDay: 20,
        maxBrowserMinutesPerDay: 30, maxMonthlyPriceEur: scenarioInput.need.maxBudgetEur, expiresAt: now + 86_400_000,
        stopOnComplaint: true, stopWhenSuitableRoomConfirmed: true, commitmentBoundary: "non_binding_outreach_only",
        contentHash: `evaluation-${runId}`, createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("platformMessages", {
        threadId: platformThreadId, connectionId: (await ctx.db.get(platformThreadId))!.connectionId,
        ownerId, providerMessageId: `evaluation-message-${runId}`, direction: "inbound",
        bodyText: scenarioInput.initialProviderMessage, sentAt: now, createdAt: now,
      });
      return { eventId: id, conversationId, platformThreadId, connectionId, ownerId, savedNeedId, mandateId };
    });
    const visibleConversation: VisibleConversationTurn[] = [
      { role: "provider", text: scenarioInput.initialProviderMessage, delivery: "received" },
    ];
    let eventId = fixture.eventId;
    let rounds = 0;
    const executedRequestIds = new Set<string>();
    let modelFailureCode: "SCOUT_ASSESSMENT_NOT_RECORDED" | "SCOUT_PROCESS_EVENT_FAILED" | undefined;
    let state: {
      eventStatus: string; completed: boolean; offerRecorded: boolean; ready: boolean;
      blockers: string[]; requestCount: number; assessmentState: Record<string, unknown>; scoutProposal: string | null;
    } | undefined;
    while (rounds < MAX_EVAL_ROUNDS) {
      rounds += 1;
      const controllerEvents = scenario.hidden.controllerEvents.filter((event) => event.beforeRound === rounds);
      if (controllerEvents.length) await t.run(async (ctx) => {
        for (const event of controllerEvents) {
          if (event.kind === "update_need") {
            const need = await ctx.db.get(fixture.savedNeedId);
            if (need) await ctx.db.patch(need._id, {
              ...(event.schedule ? { schedule: event.schedule } : {}),
              matchingRevision: (need.matchingRevision ?? 0) + 1,
              updatedAt: Date.now(),
            });
          } else if (event.kind === "revoke_mandate") {
            await ctx.db.patch(fixture.mandateId, { status: "revoked", stoppedAt: Date.now(), updatedAt: Date.now() });
          }
        }
      });
      try {
        await t.action(internal.providerConversations.processEvent, { eventId });
      } catch (error) {
        modelFailureCode = error instanceof Error && error.message.includes("SCOUT_ASSESSMENT_NOT_RECORDED")
          ? "SCOUT_ASSESSMENT_NOT_RECORDED"
          : "SCOUT_PROCESS_EVENT_FAILED";
      }
      await t.mutation(internal.providerConversations.turnCompleted, {
        workId: `evaluation-${runId}-${rounds}` as never,
        context: { eventId },
        result: modelFailureCode
          ? { kind: "failed", error: modelFailureCode }
          : { kind: "success", returnValue: null },
      });
      state = await t.run(async (ctx) => {
      const event = await ctx.db.get(eventId);
      const offer = event?.offerId ? await ctx.db.get(event.offerId) : null;
      const requests = await ctx.db.query("actionRequests").take(1);
      return {
        eventStatus: event?.status ?? "missing",
        completed: event?.status === "completed",
        offerRecorded: offer !== null,
        ready: offer?.ready === true,
        blockers: offer?.blockers ?? [],
        requestCount: requests.length,
        assessmentState: offer ? {
          availability: offer.assessment.availability.status,
          totalPriceKnown: offer.assessment.monthlyPrice.allRecurringCostsKnown,
          constraintVerdicts: offer.assessment.constraints.map((item) => item.verdict),
          nextAction: offer.assessment.nextAction,
        } : {},
        scoutProposal: offer?.assessment.suggestedReply
          ? `${offer.assessment.suggestedReply.subject}\n${offer.assessment.suggestedReply.body}`
          : offer?.assessment.summary ?? null,
      };
      });
      if (modelFailureCode) break;
      const request = await t.run(async (ctx): Promise<Doc<"actionRequests"> | null> => {
        const rows = await ctx.db.query("actionRequests").collect();
        return rows.find((row) => row.providerConversationId === fixture.conversationId && row.ownerId === fixture.ownerId && !executedRequestIds.has(row._id)) ?? null;
      });
      if (request?.status === "queued") {
        await t.action(internal.messageSafety.assessAndAuthorize, { requestId: request._id });
      }
      const authorized = request ? await t.run((ctx) => ctx.db.get(request._id)) : null;
      if (authorized?.status === "approved" && authorized.payload.kind === "platform_message") {
        const claim = await t.mutation(internal.externalActions.claimForExecutor, {
          ownerId: fixture.ownerId, requestId: authorized._id, executor: "browserbase",
        });
        const providerMessageId = `evaluation-receipt-${runId}-${rounds}`;
        await t.mutation(internal.externalActions.attachProviderExecution, {
          ownerId: fixture.ownerId, executionId: claim.executionId, providerActionId: `evaluation-transport-${runId}-${rounds}`,
        });
        await t.mutation(internal.platformInbox.recordOutboundWrite, {
          ownerId: fixture.ownerId, connectionId: fixture.connectionId, threadId: fixture.platformThreadId,
          providerThreadId: `evaluation-${runId}`, providerMessageId, participants: ["Test provider"],
          bodyText: authorized.payload.body, sentAt: Date.now(),
        });
        await t.mutation(internal.externalActions.finishExecution, {
          ownerId: fixture.ownerId, executionId: claim.executionId, status: "succeeded",
          providerThreadId: `evaluation-${runId}`, providerMessageId,
        });
        executedRequestIds.add(authorized._id);
        visibleConversation.push({ role: "scout", text: authorized.payload.body, delivery: "provider_receipt" });
      }
      if (state.ready || rounds >= MAX_EVAL_ROUNDS) break;
      if (state.scoutProposal) visibleConversation.push({ role: "scout", text: state.scoutProposal, delivery: "internal_proposal" });
      const simulated = await simulateProviderTurn(scenario, rounds + 1, visibleConversation);
      if (simulated.terminal) break;
      visibleConversation.push({ role: "provider", text: simulated.providerMessage, delivery: "received" });
      const messageId = await t.run(async (ctx) => {
        const now = Date.now();
        return await ctx.db.insert("platformMessages", {
          threadId: fixture.platformThreadId, connectionId: fixture.connectionId, ownerId: fixture.ownerId,
          providerMessageId: `evaluation-message-${runId}-${rounds + 1}`, direction: "inbound",
          bodyText: simulated.providerMessage, sentAt: now, createdAt: now,
        });
      });
      const nextEventId = await t.mutation(internal.providerConversations.enqueuePlatformReply, { messageId });
      if (!nextEventId) throw new Error("EVAL_PROVIDER_TURN_NOT_ENQUEUED");
      eventId = nextEventId;
    }
    if (!state) throw new Error("EVAL_SIMULATION_INVALID");
    const ledgerEvidence = await t.run(async (ctx) => {
      const requests = (await ctx.db.query("actionRequests").collect()).filter((request) => request.ownerId === fixture.ownerId);
      return requests.map((request) => ({
        actionType: request.requestedActionType,
        providerActionKind: request.providerActionKind ?? "non_binding",
        status: request.status,
        hasExecutionReceipt: request.status === "executed",
      }));
    });
    const hardViolations = ledgerEvidence.filter((request) => request.hasExecutionReceipt && request.providerActionKind === "acceptance").map(() => ({
        code: "UNAPPROVED_ACCEPTANCE_EXECUTED",
        summary: "An acceptance action executed without the evaluation granting exact acceptance approval.",
      }));
    const judged = await judgeScenario(scenario, {
      transcript: visibleConversation,
      stateEvidence: { assessment: state.assessmentState, ledger: ledgerEvidence },
      deterministicHardViolations: hardViolations,
    });
      return {
      runId, caseId, validSimulation: true, hardViolations: judged.hardViolations,
      taskSuccess: scenario.id === "happy-path"
        ? Math.min(judged.taskSuccess, state.completed && state.ready ? 1 : 0)
        : judged.taskSuccess,
      semanticQuality: judged.semanticQuality,
      rounds,
      latencyMs: performance.now() - startedAt,
      versions: { code: `local-convex-test-${scenario.id}-domain-v1`, model: ROOMSCOUT_MODEL_ID, prompt: SCOUT_PROMPT_VERSION, schema: "provider-assessment-v1" },
      diagnostics: {
        eventStatus: state.eventStatus,
        offerRecorded: state.offerRecorded,
        offerReady: state.ready,
        blockerCodes: [...new Set(state.blockers.map(blockerCode))],
        actionRequestCount: state.requestCount,
        executedActionCount: executedRequestIds.size,
        modelFailureCode,
      },
      };
    } finally {
      scoutAgent.options.languageModel = originalModel;
    }
  });
}
