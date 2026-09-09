/**
 * The hint bar (App.jsx `hint`, SCOUT_SCREENS §2.8): one calm line, centred
 * over the bottom of the stage, ~4.2 s, never blocking anything.
 *
 * The machine owns the timer; this is the placement.
 */

import { Hint } from "@/components/ui/hint";

interface HintBarProps {
  hint: { readonly id: number; readonly text: string } | null;
}

export function HintBar({ hint }: HintBarProps) {
  if (!hint) return null;

  return (
    <div
      key={hint.id}
      className="pointer-events-none absolute bottom-[var(--space-10)] left-1/2 z-8 w-[min(560px,calc(100%-var(--space-16)))] -translate-x-1/2"
    >
      <Hint className="pointer-events-auto">{hint.text}</Hint>
    </div>
  );
}
