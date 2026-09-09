/**
 * `/design/scout` — the full-page demo host for the Scout surface.
 *
 * The surface plus the prototype's Demo-Steuerung strip (App.jsx's monospace
 * bar): chapter picker, restart, play/pause, next step, speed, the two panels
 * and „Beispielstörung laden“.
 *
 * Its copy comes from `@/ui/copy/de/dev` directly — COMPONENT_MAP §6.1 rule 2
 * keeps the prototype control-bar strings out of the product dictionary, so a
 * dev-only surface reads them from `devDe` rather than through `t()`.
 *
 * The phone frame („Mobil“) is deliberately absent: DECISIONS.md item 5 ports
 * the ≤ 959 px breakpoint instead, which the browser window already exercises.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { get } from "@/ui/copy";
import { devDe } from "@/ui/copy/de/dev";
import { ScoutSurface } from "./ScoutSurface";
import { CHAPTERS, DEMO_SPEEDS } from "./state/demoData";
import { SCOUT_STAGES, type ScoutStage } from "./state/stages";
import { useScoutDemoMachine, type ScoutDemoMachine } from "./state/useScoutDemoMachine";

/** Dotted lookup into `devDe`; the path is the key, so a hole is visible. */
function dev(path: string): string {
  const value = get(devDe, path);
  return typeof value === "string" ? value : path;
}

const CHIP =
  "h-[30px] rounded-chip bg-rs-surface-subtle-2 px-[var(--space-3)] font-mono text-[11.5px] text-rs-ink";

function ScoutDemoBar({ m }: { m: ScoutDemoMachine }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const { stage, view, paused, speed } = m.s;

  const selected = view === "scout" ? stage : view;
  const stageIndex = SCOUT_STAGES.indexOf(stage);
  const nextStage: ScoutStage | undefined = SCOUT_STAGES[stageIndex + 1];

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="2xs"
        className={cn(CHIP, "border border-rs-border-neutral bg-rs-surface-toast")}
        onClick={() => setCollapsed(false)}
      >
        {devDe.demo.collapsed}
      </Button>
    );
  }

  return (
    <div className="flex max-w-[calc(100vw-var(--space-14))] flex-wrap items-center gap-[var(--space-2)] rounded-control-lg border border-rs-border-neutral bg-rs-surface-toast px-[var(--space-5)] py-[var(--space-2)] font-mono text-[11.5px] text-rs-ink-6 backdrop-blur-[8px]">
      <span className="mr-[var(--space-2)]">{devDe.demo.label}</span>

      <select
        aria-label={devDe.demo.chapter.aria}
        value={selected}
        onChange={(event) => {
          const chapter = CHAPTERS.find((entry) => entry.id === event.target.value);
          if (!chapter) return;
          if (chapter.target.kind === "view") {
            if (chapter.target.view === "settings") m.openSettings();
            else m.openOperator();
            return;
          }
          m.backToScout();
          m.go(chapter.target.stage);
        }}
        className={cn(CHIP, "cursor-pointer border-0")}
      >
        {CHAPTERS.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {dev(chapter.labelPath)}
          </option>
        ))}
      </select>

      <Button
        variant="ghost"
        size="2xs"
        aria-label={devDe.demo.restart}
        title={devDe.demo.restart}
        className={CHIP}
        onClick={m.restart}
      >
        <Icon name="restart" size={14} />
      </Button>

      <Button
        variant="ghost"
        size="2xs"
        aria-label={paused ? devDe.demo.play : devDe.demo.pause}
        title={paused ? devDe.demo.play : devDe.demo.pause}
        aria-pressed={paused}
        className={CHIP}
        onClick={m.togglePaused}
      >
        <Icon name={paused ? "play" : "pause"} size={14} />
      </Button>

      <Button
        variant="ghost"
        size="2xs"
        className={CHIP}
        disabled={!nextStage}
        onClick={() => {
          if (nextStage) m.go(nextStage);
        }}
      >
        {devDe.demo.next}
      </Button>

      <span
        aria-hidden="true"
        className="mx-[2px] h-[18px] w-px bg-rs-border-neutral"
      />

      <div role="group" aria-label={devDe.demo.speed.aria} className="flex gap-[var(--space-1)]">
        {DEMO_SPEEDS.map((entry) => (
          <Button
            key={entry.id}
            variant="ghost"
            size="2xs"
            aria-pressed={speed === entry.id}
            className={cn(CHIP, speed === entry.id && "bg-rs-surface-accent-tint")}
            onClick={() => m.setSpeed(entry.id)}
          >
            {dev(entry.labelPath)}
          </Button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="2xs"
        aria-pressed={view === "settings"}
        className={cn(CHIP, view === "settings" && "bg-rs-surface-accent-tint")}
        onClick={() => m.openSettings()}
      >
        {devDe.demo.settings}
      </Button>
      <Button
        variant="ghost"
        size="2xs"
        aria-pressed={view === "operator"}
        className={cn(CHIP, view === "operator" && "bg-rs-surface-accent-tint")}
        onClick={() => m.openOperator()}
      >
        {devDe.demo.operator}
      </Button>
      <Button variant="ghost" size="2xs" className={CHIP} onClick={m.loadIncident}>
        {devDe.demo.incident}
      </Button>

      <Button
        variant="ghost"
        size="2xs"
        aria-label={devDe.demo.hide.aria}
        title={devDe.demo.hide.title}
        className={CHIP}
        onClick={() => setCollapsed(true)}
      >
        <Icon name="chevron-down" size={14} />
      </Button>
    </div>
  );
}

/** The `<Toaster />` is mounted once by `AppProviders`, not per page. */
export function DemoScoutPage() {
  const m = useScoutDemoMachine();

  return <ScoutSurface m={m} demoControls={<ScoutDemoBar m={m} />} />;
}
