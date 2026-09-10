export const DEFAULT_SEARCH_RADIUS_KM = 20;
export const MIN_SEARCH_RADIUS_KM = 1;
export const MAX_SEARCH_RADIUS_KM = 200;

type SavedNeedLocationFields = {
  locationQuery?: string;
  locationLabel?: string;
  city?: string;
  radiusKm?: number;
  centerLatitude?: number;
  centerLongitude?: number;
};

export function savedNeedLocationQuery(need: SavedNeedLocationFields): string {
  return need.locationQuery?.trim() || need.city?.trim() || "";
}

export function savedNeedLocationLabel(need: SavedNeedLocationFields): string {
  return need.locationLabel?.trim() || savedNeedLocationQuery(need);
}

export function hasValidSearchRadius(radiusKm: number | undefined): radiusKm is number {
  return radiusKm !== undefined &&
    Number.isFinite(radiusKm) &&
    radiusKm >= MIN_SEARCH_RADIUS_KM &&
    radiusKm <= MAX_SEARCH_RADIUS_KM;
}

export function hasCompleteSavedNeedLocation(need: SavedNeedLocationFields): boolean {
  const query = savedNeedLocationQuery(need);
  if (!query) return false;
  // Existing city-only rows remain activatable until the location migration
  // assigns their radius. All newly written rows have locationQuery set.
  return need.locationQuery === undefined && need.radiusKm === undefined
    ? true
    : hasValidSearchRadius(need.radiusKm);
}

export function geocodeQueryForSavedNeed(need: SavedNeedLocationFields): string {
  const query = savedNeedLocationQuery(need);
  if (!query) return "";
  return /(?:^|[,\s])(de|deutschland|germany)(?:$|[,\s])/iu.test(query)
    ? query
    : `${query}, Germany`;
}
