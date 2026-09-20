import * as React from "react";
import { Capsule } from "@/components/ui/capsule";
import { FactList } from "@/components/ui/fact-list";

/** Saved facts render immediately. Flights and highlights only decorate committed
 * query updates; they never hide a row or stand in for a successful save. */
export interface ArrivingFact {
  /** `FactList` row id — `ort` · `band` · `budget` · `zeit` · `equip` · … */
  id: string;
  /** The rendered value. */
  label: string;
}

export interface ArrivingFactListProps {
  facts: ArrivingFact[];
  title: string;
  variant?: "floating" | "card" | "compact";
  className?: string;
  /**
   * Where a capsule starts: the flight leaves this element's inner edge,
   * vertically centred. The default is the Scout chat, i.e. the column the
   * value was just spoken into. A missing element flies from the list itself.
   */
  originSelector?: string;
  /** Changing the search or UI language must not replay old facts. */
  animationKey?: string;
  children?: React.ReactNode;
}

/** Unhurried, decorative flights; every destination is already visible. */
const FLIGHT_MS = 900;
const HIGHLIGHT_MS = 1000;
/** One capsule at a time: the next fact leaves once the previous has landed. */
const STAGGER_MS = 950;
/** The glow outlives the last landing, so a row never goes dark mid-flight. */
const SETTLE_MS = 400;

type Flags = { changed?: boolean };

/** The chip in the air: what it says, and the point it leaves from. */
type Flight = ArrivingFact & { origin: { left: number; top: number } | null };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ArrivingFactList({
  facts,
  title,
  variant = "floating",
  className,
  originSelector = "[data-scout-conversation]",
  animationKey,
  children,
}: ArrivingFactListProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const capsuleRef = React.useRef<HTMLSpanElement>(null);
  const timers = React.useRef<number[]>([]);
  // What the last render committed, so an update only animates the difference.
  // Seeded on the first pass, so a reload does not replay the whole brief.
  const seen = React.useRef<Map<string, string> | null>(null);
  const seenKey = React.useRef(animationKey);
  const [flags, setFlags] = React.useState<Record<string, Flags>>({});
  const [flying, setFlying] = React.useState<Flight | null>(null);

  const schedule = React.useCallback((delay: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, delay));
  }, []);

  /**
   * Where a capsule starts. Measured when the flight begins — never during
   * render — so the coordinates belong to the layout the chip flies through.
   */
  const measureOrigin = React.useCallback((): Flight["origin"] => {
    if (typeof document === "undefined") return null;
    const source = document.querySelector(originSelector) ?? listRef.current;
    const box = source?.getBoundingClientRect();
    if (!box) return null;
    return { left: Math.round(box.right - 24), top: Math.round(box.top + box.height / 2) };
  }, [originSelector]);

  React.useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  React.useEffect(() => {
    const next = new Map(facts.map((fact) => [fact.id, fact.label]));
    const previous = seen.current;
    const reset = seenKey.current !== animationKey;
    seen.current = next;
    seenKey.current = animationKey;
    if (previous === null) return;
    if (!reset && next.size === previous.size && facts.every(fact => previous.get(fact.id) === fact.label)) return;

    // An incoming correction invalidates scheduled capsules as well as visible ones.
    // A stale Tuesday must never fly into a Wednesday row a second later.
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    setFlying(null);
    setFlags({});
    if (reset) return;

    const updated = facts.filter(fact => previous.get(fact.id) !== fact.label);
    setFlags(Object.fromEntries(updated.map(fact => [fact.id, { changed: true }])));
    // Keep a large extraction visually quiet; all other saved rows still highlight.
    const arriving = prefersReducedMotion() ? [] : facts.filter(fact => !previous.has(fact.id)).slice(0, 3);
    const lastLanding = arriving.length ? (arriving.length - 1) * STAGGER_MS + FLIGHT_MS + SETTLE_MS : 0;
    schedule(Math.max(HIGHLIGHT_MS, lastLanding), () => setFlags({}));

    arriving.forEach((fact, index) => {
      const start = index * STAGGER_MS;
      schedule(start, () => setFlying({ ...fact, origin: measureOrigin() }));
      schedule(start + FLIGHT_MS, () => setFlying(current => current?.id === fact.id ? null : current));
    });
  }, [facts, animationKey, measureOrigin, schedule]);

  // The flight itself — §4.3's keyframes, run on the live chip rather than on a
  // clone, because this capsule exists only for the flight.
  React.useLayoutEffect(() => {
    const node = capsuleRef.current;
    if (!flying || !node || typeof node.animate !== "function") return;
    // The ids are ours (`equip`, `facet:equipmentStorage`); a quoted attribute
    // value needs no escaping for them.
    const target = listRef.current?.querySelector(`[data-fact-row="${flying.id}"]`);
    const from = node.getBoundingClientRect();
    const to = target?.getBoundingClientRect();
    if (!to) return;
    const dx = to.left + 8 - from.left;
    const dy = (to.height ? to.top + (to.height - from.height) / 2 : to.top + 8) - from.top;
    const animation = node.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.5 - 46}px) scale(.96)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(.9)`, opacity: 0 },
      ],
      { duration: FLIGHT_MS, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" },
    );
    return () => animation.cancel?.();
  }, [flying]);

  const rows = facts.map((fact) => ({ ...fact, ...flags[fact.id] }));

  return (
    <>
      <FactList ref={listRef} facts={rows} variant={variant} title={title} className={className}>
        {children}
      </FactList>
      {flying ? (
        <Capsule
          key={flying.id}
          ref={capsuleRef}
          flight
          aria-hidden="true"
          className="pointer-events-none fixed z-20 m-0"
          style={flying.origin ?? { left: -9999, top: -9999 }}
        >
          {flying.label}
        </Capsule>
      ) : null}
    </>
  );
}
