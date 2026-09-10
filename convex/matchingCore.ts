import type { MatchAssessment } from "./lib/matchAssessment";

export type MatchNeed = {
  locationQuery?: string;
  locationLabel?: string;
  /** Legacy fallback used only until saved-need location migration completes. */
  city?: string;
  maxBudgetEur?: number;
  arrangement: Array<"permanent" | "shared" | "hourly">;
  requirements: string[];
  schedule?: string[];
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
  pricePeriod?: "hour" | "month" | "unknown";
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
  if (leftTokens.size === 0) return 0;
  const rightTokens = tokens(right);
  let hits = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) hits += 1;
  return hits / leftTokens.size;
}

function sharingExplicit(signal: MatchSignal, assessment?: MatchAssessment): boolean {
  if (assessment?.sharing.open !== undefined && assessment.sharing.open !== null) return assessment.sharing.open;
  const facet = signal.facets?.some(
    (item) =>
      item.namespace === "collaboration" &&
      ["open_to_sharing", "open_to_collaboration"].includes(item.key) &&
      item.value === true &&
      item.confidence >= 0.6,
  );
  return facet === true;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
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
  assessment?: MatchAssessment,
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
  const { radiusKm, centerLatitude, centerLongitude } = need;
  const hasRadiusSearch = radiusKm !== undefined && centerLatitude !== undefined && centerLongitude !== undefined;
  if (radiusKm !== undefined && !hasRadiusSearch) {
    return {
      ...empty,
      uncertainties: ["Search center is still being resolved; radius eligibility is not confirmed"],
    };
  }
  if (
    radiusKm !== undefined &&
    centerLatitude !== undefined &&
    centerLongitude !== undefined &&
    signal.latitude !== undefined &&
    signal.longitude !== undefined &&
    distanceKm(centerLatitude, centerLongitude, signal.latitude, signal.longitude) > radiusKm
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
    (!(need.openToSharing || need.collaborationOpen) || !sharingExplicit(signal, assessment))
  ) {
    return empty;
  }
  if (assessment) {
    const conflicts = assessment.requirements.filter((item) => item.verdict === "conflict").map((item) => item.explanation);
    if ((need.schedule?.length ?? 0) > 0 && assessment.schedule.verdict === "conflict") conflicts.push(assessment.schedule.explanation);
    if (signal.side === "supply" && need.maxBudgetEur !== undefined && assessment.monthlyPrice.minimumEur !== null &&
      assessment.monthlyPrice.minimumEur > need.maxBudgetEur) conflicts.push("Monthly cost including stated extras exceeds the maximum budget");
    if (conflicts.length) return { ...empty, reasons: conflicts };
  }
  // Needs currently express a monthly budget. Never compare an hourly or
  // unspecified quote with that budget as if its units were interchangeable.
  if (signal.side === "supply" && need.maxBudgetEur !== undefined && signal.priceEur !== undefined &&
    signal.pricePeriod === "month" && signal.priceEur > need.maxBudgetEur) {
    return { ...empty, reasons: ["Monthly price exceeds the maximum budget"] };
  }

  const reasons: string[] = [];
  const uncertainties: string[] = [];
  if (hasRadiusSearch && signal.latitude !== undefined && signal.longitude !== undefined) {
    const distance = distanceKm(need.centerLatitude!, need.centerLongitude!, signal.latitude, signal.longitude);
    reasons.push(`Within ${need.radiusKm} km radius (${distance.toFixed(1)} km away)`);
  } else if (hasRadiusSearch) {
    uncertainties.push("Listing coordinates are unavailable; radius eligibility needs clarification");
  } else if (need.city && normalized(need.city) === normalized(signal.city)) {
    reasons.push(sameCityReason(need.city));
  } else {
    return empty;
  }
  const locationConfirmed = hasRadiusSearch && signal.latitude !== undefined && signal.longitude !== undefined ||
    !hasRadiusSearch && need.city !== undefined && normalized(need.city) === normalized(signal.city);
  let points = locationConfirmed ? 0.25 : 0.125;
  let possible = 0.25;

  possible += 0.15;
  if (signal.arrangement === "unknown") {
    points += 0.075;
    uncertainties.push("Arrangement is not stated");
  } else {
    points += 0.15;
    reasons.push(`Compatible ${signal.arrangement} arrangement`);
  }

  if (need.maxBudgetEur !== undefined) possible += 0.2;
  if (need.maxBudgetEur === undefined) {
    // No budget constraint contributes neither weight nor a fabricated match reason.
  } else if (signal.side === "supply" && assessment?.monthlyPrice.totalKnown && assessment.monthlyPrice.minimumEur !== null) {
    points += 0.2;
    reasons.push("Stated total monthly cost is within budget");
  } else if (signal.priceEur === undefined) {
    points += 0.1;
    uncertainties.push("Price is not stated");
  } else if (signal.pricePeriod !== "month" || signal.side === "demand") {
    points += 0.1;
    uncertainties.push("A comparable total monthly price has not been established");
  } else if (signal.priceEur <= need.maxBudgetEur) {
    points += 0.2;
    reasons.push("Stated base monthly price is within budget");
    uncertainties.push("Total recurring cost, including any extras, needs confirmation");
  } else {
    uncertainties.push("Price is above the stated budget");
  }

  // Free-form requirements need semantic interpretation; lexical overlap cannot
  // distinguish "drums permitted" from "no drums". Pending interpretation stays unknown.
  if (need.requirements.length > 0 || (need.schedule?.length ?? 0) > 0) {
    possible += 0.2;
    if (!assessment) {
      points += 0.1;
      uncertainties.push("Practical requirements and schedule need semantic verification");
    } else {
      const findings = [...assessment.requirements, ...((need.schedule?.length ?? 0) > 0 ? [assessment.schedule] : [])];
      points += 0.2 * findings.reduce((total, item) => total + (item.verdict === "satisfied" ? 1 : 0.5), 0) / findings.length;
      for (const item of findings) {
        if (item.verdict === "satisfied") reasons.push(item.explanation);
        else uncertainties.push(item.explanation);
      }
    }
  }
  const musicOverlap = overlap(
    [...(need.genres ?? []), ...(need.instruments ?? [])],
    [...(signal.genres ?? []), ...(signal.instruments ?? [])],
  );
  if ((need.genres?.length ?? 0) + (need.instruments?.length ?? 0) > 0) {
    possible += 0.1;
    points += 0.1 * musicOverlap;
  }
  if (musicOverlap > 0.25) reasons.push("Musical context overlaps");
  if (kind === "demand_demand") reasons.push("Both searches explicitly allow sharing");

  const structuredScore = clamp(points / possible);
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
