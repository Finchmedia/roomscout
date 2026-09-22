export type Arrangement = "permanent" | "shared" | "hourly";

/**
 * Applies the meaning of "open to sharing" to a brief's arrangement list.
 *
 * A band saying it is open to sharing is widening what it will accept, never
 * restricting it: a room of their own still suits them. Matching treats the
 * arrangement list as a hard filter, so a list of exactly ["shared"] would
 * silently eliminate every permanent room - the opposite of what was said.
 *
 * This runs on the stored brief rather than in the prompt so the rule holds
 * on every extraction, instead of depending on how a conversation was phrased.
 */
export function widenArrangementForSharing(
  arrangement: readonly Arrangement[],
  openToSharing: boolean | undefined,
): Arrangement[] {
  const values = new Set<Arrangement>(arrangement);
  if (openToSharing === true) {
    values.add("shared");
    values.add("permanent");
  }
  return [...values];
}
