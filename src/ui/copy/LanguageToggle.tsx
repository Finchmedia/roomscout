/**
 * DE | EN toggle — COMPONENT_MAP.md §6.4 "Toggle locations".
 *
 * Rendered in the landing header (left of „Demo starten“) and in Settings → Profil. It
 * renders **nothing** while only one dictionary is registered, so the control cannot offer
 * a language the app has no copy for (§6.2 rule 1 — no silent German fallback).
 *
 * Labels: the two-letter forms are identical in both languages. They are the only strings
 * in the port that are not read through `useCopy()`, because there is no shipped key for
 * them yet — `common.language.toggleAria | shortDe | shortEn` are still PROPOSED in
 * REVIEW_COPY.md §7 (DECISIONS.md item 15) and therefore absent from `de/common.ts`. Move
 * this map onto those keys — and give the group an `aria-label` — once they are accepted.
 */

import { Button } from "@/components/ui/button";
import { useCopy } from "./useCopy";
import type { Locale } from "./types";

/** REVIEW_COPY.md §7: „DE“ / „EN“, two letters, uppercase, unchanged between languages. */
const SHORT_LABEL: Record<Locale, string> = { de: "DE", en: "EN" };

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, availableLocales } = useCopy();

  if (availableLocales.length < 2) return null;

  return (
    <div role="group" className={className}>
      {availableLocales.map((option) => (
        <Button
          key={option}
          type="button"
          variant="ghost"
          size="2xs"
          aria-pressed={option === locale}
          onClick={() => setLocale(option)}
          className={option === locale ? "text-rs-orange font-medium" : undefined}
        >
          {SHORT_LABEL[option]}
        </Button>
      ))}
    </div>
  );
}
