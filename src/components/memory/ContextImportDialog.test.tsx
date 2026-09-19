import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageToggle, LocaleProvider } from "../../ui/copy";
import { ContextImportDialog } from "./ContextImportDialog";

const parseContext = vi.fn();
const importFacts = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => parseContext,
  useMutation: () => importFacts,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("ContextImportDialog", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    parseContext.mockReset();
    importFacts.mockReset();
    parseContext.mockResolvedValue({
      summary: "Stored band summary",
      facts: [{
        subject: "The Cooks", subjectKind: "band", predicate: "genre", value: "Alternative rock",
        category: "music", confidence: 0.9, sensitivity: "normal", relevance: "Useful for matching",
      }, {
        subject: "Mina", subjectKind: "person", predicate: "home_address", value: "Private location",
        category: "location", confidence: 0.8, sensitivity: "sensitive", relevance: "Travel context",
      }],
    });
    importFacts.mockResolvedValue({ imported: 1 });
  });

  it("renders both locales and imports only the reviewed selection with correct totals", async () => {
    const onOpenChange = vi.fn();
    const onImported = vi.fn();
    render(<LocaleProvider><LanguageToggle /><ContextImportDialog open onOpenChange={onOpenChange} onImported={onImported} /></LocaleProvider>);

    expect(screen.getByRole("heading", { name: "Import your music context" })).toBeVisible();
    cleanup();
    localStorage.setItem("roomscout.locale", "de");
    render(<LocaleProvider><ContextImportDialog open onOpenChange={onOpenChange} onImported={onImported} /></LocaleProvider>);
    expect(screen.getByRole("heading", { name: "Musik-Kontext importieren" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Externer Assistenz-Kontext"), { target: { value: "Ausführlicher bestehender Musik-Kontext für die Band." } });
    fireEvent.click(screen.getByRole("button", { name: "Zur Prüfung analysieren" }));

    expect(await screen.findByText("Stored band summary")).toBeVisible();
    expect(screen.getByText("Alternative rock")).toBeVisible();
    expect(screen.getByText("1 von 2 ausgewählt")).toBeVisible();
    expect(screen.getByText("Vorschläge: 2 · Entitäten: 2 · der Rohtext wird nicht gespeichert")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "1 Angabe übernehmen" }));
    await waitFor(() => expect(importFacts).toHaveBeenCalledOnce());
    expect(onImported).toHaveBeenCalledWith(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
