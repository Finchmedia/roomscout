import {
  getSavedNeedActivationReadiness,
  savedNeedLocationLabel,
  savedNeedLocationQuery,
  type SavedNeedActivationMissingField,
} from "./savedNeedLocation";

export type LiveDiscoveryMode =
  | "search_discovery"
  | "signal_advisor"
  | "outreach_drafting";

export type LiveDiscoveryPhase =
  | "no_search"
  | "discovery"
  | "search_active"
  | "search_paused"
  | "search_archived"
  | "candidate"
  | "outreach";

export type LiveDiscoveryFacetValue = string | number | boolean | string[];

export type LiveDiscoveryNeed = {
  _id: string;
  title: string;
  status: "draft" | "active" | "paused" | "archived";
  locationQuery?: string;
  locationLabel?: string;
  city?: string;
  radiusKm?: number;
  maxBudgetEur?: number;
  arrangement: string[];
  schedule: string[];
  requirements: string[];
  openToSharing?: boolean;
  genres?: string[];
  instruments?: string[];
  collaborationOpen?: boolean;
  facets?: Array<{
    namespace: string;
    key: string;
    value: LiveDiscoveryFacetValue;
    confidence: number;
  }>;
  matchingRevision?: number;
};

export type LiveDiscoveryBriefReadiness = {
  status: "collecting" | "ready" | "needs_edits";
  needRevision: number;
  missingFields?: SavedNeedActivationMissingField[];
};

export type LiveDiscoveryContext = {
  version: 1;
  mode: LiveDiscoveryMode;
  phase: LiveDiscoveryPhase;
  discovery: boolean;
  search: null | {
    id: string;
    title: string;
    status: LiveDiscoveryNeed["status"];
    location: {
      query: string | null;
      label: string | null;
      radiusKm: number | null;
    };
    maxBudgetEur: number | null;
    arrangement: string[];
    schedule: string[];
    requirements: string[];
    openToSharing: boolean | null;
    genres: string[];
    instruments: string[];
    collaborationOpen: boolean | null;
    facets: NonNullable<LiveDiscoveryNeed["facets"]>;
    activation: {
      canActivate: boolean;
      missingFields: SavedNeedActivationMissingField[];
    };
    brief: {
      status: LiveDiscoveryBriefReadiness["status"];
      readyForReview: boolean;
      needRevision: number;
    };
  };
};

function phaseFor(
  mode: LiveDiscoveryMode,
  status: LiveDiscoveryNeed["status"] | undefined,
): LiveDiscoveryPhase {
  if (mode === "outreach_drafting") return "outreach";
  if (mode === "signal_advisor") return "candidate";
  if (!status) return "no_search";
  if (status === "draft") return "discovery";
  if (status === "active") return "search_active";
  if (status === "paused") return "search_paused";
  return "search_archived";
}

/** Compact canonical context shared by the Live session prompt and the browser.
 * It contains current saved values only; conversation text never becomes truth here. */
export function buildLiveDiscoveryContext(input: {
  need?: LiveDiscoveryNeed | null;
  mode?: LiveDiscoveryMode;
  briefReadiness?: LiveDiscoveryBriefReadiness | null;
}): LiveDiscoveryContext {
  const mode = input.mode ?? "search_discovery";
  const need = input.need ?? null;
  const discovery = mode === "search_discovery" && need?.status === "draft";
  if (!need) {
    return {
      version: 1,
      mode,
      phase: phaseFor(mode, undefined),
      discovery,
      search: null,
    };
  }

  const activation = getSavedNeedActivationReadiness(need);
  const needRevision = need.matchingRevision ?? 0;
  const briefStatus = input.briefReadiness?.status ?? "collecting";
  const readyForReview = briefStatus === "ready" &&
    input.briefReadiness?.needRevision === needRevision &&
    activation.canActivate;
  const query = savedNeedLocationQuery(need);
  const label = savedNeedLocationLabel(need);

  return {
    version: 1,
    mode,
    phase: phaseFor(mode, need.status),
    discovery,
    search: {
      id: need._id,
      title: need.title,
      status: need.status,
      location: {
        query: query || null,
        label: label || null,
        radiusKm: need.radiusKm ?? null,
      },
      maxBudgetEur: need.maxBudgetEur ?? null,
      arrangement: need.arrangement,
      schedule: need.schedule,
      requirements: need.requirements,
      openToSharing: need.openToSharing ?? null,
      genres: need.genres ?? [],
      instruments: need.instruments ?? [],
      collaborationOpen: need.collaborationOpen ?? null,
      facets: need.facets ?? [],
      activation,
      brief: {
        status: briefStatus,
        readyForReview,
        needRevision,
      },
    },
  };
}
