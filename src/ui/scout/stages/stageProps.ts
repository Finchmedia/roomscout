/** The one prop bag every stage takes: the demo machine plus the breakpoint. */

import type { ScoutDemoMachine } from "../state/useScoutDemoMachine";

export interface StageProps {
  readonly m: ScoutDemoMachine;
  /** ≤ 959 px (DECISIONS.md item 5). The phone frame is not ported. */
  readonly narrow: boolean;
}

/** The vertical rhythm every stage shares (App.jsx `<main>` + screen padding). */
export const STAGE_SHELL =
  "flex min-h-full flex-col items-center justify-center px-[var(--space-11)] pt-[var(--space-7)] pb-[var(--space-15)] text-center";
