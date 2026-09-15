import * as React from "react";
import { Capsule } from "@/components/ui/capsule";
import { FactList } from "@/components/ui/fact-list";

/**
 * „Euer Suchauftrag“ while it is still being written — the fact list plus
 * SCOUT_SCREENS.md §4.3's arrival choreography, driven by live data instead of
 * by the prototype's script.
 *
 * The caller passes the facts it has; this component compares them with what
 * it rendered last and animates the difference:
 *
 *  · a **new** fact is pushed as §4.3's placeholder row (`arriving`, height 0,
 *    invisible), a `Capsule` carrying its value flies from the conversation to
 *    the row's box over ~580 ms, and 400 ms into that flight the row grows and
 *    lights up orange for ~1 s;
 *  · a **changed** value only flashes the orange highlight, no flight — the row
 *    is already on screen and only its text is corrected;
 *  · several new facts in one update fly one after another, 880 ms apart, so
 *    two capsules are never in the air at once.
 *
 * Both flags are cleared here, as `fact-list.tsx` requires of its caller: the
 * atom holds no timer.
 *
 * Reduced motion skips the flight and the growth (the row simply appears) and
 * keeps the highlight, which `tokens.css` renders as a static wash. A browser
 * without `Element.animate` (and jsdom) takes the same path, so nothing depends
 * on the animation having run.
 */
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
  children?: React.ReactNode;
}

/** §4.3: 580 ms flight, the row grows 400 ms in, the wash lasts ~1 s. */
const FLIGHT_MS = 580;
const COMMIT_MS = 400;
const HIGHLIGHT_MS = 1000;
/** One capsule at a time: the next fact leaves once the previous has landed. */
const STAGGER_MS = 880;

type Flags = { arriving?: boolean; changed?: boolean };

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
  originSelector = '[aria-label="Scout-Chat"]',
  children,
}: ArrivingFactListProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const capsuleRef = React.useRef<HTMLSpanElement>(null);
  const timers = React.useRef<number[]>([]);
  // What the last render committed, so an update only animates the difference.
  // Seeded on the first pass, so a reload does not replay the whole brief.
  const seen = React.useRef<Map<string, string> | null>(null);
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
    seen.current = next;
    if (previous === null) return;

    const added = facts.filter((fact) => !previous.has(fact.id));
    const changed = facts.filter(
      (fact) => previous.has(fact.id) && previous.get(fact.id) !== fact.label,
    );
    if (!added.length && !changed.length) return;

    const mark = (id: string, value: Flags) =>
      setFlags((current) => ({ ...current, [id]: { ...current[id], ...value } }));
    const clear = (id: string, key: keyof Flags) =>
      setFlags((current) => {
        const row = { ...current[id] };
        delete row[key];
        return { ...current, [id]: row };
      });

    for (const fact of changed) {
      mark(fact.id, { changed: true });
      schedule(HIGHLIGHT_MS, () => clear(fact.id, "changed"));
    }

    const reduced = prefersReducedMotion();
    if (reduced) {
      for (const fact of added) {
        mark(fact.id, { changed: true });
        schedule(HIGHLIGHT_MS, () => clear(fact.id, "changed"));
      }
      return;
    }
    added.forEach((fact, index) => {
      const start = index * STAGGER_MS;
      mark(fact.id, { arriving: true });
      schedule(start, () => setFlying({ ...fact, origin: measureOrigin() }));
      schedule(start + COMMIT_MS, () => {
        clear(fact.id, "arriving");
        mark(fact.id, { changed: true });
      });
      schedule(start + FLIGHT_MS, () => setFlying((current) => (current?.id === fact.id ? null : current)));
      schedule(start + COMMIT_MS + HIGHLIGHT_MS, () => clear(fact.id, "changed"));
    });
  }, [facts, measureOrigin, schedule]);

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
    node.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.5 - 46}px) scale(.96)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(.9)`, opacity: 0 },
      ],
      { duration: FLIGHT_MS, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" },
    );
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
