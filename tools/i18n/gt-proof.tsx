import { readFileSync } from "node:fs";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "../../src/ui/copy/en";
import { de } from "../../src/ui/copy/de";
import { LanguageToggle } from "../../src/ui/copy/LanguageToggle";
import { LocaleProvider, registerDictionary } from "../../src/ui/copy/LocaleProvider";
import { useCopy } from "../../src/ui/copy/useCopy";
import type { Dict } from "../../src/ui/copy/types";

// This dedicated test consumes the actual files prepared by test:gt. In API
// mode its German input is the downloaded GT result, never a fallback fixture.
const source = JSON.parse(readFileSync("artifacts/gt-compatibility/en/roomscout.json", "utf8"));
const translated = JSON.parse(readFileSync(
  process.env.ROOMSCOUT_GT_RESULT ?? "artifacts/gt-compatibility/existing-de.json", "utf8",
));

function install(base: Dict, data: typeof source): Dict {
  return {
    ...base,
    settings: { ...base.settings, nav: { ...base.settings.nav, item: { ...base.settings.nav.item, knowledge: data.knowledge } } },
    scout: {
      ...base.scout,
      welcome: { ...base.scout.welcome, greeting: data.greeting },
      brief: { ...base.scout.brief, sheet: { count: data.factCount } },
    },
  };
}

afterEach(() => {
  cleanup();
  registerDictionary("en", en);
  registerDictionary("de", de);
  vi.unstubAllGlobals();
});

it("loads exchanged EN/DE copy and keeps the conversation view mounted across language changes", () => {
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  registerDictionary("en", install(en, source));
  registerDictionary("de", install(de, translated));

  function ConversationProbe() {
    const { t, tp, locale } = useCopy();
    const [draft, setDraft] = useState("");
    return <>
      <LanguageToggle />
      <h1>{t("settings.nav.item.knowledge")}</h1>
      <p data-testid="greeting">{t("scout.welcome.greeting", { name: "Test Band" })}</p>
      <p data-testid="single">{tp("scout.brief.sheet.count", 1)}</p>
      <p data-testid="multiple">{tp("scout.brief.sheet.count", 3)}</p>
      <output aria-label="Active language">{locale}</output>
      <input aria-label="Conversation draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
    </>;
  }

  render(<LocaleProvider><ConversationProbe /></LocaleProvider>);
  expect(screen.getByRole("heading")).toHaveTextContent("What your Scout knows");
  expect(screen.getByTestId("greeting")).toHaveTextContent("Hey Test Band.");
  expect(screen.getByTestId("single")).toHaveTextContent("1 search fact");
  expect(screen.getByTestId("multiple")).toHaveTextContent("3 search facts");
  const draft = screen.getByRole("textbox", { name: "Conversation draft" });
  fireEvent.change(draft, { target: { value: "Keep our drum kit onsite" } });

  fireEvent.click(screen.getByRole("button", { name: "DE", exact: true }));
  expect(screen.getByLabelText("Active language")).toHaveTextContent("de");
  expect(screen.getByRole("heading")).not.toHaveTextContent("What your Scout knows");
  expect(screen.getByTestId("greeting")).toHaveTextContent("Test Band");
  expect(screen.getByTestId("greeting")).not.toHaveTextContent("{name}");
  expect(screen.getByTestId("single")).toHaveTextContent("1");
  expect(screen.getByTestId("multiple")).toHaveTextContent("3");
  expect(screen.getByTestId("multiple")).not.toHaveTextContent("{count}");
  expect(screen.getByRole("textbox", { name: "Conversation draft" })).toBe(draft);
  expect(draft).toHaveValue("Keep our drum kit onsite");
  expect(stored.get("roomscout.locale")).toBe("de");

  fireEvent.click(screen.getByRole("button", { name: "EN", exact: true }));
  expect(screen.getByRole("heading")).toHaveTextContent("What your Scout knows");
  expect(draft).toHaveValue("Keep our drum kit onsite");
});
