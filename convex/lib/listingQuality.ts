/**
 * Placeholder detection for extracted listings.
 *
 * When a scraped page turns out not to be a listing index, the extractor still
 * has to return something, and it returns a stand-in: the site's own name, a
 * generic label, or an explicit "unknown". Those rows are not rooms and must
 * not reach the public index or the coverage map.
 */

const PLACEHOLDER_CITIES = new Set([
  "",
  "unknown",
  "unbekannt",
  "n/a",
  "na",
  "-",
  "keine angabe",
  "deutschland",
  "germany",
  "verschiedene",
  "diverse",
  "bundesweit",
]);

const PLACEHOLDER_TITLES = new Set([
  "unknown",
  "unbekannt",
  "rehearsal-room listing",
  "rehearsal room listing",
  "proberaum",
  "proberaeume",
  "proberäume",
  "anzeige",
  "kleinanzeige",
  "listing",
  "no title",
  "kein titel",
]);

const PLACEHOLDER_TITLE_PATTERNS = [
  /^no\s+(rehearsal|listing)/i,
  /^keine\s+anzeige/i,
  /^kein\s+(eintrag|angebot|inserat)/i,
  /^(seite|page)\s+nicht/i,
  /^\s*$/,
];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Strips redaction markers so a title made only of them reads as empty. */
function withoutRedactions(value: string): string {
  return value.replace(/\[[a-z ]*redacted\]/gi, " ").trim();
}

/**
 * Vocabulary that marks a title as describing a room rather than a website.
 * A row with no placeable city is only discarded when its title also lacks
 * any of these, which keeps a real room that merely failed city extraction.
 */
const ROOM_VOCABULARY =
  /prober|bandraum|übungsraum|uebungsraum|rehearsal|studio|musikraum|tonstudio|raum\b|räume|raeume/i;

export type ListingQualityInput = { title: string; city: string };

export type ListingQualityVerdict = {
  usable: boolean;
  reason?: "placeholder_city" | "placeholder_title" | "empty_title";
};

export function assessListingQuality(
  input: ListingQualityInput,
): ListingQualityVerdict {
  const title = normalize(input.title);
  const city = normalize(input.city);

  if (withoutRedactions(title).length < 3) {
    return { usable: false, reason: "empty_title" };
  }
  if (
    PLACEHOLDER_TITLES.has(title) ||
    PLACEHOLDER_TITLE_PATTERNS.some((pattern) => pattern.test(title))
  ) {
    return { usable: false, reason: "placeholder_title" };
  }
  // A listing without a placeable city cannot appear on the coverage map, but
  // it can still be a real room, so it is only discarded when the title shows
  // no sign of describing a room either.
  if (PLACEHOLDER_CITIES.has(city) && !ROOM_VOCABULARY.test(input.title)) {
    return { usable: false, reason: "placeholder_city" };
  }
  return { usable: true };
}

/**
 * True when a city string can be trusted as a real place. Geocoders happily
 * resolve "unknown" to a point in the country, so a placeholder must never
 * reach the coverage map even when its listing is genuine.
 */
export function isPlaceableCity(city: string): boolean {
  const normalized = normalize(city);
  if (PLACEHOLDER_CITIES.has(normalized)) return false;
  // A one or two character "city" is an abbreviation or stray punctuation, and
  // a name carrying no Latin letters is not a German place name at all.
  if (normalized.length < 3) return false;
  if (!/\p{Script=Latin}/u.test(normalized)) return false;
  return true;
}

/**
 * Germany's bounding box. The coverage map claims German coverage, so a
 * listing geocoded outside it is a mis-extraction however plausible its name,
 * and a pin on another continent would be worse than no pin.
 */
export function isWithinGermany(latitude: number, longitude: number): boolean {
  return (
    latitude >= 47.2 &&
    latitude <= 55.1 &&
    longitude >= 5.8 &&
    longitude <= 15.1
  );
}
