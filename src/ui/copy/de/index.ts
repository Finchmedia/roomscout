/**
 * German copy dictionary — the assembled root.
 *
 * COMPONENT_MAP.md §6.2 specifies one nested `de` object namespaced by surface
 * (`scout.*`, `settings.*`, `operator.*`, `landing.*`, `common.*`). The per-surface files in
 * this directory are the extraction units; this file is the single place where they are nested,
 * so the namespace guarantees of §6.1 are checked by the compiler instead of asserted in prose.
 *
 * `./dev.ts` (`demo.*`, SCOUT §18.18) and LANDING §17.12's `v1.*` are deliberately absent —
 * COMPONENT_MAP.md §6.1 rule 2 / DECISIONS.md item 20. Dev-only surfaces import `devDe` directly.
 */

import { commonDe } from "./common";
import { appRoutesDe } from "./appRoutes";
import { liveOperatorCopy } from "../../operator/live/copy";
import { liveSettingsCopy } from "../../settings/liveCopy";
import { landingDe } from "./landing";
import { operatorDe } from "./operator";
import { scoutDe } from "./scout";
import { settingsDe } from "./settings";
import { liveScoutDe } from "./liveScout";
import { liveInboxDe } from "./liveInbox";

/**
 * The paths the two hand-edits of §6.1 are supposed to produce, plus the hoist of rule 3.
 * Written as a `satisfies` contract so a wrong assembly key is a compile error here rather
 * than a wrong string at runtime.
 */
type NamespaceContract = {
  liveSettings: typeof liveSettingsCopy;
  liveOperator: typeof liveOperatorCopy;
  appRoutes: Record<string, string>;
  common: { saved: string; back: string; close: string };
  scout: { chrome: { menu: { backToScout: string } } };
  settings: { nav: { back: string } }; // §6.1 rule 1 — NOT settings.settings.nav.back
  operator: { nav: { back: string } }; // §6.1 rule 1 — NOT operator.operator.nav.back
  landing: { header: Record<string, unknown> };
  liveScout: Record<string, string>;
  liveInbox: typeof liveInboxDe;
};

export const de = {
  liveSettings: liveSettingsCopy,
  liveOperator: liveOperatorCopy,
  appRoutes: appRoutesDe,
  common: commonDe,
  scout: scoutDe,
  settings: settingsDe,
  operator: operatorDe,
  landing: landingDe,
  liveScout: liveScoutDe,
  liveInbox: liveInboxDe,
} as const satisfies NamespaceContract;

export type DeDict = typeof de;

/* ---- §6.1 negative guarantees: absence cannot be expressed by `satisfies`, so assert it. ---- */

type Assert<T extends true> = T;

/** Hand-edit 1: SETTINGS §17.1's own `settings.` prefix was stripped before nesting. */
export type SettingsSelfPrefixStripped = Assert<
  "settings" extends keyof typeof settingsDe ? false : true
>;

/** Hand-edit 1: OPERATOR §17.1–§17.2's own `operator.` prefix was stripped before nesting.
 *  (§17.12's quoted `settings.*` block is a different surface and correctly stays.) */
export type OperatorSelfPrefixStripped = Assert<
  "operator" extends keyof typeof operatorDe ? false : true
>;

/** Hand-edit 3: SETTINGS §17.12's `common.*` was hoisted to the root, not left under `settings`. */
export type CommonHoisted = Assert<"common" extends keyof typeof settingsDe ? false : true>;

/** §6.1 rule 2: the prototype dev bar is not part of the product dictionary. */
export type DemoExcluded = Assert<"demo" extends keyof typeof scoutDe ? false : true>;

/** §6.1 rule 2: LANDING §17.12's superseded v1 copy is not part of the product dictionary. */
export type LandingV1Excluded = Assert<"v1" extends keyof typeof landingDe ? false : true>;
