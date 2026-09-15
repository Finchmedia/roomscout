/**
 * DE | EN toggle — COMPONENT_MAP.md §6.4 "Toggle locations".
 *
 * Rendered in the landing header (left of „Demo starten“) and in Settings → Profil. It
 * renders **nothing** while only one dictionary is registered, so the control cannot offer
 * a language the app has no copy for (§6.2 rule 1 — no silent German fallback).
 *
 * The short labels and accessible group name live in the dictionary so the control has no
 * hidden source-language copy.
 */

import { Button } from "@/components/ui/button";
import { useCopy } from "./useCopy";
export function LanguageToggle({ className }: { className?: string }) {
  const { t, locale, setLocale, availableLocales } = useCopy();

  if (availableLocales.length < 2) return null;

  return (
    <div role="group" aria-label={t("common.language.toggleAria")} className={className}>
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
          {t(option === "de" ? "common.language.shortDe" : "common.language.shortEn")}
        </Button>
      ))}
    </div>
  );
}
