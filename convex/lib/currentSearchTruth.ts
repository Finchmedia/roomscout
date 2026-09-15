import type { Doc } from "../_generated/dataModel";
import { getSavedNeedActivationReadiness } from "./savedNeedLocation";

export type CurrentSearchTruthInput = Pick<Doc<"savedNeeds">,
  "title" | "locationQuery" | "locationLabel" | "maxBudgetEur" |
  "arrangement" | "schedule" | "requirements" | "openToSharing" | "radiusKm" |
  "genres" | "instruments" | "collaborationOpen" | "facets" | "status" |
  "matchingRevision"> & { city?: string };

/** Compact, read-only canonical state without document metadata. */
export function currentSearchTruth(need: CurrentSearchTruthInput) {
  const activationReadiness = getSavedNeedActivationReadiness(need);
  return {
    authority: "latest_saved_search" as const,
    revision: need.matchingRevision ?? 0,
    status: need.status,
    title: need.title,
    locationQuery: need.locationQuery ?? need.city ?? null,
    locationLabel: need.locationLabel ?? need.locationQuery ?? need.city ?? null,
    maxBudgetEur: need.maxBudgetEur ?? null,
    arrangement: need.arrangement,
    schedule: need.schedule,
    requirements: need.requirements,
    openToSharing: need.openToSharing ?? null,
    radiusKm: need.radiusKm ?? null,
    genres: need.genres ?? [],
    instruments: need.instruments ?? [],
    collaborationOpen: need.collaborationOpen ?? null,
    facets: need.facets ?? [],
    activationReadiness,
  };
}

export function currentSearchAuthority(need: CurrentSearchTruthInput): string {
  return `TRUSTED LATEST SAVED SEARCH (authoritative server read): ${JSON.stringify(currentSearchTruth(need))}\n` +
    "For every statement about what is saved now, use these values. They override earlier thread messages, memory, candidate text, provider claims, offers, and other context above.";
}
