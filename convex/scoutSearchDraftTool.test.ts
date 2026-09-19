import { describe, expect, it, vi } from "vitest";
import { asSchema } from "ai";
import type { Id } from "./_generated/dataModel";
import { currentSearchAuthority } from "./lib/currentSearchTruth";
import {
  buildScoutTools,
  createMarkSearchBriefReadyTool,
  createSearchDraftTool,
  currentSearchTruth,
  materializeSearchDraftChanges,
  SEARCH_FACET_GUIDANCE,
  searchDraftInputSchema,
} from "./scout";

describe("Scout search equipment extraction contract", () => {
  it("keeps owned-gear storage distinct from provider-supplied equipment and ignores questions", () => {
    expect(SEARCH_FACET_GUIDANCE).toContain(
      "equipment.storage=true means the musician requires permission to leave their own gear onsite",
    );
    expect(SEARCH_FACET_GUIDANCE).toContain(
      "equipment.backline=true mean that the room or provider must supply that equipment",
    );
    expect(SEARCH_FACET_GUIDANCE).toContain(
      "'Can our drum kit stay there?' is a question and causes no update",
    );
    const tool = createSearchDraftTool({} as never, {
      ownerId: "owner" as Id<"users">,
      needId: "need" as Id<"savedNeeds">,
    });
    expect(tool.description).toContain(SEARCH_FACET_GUIDANCE);
    expect(tool.description).toContain("Never infer a radius from the place, an activation request, old chat, or a typical/default travel distance");
  });

  it("materializes only named changes and preserves lists and facets across early captures", async () => {
    // The former wide optional object admitted model-filled defaults alongside
    // one real fact. That shape is no longer a valid tool call.
    expect(searchDraftInputSchema.safeParse({
      locationQuery: "Berlin",
      maxBudgetEur: 0,
      radiusKm: 1,
      openToSharing: false,
      schedule: [],
      instruments: [],
    }).success).toBe(false);
    const jsonSchema = await asSchema(searchDraftInputSchema).jsonSchema;
    expect(jsonSchema.required).toEqual(["changes"]);
    expect(jsonSchema.properties).toHaveProperty("changes");
    expect(jsonSchema.properties).not.toHaveProperty("maxBudgetEur");

    const first = searchDraftInputSchema.parse({
      changes: [
        { field: "location", query: "Berlin", label: "Berlin" },
        { field: "genres", operation: "add", values: ["indie rock"] },
        { field: "facet", namespace: "band", key: "size", value: "4", confidence: 1 },
      ],
    });
    expect(materializeSearchDraftChanges(first.changes, {
      schedule: [],
      requirements: [],
      genres: undefined,
      instruments: undefined,
      facets: undefined,
    })).toEqual({
      locationQuery: "Berlin",
      locationLabel: "Berlin",
      genres: ["indie rock"],
      facets: [{ namespace: "band", key: "size", value: "4", confidence: 1 }],
    });

    const later = searchDraftInputSchema.parse({
      changes: [
        { field: "schedule", operation: "add", values: ["Tuesday evening"], removeConflictingRequirements: [] },
        { field: "facet", namespace: "equipment", key: "storage", value: "true", confidence: 1 },
      ],
    });
    expect(materializeSearchDraftChanges(later.changes, {
      schedule: [],
      requirements: ["Own heavy amplifiers may remain stored"],
      genres: ["indie rock"],
      instruments: ["drums", "guitar"],
      facets: [{ namespace: "band", key: "size", value: "4", confidence: 1 }],
    })).toEqual({
      schedule: ["Tuesday evening"],
      facets: [
        { namespace: "band", key: "size", value: "4", confidence: 1 },
        { namespace: "equipment", key: "storage", value: "true", confidence: 1 },
      ],
    });
  });

  it("reconciles corrected canonical facts and converges member roles to instruments", () => {
    const changes = searchDraftInputSchema.parse({
      changes: [
        {
          field: "maxBudgetEur",
          value: 280,
          removeConflictingRequirements: ["€300/month budget including usual bills"],
        },
        {
          field: "requirements",
          operation: "add",
          values: ["Budget includes usual bills"],
        },
        {
          field: "instruments",
          operation: "add",
          values: ["drums", "guitar", "bass"],
        },
      ],
    });

    expect(materializeSearchDraftChanges(changes.changes, {
      schedule: ["Tuesday evening"],
      requirements: [
        "€300/month budget including usual bills",
        "Own drum kit may remain stored",
      ],
      genres: ["indie rock"],
      instruments: ["drummer", "guitarist", "bass player"],
      facets: [],
    })).toEqual({
      maxBudgetEur: 280,
      requirements: [
        "Own drum kit may remain stored",
        "Budget includes usual bills",
      ],
      instruments: ["drums", "guitar", "bass"],
    });
  });

  it("keeps the global search update tool available while advising on a focused candidate", () => {
    const tools = buildScoutTools({} as never, {
      ownerId: "owner" as Id<"users">,
      threadId: "thread",
      context: {
        mode: "signal_advisor",
        activeNeedId: "need" as Id<"savedNeeds">,
        focusedSignalId: "signal" as Id<"signals">,
        hasOpenDecision: true,
      },
    });
    expect(Object.keys(tools)).toEqual(expect.arrayContaining([
      "updateSearchDraft",
      "getCurrentSearch",
      "inspectCandidates",
      "openCandidate",
      "answerDecision",
    ]));
    expect(tools).not.toHaveProperty("markSearchBriefReady");
    expect(tools).not.toHaveProperty("continueAutopilot");
    expect(tools).not.toHaveProperty("createWebformDraft");
    expect(tools).not.toHaveProperty("replyToProvider");
    expect(tools.getCurrentSearch?.description).toContain("overrides earlier chat messages");
    expect(tools.inspectCandidates?.description).toContain("every persisted provider conversation");
    expect(tools.inspectCandidates?.description).toContain("regardless of the UI's focused room");
  });

  it("shares the claim-fenced readiness marker without activating the search", async () => {
    const runMutation = vi.fn().mockResolvedValue({
      readyForReview: true,
      needRevision: 4,
      readyAt: 2_000,
      missingFields: [],
    });
    const onReady = vi.fn();
    const voiceClaim = {
      voiceSessionId: "voice" as Id<"voiceSessions">,
      requestId: "capture",
      generation: 1,
    };
    const tool = createMarkSearchBriefReadyTool({ runMutation } as never, {
      ownerId: "owner" as Id<"users">,
      threadId: "thread",
      needId: "need" as Id<"savedNeeds">,
      voiceClaim,
      onReady,
    });
    if (!tool.execute) throw new Error("markSearchBriefReady is not executable");

    await expect(tool.execute.call({ ...tool, ctx: {} } as never, {}, {} as never))
      .resolves.toMatchObject({
        readyForReview: true,
        needRevision: 4,
        activationRequired: true,
      });
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), {
      ownerId: "owner",
      threadId: "thread",
      needId: "need",
      voiceClaim,
    });
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ needRevision: 4 }));
    expect(tool.description).toContain("useful enough to run");
    expect(tool.description).toContain("never activates the search");
  });

  it("reports a partial voice decision as open with its next question", async () => {
    const runMutation = vi.fn().mockResolvedValue({
      decisionId: "decision",
      status: "open",
      action: "awaiting_answers",
      nextQuestionId: "equipment",
      nextQuestion: "Would an electronic drum kit work?",
    });
    const onEffect = vi.fn();
    const tools = buildScoutTools({ runMutation } as never, {
      ownerId: "owner" as Id<"users">,
      threadId: "thread",
      context: { mode: "search_discovery", hasOpenDecision: true },
      voiceClaim: {
        voiceSessionId: "voice" as Id<"voiceSessions">,
        requestId: "answer-slot",
        generation: 1,
      },
      decisionId: "decision" as Id<"decisions">,
      onEffect,
    });
    const tool = tools.answerDecision;
    if (!tool?.execute) throw new Error("answerDecision is not executable");

    await expect(tool.execute.call({ ...tool, ctx: {} } as never, {
      decisionId: "decision",
      questionId: "schedule",
      choice: "yes",
    }, {} as never)).resolves.toMatchObject({
      status: "open",
      action: "awaiting_answers",
      nextQuestionId: "equipment",
      nextQuestion: "Would an electronic drum kit work?",
    });
    expect(onEffect).toHaveBeenCalledWith("decision", ["decision"], [
      "decision.status=open",
      "decision.action=awaiting_answers",
      "decision.nextQuestionId=equipment",
      'decision.nextQuestion="Would an electronic drum kit work?"',
    ]);
  });

  it.each(["search_discovery", "signal_advisor", "outreach_drafting"] as const)(
    "keeps endVoiceCall available in %s voice mode",
    (mode) => {
      const tools = buildScoutTools({} as never, {
        ownerId: "owner" as Id<"users">,
        threadId: "thread",
        context: {
          mode,
          activeNeedId: "need" as Id<"savedNeeds">,
          focusedSignalId: "signal" as Id<"signals">,
          hasOpenDecision: false,
        },
        voiceClaim: {
          voiceSessionId: "voice" as Id<"voiceSessions">,
          requestId: "request",
          generation: 1,
        },
        musicianInput: "Bye, see you later.",
      });
      expect(tools).toHaveProperty("endVoiceCall");
      expect(tools.endVoiceCall?.description).toContain("only asks the client to close voice");
    },
  );

  it("executes the voice end callback for semantic intent and vetoes a negative current turn", async () => {
    const onEndCall = vi.fn();
    const makeTools = (musicianInput: string) => buildScoutTools({} as never, {
      ownerId: "owner" as Id<"users">,
      threadId: "thread",
      context: {
        mode: "search_discovery",
        activeNeedId: "need" as Id<"savedNeeds">,
        hasOpenDecision: false,
      },
      voiceClaim: {
        voiceSessionId: "voice" as Id<"voiceSessions">,
        requestId: "request",
        generation: 1,
      },
      musicianInput,
      onEndCall,
    });
    const executeEnd = async (musicianInput: string, reason: "user_request" | "farewell") => {
      const tool = makeTools(musicianInput).endVoiceCall;
      if (!tool?.execute) throw new Error("endVoiceCall is not executable");
      return await tool.execute.call({ ...tool, ctx: {} } as never, { reason }, {} as never);
    };

    await expect(executeEnd("Mach's gut, wir hören uns.", "farewell"))
      .resolves.toEqual({ endCall: true, reason: "farewell" });
    expect(onEndCall).toHaveBeenCalledOnce();
    expect(onEndCall).toHaveBeenCalledWith("farewell");

    onEndCall.mockClear();
    await expect(executeEnd("Please do not end the call.", "user_request"))
      .resolves.toEqual({
        endCall: false,
        reason: "No direct call-ending intent in the current musician turn.",
      });
    expect(onEndCall).not.toHaveBeenCalled();
  });

  it("does not expose endVoiceCall outside a voice claim", () => {
    const tools = buildScoutTools({} as never, {
      ownerId: "owner" as Id<"users">,
      threadId: "thread",
      context: {
        mode: "search_discovery",
        activeNeedId: "need" as Id<"savedNeeds">,
        hasOpenDecision: false,
      },
      musicianInput: "Bye.",
    });
    expect(tools).not.toHaveProperty("endVoiceCall");
  });

  it("projects the latest canonical budget instead of a stale prior conversation value", () => {
    const truth = currentSearchTruth({
      title: "Saved rehearsal search",
      city: "Berlin",
      locationQuery: "Berlin",
      locationLabel: "Berlin",
      maxBudgetEur: 275,
      arrangement: ["shared"],
      schedule: ["Wednesday"],
      requirements: [],
      status: "active",
      matchingRevision: 9,
    });

    expect(truth).toMatchObject({
      authority: "latest_saved_search",
      revision: 9,
      maxBudgetEur: 275,
      schedule: ["Wednesday"],
    });
    expect(JSON.stringify(truth)).not.toContain("280");
    const authority = currentSearchAuthority({
      title: "Saved rehearsal search",
      city: "Berlin",
      maxBudgetEur: 275,
      arrangement: ["shared"],
      schedule: ["Wednesday"],
      requirements: [],
      status: "active",
      matchingRevision: 9,
    });
    expect(authority).toContain('"maxBudgetEur":275');
    expect(authority).toContain("override earlier thread messages");
    expect(authority).not.toContain("280");
  });
});
