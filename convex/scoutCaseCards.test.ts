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

describe("search discovery case card", () => {
  it("forbids recapping the captured facts and asks for exactly one follow-up question", () => {
    const card = buildScoutCaseCard({ mode: "search_discovery", need: need("draft") });
    expect(card).toContain("NEVER RECAP THE FACTS");
    expect(card).toContain("Suchauftrag panel");
    expect(card).toContain("EXACTLY ONE focused follow-up question");
    expect(card).not.toContain("summarize for confirmation");
  });

  it("keeps the ready handoff locale-neutral while the search is a draft", () => {
    const card = buildScoutCaseCard({ mode: "search_discovery", need: need("draft") });
    expect(card).toContain("READY HANDOFF");
    expect(card).toContain("markSearchBriefReady");
    expect(card).toContain("start the search in the app");
    expect(card).toContain("do not quote a UI button label");
    expect(card).not.toContain("Scout losschicken");
  });

  it("tells the Scout the search is already live and never to ask for the activation click", () => {
    for (const status of ["active", "paused"] as const) {
      const card = buildScoutCaseCard({ mode: "search_discovery", need: need(status) });
      expect(card).toContain(`SEARCH ALREADY LIVE: the attached search is ${status}, not a draft.`);
      expect(card).toContain("never ask them to start it again");
      expect(card).not.toContain("Scout losschicken");
      expect(card).not.toContain("READY HANDOFF");
    }
  });

  it("asks only about genuine gaps and separates saved requirements from room capabilities", () => {
    const card = buildScoutCaseCard({ mode: "search_discovery", need: need("draft") });
    expect(card).toContain("QUESTION GATE");
    expect(card).toContain("arrangements=shared already answers whether they are open to sharing");
    expect(card).toContain("Wanting to leave gear is a storage requirement; it does not create a separate security question");
    expect(card).toContain("REQUIREMENT IS NOT CAPABILITY");
    expect(card).toContain("only from verified focused-room or provider evidence");
    expect(card).toContain("If it is only asked about and not saved");
    expect(card).toContain("NEVER RECAP THE FACTS");
  });

  it("falls back to the draft handoff when no search is attached", () => {
    const card = buildScoutCaseCard({ mode: "search_discovery", need: null });
    expect(card).toContain("READY HANDOFF");
    expect(card).toContain("No active structured search is attached.");
  });
});

describe("shared Scout instructions", () => {
  it("does not turn user questions into facts or saved needs into room promises", () => {
    expect(scoutBaseInstructions).toContain("requesting information, not stating a preference or fact");
    expect(scoutBaseInstructions).toContain("Do not store or infer a requirement from a question alone");
    expect(scoutBaseInstructions).toContain("only verified signal or provider evidence establishes a room capability");
  });
});
