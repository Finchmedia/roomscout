/**
 * Copy layer — public surface. COMPONENT_MAP.md Part 6 / Part 7 step 5.
 *
 * `import { useCopy, LocaleProvider, LanguageToggle } from "@/ui/copy";`
 *
 * `de/dev.ts` (`devDe`, the prototype dev bar) is deliberately not re-exported:
 * DECISIONS.md item 20 keeps it out of the product dictionary. A dev-only surface
 * imports `@/ui/copy/de/dev` directly.
 */

export { de } from "./de";
export { en } from "./en";
export {
  DEFAULT_LOCALE,
  LocaleCtx,
  LocaleProvider,
  getAvailableLocales,
  getDictionary,
  isLocale,
  registerDictionary,
  type LocaleContextValue,
} from "./LocaleProvider";
export { LanguageToggle } from "./LanguageToggle";
export {
  formatCurrencyEUR,
  formatTime,
  get,
  interpolate,
  isPluralNode,
  pickPlural,
  plural,
} from "./format";
export { useCopy, type UseCopy } from "./useCopy";
export {
  COPY_VAR_NAMES,
  LOCALES,
  type CopyKey,
  type CopyVarName,
  type CopyVars,
  type DeepLeafPaths,
  type DeepWiden,
  type Dict,
  type Locale,
  type PluralCopyKey,
  type PluralLeaf,
  type PluralLeafPaths,
  type StringCopyKey,
  type StringLeafPaths,
} from "./types";
