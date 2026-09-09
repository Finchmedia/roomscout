import styles from "./ScoutBlob.module.css";

export function ScoutBlob({
  active = false,
  compact = false,
}: {
  active?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.blob}${active ? ` ${styles.active}` : ""}${compact ? ` ${styles.compact}` : ""}`}
    />
  );
}
