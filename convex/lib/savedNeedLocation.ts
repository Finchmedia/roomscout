export const DEFAULT_SEARCH_RADIUS_KM = 20;
export const MIN_SEARCH_RADIUS_KM = 1;
export const MAX_SEARCH_RADIUS_KM = 200;

export type SavedNeedLocationFields = {
  locationQuery?: string;
  locationLabel?: string;
  city?: string;
  radiusKm?: number;
  centerLatitude?: number;
  centerLongitude?: number;
};

export type SavedNeedActivationMissingField = "location" | "radiusKm";
export type SavedNeedActivationReadiness = {
  canActivate: boolean;
  missingFields: SavedNeedActivationMissingField[];
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

/** One activation gate for Scout readiness, voice, mutations, and the UI. */
export function getSavedNeedActivationReadiness(
  need: SavedNeedLocationFields,
): SavedNeedActivationReadiness {
  const missingFields: SavedNeedActivationMissingField[] = [];
  const query = savedNeedLocationQuery(need);
  if (!query) missingFields.push("location");
  // Existing city-only rows remain activatable until the location migration
  // assigns their radius. Every normalized locationQuery needs a real radius.
  const legacyCityOnly = Boolean(query) &&
    need.locationQuery === undefined &&
    need.radiusKm === undefined;
  if (!legacyCityOnly && !hasValidSearchRadius(need.radiusKm)) {
    missingFields.push("radiusKm");
  }
  return { canActivate: missingFields.length === 0, missingFields };
}

export function savedNeedActivationClarificationQuestion(
  locale: "en" | "de",
  need: SavedNeedLocationFields,
  missingFields = getSavedNeedActivationReadiness(need).missingFields,
): string {
  const missingLocation = missingFields.includes("location");
  const missingRadius = missingFields.includes("radiusKm");
  const location = savedNeedLocationLabel(need);
  if (locale === "de") {
    if (missingLocation && missingRadius) {
      return "Wo soll ich suchen und welchen Umkreis soll ich verwenden?";
    }
    if (missingLocation) return "Wo soll ich suchen?";
    return `Welchen Umkreis um ${location} soll ich verwenden?`;
  }
  if (missingLocation && missingRadius) {
    return "Where should I search, and what radius should I use?";
  }
  if (missingLocation) return "Where should I search?";
  return `What radius around ${location} should I use?`;
}

export function hasCompleteSavedNeedLocation(need: SavedNeedLocationFields): boolean {
  return getSavedNeedActivationReadiness(need).canActivate;
}

export function geocodeQueryForSavedNeed(need: SavedNeedLocationFields): string {
  const query = savedNeedLocationQuery(need);
  if (!query) return "";
  return /(?:^|[,\s])(de|deutschland|germany)(?:$|[,\s])/iu.test(query)
    ? query
    : `${query}, Germany`;
}
