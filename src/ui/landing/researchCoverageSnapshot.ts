/**
 * Static, public-only production snapshot. Refresh deliberately after checking
 * `signals:list` and each eligible signal's public `signals:get` evidence.
 * Demo/controlled signals must never enter this artifact.
 */
export type ResearchCoverageCity = {
  city: string
  latitude: number
  longitude: number
  realListingCount: number
}

export type ResearchCoverageSource = {
  name: string
  listingCount: number
}

export type ResearchCoverageSnapshot = {
  schemaVersion: 1
  snapshotId: string
  observedAt: string
  realListingCount: number
  cities: readonly ResearchCoverageCity[]
  indexedSources: readonly ResearchCoverageSource[]
}

/**
 * Production check on 2026-09-17 returned one public signal marked `isDemo`.
 * It is excluded, leaving no real listing or source claim in this snapshot.
 */
export const researchCoverageSnapshot: ResearchCoverageSnapshot = {
  schemaVersion: 1,
  snapshotId: "production-public-signals-2026-09-17-v1",
  observedAt: "2026-09-17T13:02:00.000Z",
  realListingCount: 0,
  cities: [],
  indexedSources: [],
}
