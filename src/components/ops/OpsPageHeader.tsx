import type { ReactNode } from "react";
import styles from "./OpsPageHeader.module.css";
import "./OpsWorkspace.css";

const descriptions: Record<string, string> = {
  "Operations overview":
    "Provider health, source coverage, and work that needs attention.",
  "Sources & portals":
    "Technical source and portal operations, independent of musician preferences.",
  "Signal review":
    "Inspect the live normalization pipeline and retry bounded failures.",
  "Outreach control":
    "Review external-action state without bypassing a musician’s approval boundary.",
  "Inbox routing":
    "Follow delivery and reply state across approved communication.",
  "Audit log":
    "A bounded, human-readable ledger of approvals and provider events.",
};

export function OpsPageHeader({
  meta,
  title,
}: {
  meta?: ReactNode;
  title: string;
}) {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>Internal operator workspace</div>
        <h1>{title}</h1>
        <p>
          {descriptions[title] ??
            "Live operational state from the protected RoomScout backend."}
        </p>
      </div>
      {meta ? <div className={styles.meta}>{meta}</div> : null}
    </header>
  );
}
