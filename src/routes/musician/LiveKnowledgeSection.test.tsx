import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { LanguageToggle, LocaleProvider } from "../../ui/copy";
import { combineKnowledgeFacts, displayText, LiveKnowledgeSection, type MemoryFact } from "./LiveKnowledgeSection";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const facts: MemoryFact[] = [
  { _id: "f1" as Id<"memoryFacts">, subject: "Band", predicate: "drum_kit_room_preference", value: "Mitnutzbares Schlagzeug ideal; alternativ darf unser eigenes dauerhaft im Raum bleiben", category: "equipment" as const, source: "conversation" as const, verification: "user_stated" as const },
  { _id: "f2" as Id<"memoryFacts">, subject: "Band", predicate: "preferred_rehearsal_schedule", value: "Dienstagabend bevorzugt, ansonsten flexibel", category: "schedule" as const, source: "conversation" as const, verification: "inferred" as const },
  { _id: "f3" as Id<"memoryFacts">, subject: "Band", predicate: "unmapped_custom_predicate", value: "Eine besondere Angabe", category: "other" as const, source: "user_edit" as const, verification: "user_confirmed" as const },
];

function setup() {
  const actions = { onImport: vi.fn(), onUpdate: vi.fn(), onConfirm: vi.fn(), onDelete: vi.fn(), onManage: vi.fn() };
  localStorage.setItem("roomscout.locale", "de");
  render(<LocaleProvider><LiveKnowledgeSection summary="Eine Band auf Raumsuche." facts={facts} events={[]} busy={false} {...actions} /></LocaleProvider>);
  return actions;
}

describe("LiveKnowledgeSection", () => {
  it("switches the live knowledge controls and event dates between English and German without translating stored content", () => {
    const actions = { onImport: vi.fn(), onUpdate: vi.fn(), onConfirm: vi.fn(), onDelete: vi.fn(), onManage: vi.fn() };
    localStorage.removeItem("roomscout.locale");
    render(<LocaleProvider><LanguageToggle /><LiveKnowledgeSection
      summary="Eine Band auf Raumsuche."
      need={{ _id: "need" as Id<"savedNeeds">, maxBudgetEur: 400, openToSharing: true, radiusKm: 20, arrangement: ["shared"], schedule: [], requirements: [] }}
      facts={[...facts, { ...facts[2]!, _id: "members" as Id<"memoryFacts">, predicate: "member_count", value: "4" }]}
      events={[{ _id: "event" as Id<"memoryEvents">, summary: "Budget korrigiert", occurredAt: new Date(2026, 8, 16).getTime() }]}
      busy={false}
      {...actions}
    /></LocaleProvider>);

    expect(screen.getByRole("heading", { name: "What I know about you" })).toBeVisible();
    expect(screen.getByText("Eine Band auf Raumsuche.")).toBeVisible();
    expect(screen.getByText("Up to €400 / month")).toBeVisible();
    expect(screen.getByText("Open to sharing a room · 4 people")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "View change history" }));
    expect(screen.getByText("9/16/2026")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Import context" }));
    expect(actions.onImport).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(screen.getByRole("heading", { name: "Was ich über euch weiß" })).toBeVisible();
    expect(screen.getByText("16.9.2026")).toBeVisible();
    expect(screen.getByText("Budget korrigiert")).toBeVisible();
  });

  it("derives current-search budget, currency, period and concise genres without a memory budget", () => {
    const combined = combineKnowledgeFacts({ _id: "need" as Id<"savedNeeds">, maxBudgetEur: 400, arrangement: ["shared"], schedule: [], requirements: [], genres: ["Rock"] }, facts);
    expect(combined.map((fact) => displayText(fact))).toEqual(expect.arrayContaining(["Bis 400 € / Monat", "Rock", "Raumteilung möglich"]));
    expect(combined.some((fact) => fact.value.includes("350"))).toBe(false);
  });

  it("deduplicates overlapping memory while retaining sharing qualifiers as accessible detail", () => {
    const duplicate: MemoryFact = { ...facts[2]!, _id: "f4" as Id<"memoryFacts">, predicate: "open_to_room_sharing", value: "Nur wenn Termine und Lautstärke passen" };
    const combined = combineKnowledgeFacts({ _id: "need" as Id<"savedNeeds">, openToSharing: true, arrangement: ["shared"], schedule: [], requirements: [] }, [duplicate]);
    expect(combined.filter((fact) => fact.predicate === "open_to_room_sharing")).toHaveLength(1);
    expect(combined[0]?.detail).toBe("Nur wenn Termine und Lautstärke passen");
  });

  it("keeps all actual location, radius, schedule and requirement values", () => {
    const combined = combineKnowledgeFacts({ _id: "need" as Id<"savedNeeds">, locationLabel: "Stuttgart", radiusKm: 20, arrangement: [], schedule: ["Dienstag flexibel", "1x wöchentlich"], requirements: ["Proben mit voller Lautstärke und PA müssen möglich sein"], genres: [] }, []);
    expect(combined.map((fact) => displayText(fact))).toEqual(expect.arrayContaining(["Stuttgart", "20 km Umkreis", "Dienstag flexibel · 1x wöchentlich", "Laute Proben mit PA erforderlich"]));
  });

  it("renders the faithful knowledge hierarchy and preserves unknown predicates", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Was ich über euch weiß" })).toBeVisible();
    expect(screen.getByText("Eine Band auf Raumsuche.")).toBeVisible();
    expect(screen.getByText("Unmapped custom predicate: Eine besondere Angabe")).toBeVisible();
    const tab = screen.getByRole("tab", { name: "Ausstattung" });
    fireEvent.mouseDown(tab, { button: 0, ctrlKey: false }); fireEvent.click(tab);
    expect(screen.getByText(/Mitnutzbares Schlagzeug ideal/)).toBeVisible();
  });

  it("only offers confirmation controls for inferred facts", () => {
    const actions = setup();
    const everyday = screen.getByRole("tab", { name: "Alltag & Wege" });
    fireEvent.mouseDown(everyday, { button: 0, ctrlKey: false }); fireEvent.click(everyday);
    expect(screen.getByRole("button", { name: "Stimmt" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Stimmt" }));
    expect(actions.onConfirm).toHaveBeenCalledWith("f2");
    const equipment = screen.getByRole("tab", { name: "Ausstattung" });
    fireEvent.mouseDown(equipment, { button: 0, ctrlKey: false }); fireEvent.click(equipment);
    expect(screen.queryByRole("button", { name: "Stimmt" })).not.toBeInTheDocument();
  });

  it("wires import and stored-information controls", () => {
    const actions = setup();
    fireEvent.click(screen.getByRole("button", { name: "Kontext importieren" }));
    fireEvent.click(screen.getByRole("button", { name: "Gespeicherte Informationen verwalten" }));
    expect(actions.onImport).toHaveBeenCalledOnce();
    expect(actions.onManage).toHaveBeenCalledOnce();
  });
});
