export const DEMO_PROVENANCE_MIGRATION_NAME = "backfill_signal_demo_provenance_v1";

/** Demo provenance is derived from the exact evidence origin, never model output. */
export function isControlledDemoOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "roomscout.dev" && url.port === "";
  } catch {
    return false;
  }
}
