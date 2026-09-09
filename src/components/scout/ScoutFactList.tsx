import { useLayoutEffect, useRef } from "react";
import type { ScoutFact } from "../../features/scout/viewModel";
import styles from "./ScoutFactList.module.css";

/** Stable fact keys preserve the same row when a spoken preference is corrected. */
export function ScoutFactList({
  facts,
  expanded = false,
  heading = "Euer Suchauftrag",
}: {
  facts: ScoutFact[];
  expanded?: boolean;
  heading?: string;
}) {
  const root = useRef<HTMLDListElement>(null);
  const previous = useRef(new Map<string, { top: number; value: string }>());
  useLayoutEffect(() => {
    const next = new Map<string, { top: number; value: string }>();
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    root.current
      ?.querySelectorAll<HTMLElement>("[data-fact-key]")
      .forEach((row) => {
        const key = row.dataset.factKey!;
        const value = row.dataset.factValue ?? "";
        const top = row.getBoundingClientRect().top;
        const before = previous.current.get(key);
        next.set(key, { top, value });
        if (reduced || !row.animate) return;
        if (!before)
          row.animate(
            [
              {
                opacity: 0,
                transform: "translate(-65px, 14px) scale(.94)",
                filter: "blur(3px)",
              },
              { opacity: 1, transform: "none", filter: "blur(0)" },
            ],
            { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" },
          );
        else if (before.value !== value)
          row.animate(
            [
              { backgroundColor: "rgba(255,105,38,.26)" },
              { backgroundColor: "transparent" },
            ],
            { duration: 1100 },
          );
        else if (Math.abs(before.top - top) > 1)
          row.animate(
            [
              { transform: `translateY(${before.top - top}px)` },
              { transform: "none" },
            ],
            { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" },
          );
      });
    previous.current = next;
  }, [facts, expanded]);

  return (
    <section
      aria-label={heading}
      className={`${styles.card} ${expanded ? styles.expanded : ""}`}
    >
      <h2>{heading}</h2>
      <dl aria-live="polite" aria-relevant="additions text" ref={root}>
        {facts.map((fact) => (
          <div
            data-fact-key={fact.key}
            data-fact-value={fact.value}
            key={fact.key}
          >
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {!facts.length ? (
        <p>Was euch wichtig ist, sammelt sich hier – während wir sprechen.</p>
      ) : null}
    </section>
  );
}
