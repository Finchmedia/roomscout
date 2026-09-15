import { describe, expect, it } from "vitest";
import { asSchema } from "ai";
import type { Id } from "./_generated/dataModel";
import {
  buildScoutTools,
  createSearchDraftTool,
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
      "continueAutopilot",
      "answerDecision",
    ]));
    expect(tools).not.toHaveProperty("markSearchBriefReady");
  });
});
