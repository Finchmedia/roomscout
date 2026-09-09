/**
 * Scout surface — public entry points for the router (`/design/scout`).
 *
 * `DemoScoutPage` is the full-page demo host (surface + Demo-Steuerung strip);
 * `ScoutSurface` is the surface itself, for a host that supplies its own
 * machine — the real app swaps `useScoutDemoMachine` for backend state and
 * keeps every stage untouched.
 */

export { DemoScoutPage } from "./DemoScoutPage";
export { ScoutSurface, type ScoutSurfaceProps } from "./ScoutSurface";
export {
  useScoutDemoMachine,
  type ScoutDemoActions,
  type ScoutDemoMachine,
  type ScoutDemoState,
} from "./state/useScoutDemoMachine";
export { useNarrow } from "./state/useNarrow";
export type { ScoutStage, ScoutView } from "./state/stages";
