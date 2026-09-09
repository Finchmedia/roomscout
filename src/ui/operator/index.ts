/**
 * Operator surface — public entry points for the router (`/design/operator`).
 *
 * `DemoOperatorPage` is the full-page demo host; `OperatorPanel` is the surface
 * itself, for a host that already owns the stage and the header.
 */

export { DemoOperatorPage } from "./DemoOperatorPage"
export { OperatorPanel, type OperatorPanelProps } from "./OperatorPanel"
export {
  useOperatorDemoState,
  type OperatorDemo,
  type OperatorDemoActions,
  type OperatorDemoState,
  type OperatorPageId,
} from "./state/useOperatorDemoState"
