import { describe, expect, it } from "vitest";
import type { Doc } from "./_generated/dataModel";
import { buildScoutCaseCard, scoutBaseInstructions } from "./scoutCaseCards";

const need = (status: Doc<"savedNeeds">["status"]) => ({
  _id: "need" as Doc<"savedNeeds">["_id"], _creationTime: 0,
  ownerId: "owner" as Doc<"savedNeeds">["ownerId"],
  title: "Proberaum Stuttgart", city: "Stuttgart", districts: [], arrangement: ["shared"],
  schedule: ["Montagabend"], requirements: ["Schlagzeug"], maxBudgetEur: 250,
  status, createdAt: 0, updatedAt: 0,
}) as Doc<"savedNeeds">;

describe("prompt construction: search discovery case card", () => {
  it("keeps a draft concise, canonical and explicitly user-started", () => {
    const card = buildScoutCaseCard({ mode: "search_discovery", need: need("draft") });

    expect(card).toContain("NEVER RECAP THE FACTS");
    expect(card).toContain("QUESTION GATE");
    expect(card).toContain("CANONICAL SEARCH AUTHORITY");
    expect(card).toContain("call getCurrentSearch");
    expect(scoutBaseInstructions).toContain("always use inspectCandidates before answering");
    expect(card).toContain("markSearchBriefReady");
    expect(card).toContain("never start it merely because the brief is ready");
    expect(card).toContain("REQUIREMENT IS NOT CAPABILITY");
    expect(card).not.toContain("EXACTLY ONE focused follow-up question");
  });

  it.each(["active", "paused"] as const)("does not restart an already %s search", (status) => {
    const card = buildScoutCaseCard({ mode: "search_discovery", need: need(status) });

    expect(card).toContain(`SEARCH ALREADY LIVE: the attached search is ${status}, not a draft.`);
    expect(card).toContain("never ask them to start it again");
    expect(card).toContain("Explicit corrections to saved search fields still go through updateSearchDraft");
    expect(card).toContain("apply them only when the musician states the new value");
    expect(card).not.toContain("READY HANDOFF");
  });

  it("keeps the draft handoff available before a structured search exists", () => {
    const card = buildScoutCaseCard({ mode: "search_discovery", need: null });

    expect(card).toContain("READY HANDOFF");
    expect(card).toContain("No active structured search is attached.");
  });
});

describe("prompt construction: signal advisor case card", () => {
  it("applies an explicit musician correction on a live search but never a silent edit", () => {
    const card = buildScoutCaseCard({ mode: "signal_advisor", need: need("active") });

    expect(card).toContain("apply an explicit musician correction to a search field (for example a new budget) with updateSearchDraft");
    expect(card).toContain("modify the search without an explicit musician instruction");
    expect(card).not.toContain("modify the search silently");
  });
});

describe("prompt construction: shared Scout safety", () => {
  it("does not turn questions into facts or requirements into room promises", () => {
    expect(scoutBaseInstructions).toContain("Do not store or infer a requirement from a question alone");
    expect(scoutBaseInstructions).toContain("only verified signal or provider evidence establishes a room capability");
  });
});
