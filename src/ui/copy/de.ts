/**
 * German copy dictionary — the shipped root object.
 *
 * COMPONENT_MAP.md §6.2 names this file as the source of truth: one nested, `as const`
 * object namespaced by surface (`common.*`, `scout.*`, `settings.*`, `operator.*`,
 * `landing.*`). The per-surface files under `./de/` are the extraction units; the three
 * hand-edits of §6.1 (strip SETTINGS §17.1's own `settings.` prefix, strip OPERATOR
 * §17.1–§17.2's own `operator.` prefix, hoist SETTINGS §17.12's `common.*` to the root)
 * and the two exclusions (SCOUT §18.18 `demo.*`, LANDING §17.12 `v1.*` — DECISIONS.md
 * item 20) are already applied there and re-asserted by `./de/index.ts`.
 *
 * Dev-only demo copy lives in `./de/dev.ts` (`devDe`) and is deliberately not reachable
 * from here — importing it into a product surface is what DECISIONS.md item 20 forbids.
 */

import { commonDe } from "./de/common";
import { appRoutesDe } from "./de/appRoutes";
import { liveOperatorCopy } from "../operator/live/copy";
import { liveSettingsCopy } from "../settings/liveCopy";
import { liveScoutDe } from "./de/liveScout";
import type { DeDict } from "./de/index";
import { landingDe } from "./de/landing";
import { operatorDe } from "./de/operator";
import { scoutDe } from "./de/scout";
import { settingsDe } from "./de/settings";

export const de = {
  common: commonDe,
  appRoutes: appRoutesDe,
  liveOperator: liveOperatorCopy,
  liveSettings: liveSettingsCopy,
  liveScout: liveScoutDe,
  scout: scoutDe,
  settings: settingsDe,
  operator: operatorDe,
  landing: landingDe,
} as const;

/* ---------------------------------------------------------------------------
 * `./de/index.ts` assembles the same five surfaces and carries the §6.1
 * negative guarantees (`DemoExcluded`, `LandingV1Excluded`, the self-prefix
 * strips). Two assemblies could drift, so the drift is made a compile error
 * instead of a runtime surprise: the two object types must be mutually
 * assignable. Deleting a surface here, or adding one there, fails `tsc`.
 * ------------------------------------------------------------------------- */
type Assert<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

export type DeMatchesSurfaceIndex = Assert<Extends<typeof de, DeDict>> &
  Assert<Extends<DeDict, typeof de>>;
