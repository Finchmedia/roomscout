import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import type { ScoutFact } from "../../features/scout/viewModel";
import styles from "./ScoutBrief.module.css";

export function ScoutBrief({
  facts,
  title = "Your search brief",
  openInitially = false,
}: {
  facts: ScoutFact[];
  title?: string;
  openInitially?: boolean;
}) {
  const [open, setOpen] = useState(openInitially);
  return (
    <div className={styles.wrap}>
      <button
        aria-expanded={open}
        className={styles.toggle}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Search aria-hidden="true" size={17} />
        <span>{facts.length ? `${facts.length} search facts` : title}</span>
        <ChevronDown
          aria-hidden="true"
          className={open ? styles.chevronOpen : ""}
          size={15}
        />
      </button>
      {open ? (
        <section aria-label={title} className={styles.card}>
          <span className={styles.eyebrow}>{title}</span>
          {facts.length ? (
            <dl>
              {facts.map((fact) => (
                <div key={fact.key}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>Tell Scout what matters and your brief will form here.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
