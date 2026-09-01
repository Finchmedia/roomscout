export type CorroborationSnapshot = {
  side: "supply" | "demand";
  title: string;
  city: string;
  district?: string;
  arrangement: "permanent" | "shared" | "hourly" | "unknown";
  priceEur?: number;
  pricePeriod?: "hour" | "month" | "unknown";
};

export type CorroborationDecision = {
  relation: "none" | "corroborated" | "conflicting";
  score: number;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "for", "in", "the", "to", "und", "der", "die", "das",
  "ein", "eine", "einen", "einer", "fuer", "für", "im", "in", "mit", "von",
  "proberaum", "proberaume", "proberäume", "raum", "rehearsal", "room",
]);

function normalized(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(
    normalized(value)
      .split(" ")
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

export function titleSimilarity(left: string, right: string): number {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return normalized(left) === normalized(right) ? 1 : 0;
  }
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

function hasStructuredConflict(
  left: CorroborationSnapshot,
  right: CorroborationSnapshot,
): boolean {
  if (
    left.district &&
    right.district &&
    normalized(left.district) !== normalized(right.district)
  ) return true;
  if (
    left.arrangement !== "unknown" &&
    right.arrangement !== "unknown" &&
    left.arrangement !== right.arrangement
  ) return true;
  if (
    left.priceEur !== undefined &&
    right.priceEur !== undefined &&
    left.pricePeriod !== undefined &&
    right.pricePeriod !== undefined &&
    left.pricePeriod !== "unknown" &&
    left.pricePeriod === right.pricePeriod
  ) {
    const denominator = Math.max(left.priceEur, right.priceEur, 1);
    if (Math.abs(left.priceEur - right.priceEur) / denominator > 0.2) return true;
  }
  return false;
}

/**
 * Conservative, deterministic cross-source linkage. It never treats a shared
 * city or generic "room available" wording as independent corroboration.
 */
export function compareForCorroboration(
  left: CorroborationSnapshot,
  right: CorroborationSnapshot,
): CorroborationDecision {
  if (left.side !== right.side || normalized(left.city) !== normalized(right.city)) {
    return { relation: "none", score: 0 };
  }
  const score = titleSimilarity(left.title, right.title);
  const conflict = hasStructuredConflict(left, right);
  if (conflict && score >= 0.82) return { relation: "conflicting", score };
  if (!conflict && score >= 0.72) return { relation: "corroborated", score };
  return { relation: "none", score };
}

export function verificationFromEvidence(
  evidence: ReadonlyArray<CorroborationSnapshot & { sourceId: unknown }>,
): { sourceCount: number; verification: "observed" | "verified" | "conflicting" } {
  const sourceCount = new Set(evidence.map((item) => String(item.sourceId))).size;
  let conflict = false;
  for (let left = 0; left < evidence.length; left += 1) {
    for (let right = left + 1; right < evidence.length; right += 1) {
      if (String(evidence[left]?.sourceId) === String(evidence[right]?.sourceId)) continue;
      if (compareForCorroboration(evidence[left]!, evidence[right]!).relation === "conflicting") {
        conflict = true;
      }
    }
  }
  return {
    sourceCount,
    verification: conflict ? "conflicting" : sourceCount >= 2 ? "verified" : "observed",
  };
}
