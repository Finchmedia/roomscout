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

/** The exact controlled portal is an AI-provider demo; its global banner is
 * authoritative, so individual room descriptions need no repeated label. */
export function providerSimulationFromEvidence(url: string, _evidence: string): "ai_simulated" | undefined {
  return isControlledDemoOrigin(url) ? "ai_simulated" : undefined;
}
