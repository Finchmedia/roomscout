export type MatchNeed = {
  city: string;
  districts: string[];
  maxBudgetEur?: number;
  arrangement: Array<"permanent" | "shared" | "hourly">;
  requirements: string[];
  openToSharing?: boolean;
  collaborationOpen?: boolean;
  genres?: string[];
  instruments?: string[];
  radiusKm?: number;
  centerLatitude?: number;
  centerLongitude?: number;
};

export type MatchSignal = {
  side: "supply" | "demand";
  city: string;
  district?: string;
  title: string;
  summary: string;
  arrangement: "permanent" | "shared" | "hourly" | "unknown";
  priceEur?: number;
  requirements: string[];
  genres?: string[];
  instruments?: string[];
  facets?: Array<{
    namespace: string;
    key: string;
    value: string | number | boolean | string[];
    confidence: number;
  }>;
  latitude?: number;
  longitude?: number;
};

export type MatchScore = {
  eligible: boolean;
  kind: "need_supply" | "demand_demand";
  score: number;
  structuredScore: number;
  semanticScore: number;
  reasons: string[];
  uncertainties: string[];
};

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

function tokens(values: string[]): Set<string> {
  return new Set(
    values
      .flatMap((value) => normalized(value).split(/[^\p{L}\p{N}]+/u))
      .filter((value) => value.length > 2),
  );
}

function overlap(left: string[], right: string[]): number {
  const leftTokens = tokens(left);
  if (leftTokens.size === 0) return 1;
  const rightTokens = tokens(right);
  let hits = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) hits += 1;
  return hits / leftTokens.size;
}

function sharingExplicit(signal: MatchSignal): boolean {
  const facet = signal.facets?.some(
    (item) =>
      item.namespace === "collaboration" &&
      ["open_to_sharing", "open_to_collaboration"].includes(item.key) &&
      item.value === true &&
      item.confidence >= 0.6,
  );
  if (facet) return true;
  return /\b(open to shar(?:e|ing)|raum teilen|mitnutz(?:en|ung)|shared room)\b/i.test(
    `${signal.title} ${signal.summary}`,
  );
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function scoreSignalMatch(
  need: MatchNeed,
  signal: MatchSignal,
  semanticSimilarity = 0,
): MatchScore {
  const kind = signal.side === "supply" ? "need_supply" : "demand_demand";
  const empty: MatchScore = {
    eligible: false,
    kind,
    score: 0,
    structuredScore: 0,
    semanticScore: clamp(semanticSimilarity),
    reasons: [],
    uncertainties: [],
  };
  if (normalized(need.city) !== normalized(signal.city)) return empty;
  if (
    need.radiusKm !== undefined &&
    need.centerLatitude !== undefined &&
    need.centerLongitude !== undefined &&
    signal.latitude !== undefined &&
    signal.longitude !== undefined &&
    distanceKm(need.centerLatitude, need.centerLongitude, signal.latitude, signal.longitude) > need.radiusKm
  ) return empty;
  if (
    signal.arrangement !== "unknown" &&
    need.arrangement.length > 0 &&
    !need.arrangement.includes(signal.arrangement)
  ) {
    return empty;
  }
  if (
    signal.side === "demand" &&
    (!(need.openToSharing || need.collaborationOpen) || !sharingExplicit(signal))
  ) {
    return empty;
  }

  const reasons = [sameCityReason(need.city)];
  const uncertainties: string[] = [];
  if (need.radiusKm !== undefined && (signal.latitude === undefined || signal.longitude === undefined)) {
    uncertainties.push("Location is not precise enough to enforce the radius");
  }
  let points = 0.25;

  if (need.districts.length === 0) {
    points += 0.1;
  } else if (signal.district && need.districts.some((item) => normalized(item) === normalized(signal.district!))) {
    points += 0.1;
    reasons.push(`Preferred area: ${signal.district}`);
  } else if (!signal.district) {
    points += 0.05;
    uncertainties.push("District is not stated");
  }

  if (signal.arrangement === "unknown") {
    points += 0.075;
    uncertainties.push("Arrangement is not stated");
  } else {
    points += 0.15;
    reasons.push(`Compatible ${signal.arrangement} arrangement`);
  }

  if (need.maxBudgetEur === undefined) {
    points += 0.2;
  } else if (signal.priceEur === undefined) {
    points += 0.1;
    uncertainties.push("Price is not stated");
  } else if (signal.priceEur <= need.maxBudgetEur) {
    points += 0.2;
    reasons.push("Within the stated budget");
  } else {
    uncertainties.push("Price is above the stated budget");
  }

  const practicalOverlap = overlap(need.requirements, [
    signal.title,
    signal.summary,
    ...signal.requirements,
  ]);
  const musicOverlap = overlap(
    [...(need.genres ?? []), ...(need.instruments ?? [])],
    [...(signal.genres ?? []), ...(signal.instruments ?? []), signal.summary],
  );
  points += 0.2 * practicalOverlap + 0.1 * musicOverlap;
  if (practicalOverlap > 0.25) reasons.push("Practical requirements overlap");
  if (musicOverlap > 0.25) reasons.push("Musical context overlaps");
  if (kind === "demand_demand") reasons.push("Both searches explicitly allow sharing");

  const structuredScore = clamp(points);
  const semanticScore = clamp(semanticSimilarity);
  const score = 0.7 * structuredScore + 0.3 * semanticScore;
  const threshold = kind === "need_supply" ? 0.55 : 0.7;
  return {
    eligible: score >= threshold,
    kind,
    score,
    structuredScore,
    semanticScore,
    reasons,
    uncertainties,
  };
}

function sameCityReason(city: string): string {
  return `Same city: ${city}`;
}
