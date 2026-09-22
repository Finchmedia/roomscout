/**
 * Berlin rehearsal venues named in an operator-supplied study.
 *
 * These are curated names rather than search hits, so they enter review with a
 * higher confidence than a discovery result. A few entries are descriptive
 * rather than brand names; they are marked `descriptive` because a name search
 * for them is less reliable and the review queue should say so.
 */

export type NamedVenue = {
  name: string;
  city: string;
  descriptive?: boolean;
};

export const BERLIN_STUDY_VENUES: readonly NamedVenue[] = [
  { name: "ARTtraktiv", city: "Berlin" },
  { name: "bandsupport", city: "Berlin" },
  { name: "Berlin-Musikschule", city: "Berlin" },
  { name: "Berliner Rockhaus", city: "Berlin" },
  { name: "Castalian Spring", city: "Berlin" },
  { name: "Die Linse", city: "Berlin" },
  { name: "Die Wache", city: "Berlin" },
  { name: "Frauenmusikzentrum", city: "Berlin" },
  { name: "Lärm und Lust", city: "Berlin" },
  { name: "Gaswerksiedlung Berlin", city: "Berlin" },
  { name: "Herzbergstraße 100", city: "Berlin", descriptive: true },
  { name: "Makersfactory", city: "Berlin" },
  { name: "musik erlaubt", city: "Berlin" },
  { name: "Musikbunker Berlin", city: "Berlin" },
  { name: "Musikbunker Neukölln", city: "Berlin" },
  {
    name: "Musikproberaum Flughafen Tempelhof",
    city: "Berlin",
    descriptive: true,
  },
  { name: "nji musicbox", city: "Berlin" },
  { name: "noisy Rooms", city: "Berlin" },
  { name: "ORWOHaus", city: "Berlin" },
  { name: "Pirate Studios", city: "Berlin" },
  { name: "Proberaum Berlin", city: "Berlin", descriptive: true },
  { name: "Raumvorteil", city: "Berlin" },
  { name: "Soundbox Berlin", city: "Berlin" },
  { name: "Steinway Übungsstudio", city: "Berlin" },
  { name: "Super-Sessions", city: "Berlin" },
  { name: "Tomatenklang", city: "Berlin" },
  { name: "Übungsräume ehemaliges Schulgebäude", city: "Berlin", descriptive: true },
  { name: "Vivaldi Saal", city: "Berlin" },
] as const;

/** Name search reads better quoted, with the city as the disambiguator. */
export function namedVenueQuery(venue: NamedVenue): string {
  return `"${venue.name}" Proberaum ${venue.city}`;
}

export function namedVenueSlice(args: {
  cursor: number;
  limit: number;
  venues?: readonly NamedVenue[];
}): { venues: NamedVenue[]; nextCursor: number | null; total: number } {
  const all = args.venues ?? BERLIN_STUDY_VENUES;
  const cursor = Math.max(0, Math.floor(args.cursor));
  const limit = Math.max(1, Math.min(30, Math.floor(args.limit)));
  const venues = all.slice(cursor, cursor + limit);
  const nextCursor =
    cursor + venues.length < all.length ? cursor + venues.length : null;
  return { venues, nextCursor, total: all.length };
}

export type VenueMatchOption = {
  canonicalUrl: string;
  canonicalDomain: string;
};

function venueTokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 3 && token !== "der" && token !== "die");
}

/**
 * Picks the best search hit for a named venue.
 *
 * A plain "first result" is wrong often enough to matter: a name search can
 * surface the study PDF that listed the venue, or a ticketing aggregator, above
 * the venue's own site. Scoring prefers a domain that carries the venue's name
 * and penalises uploads and deep paths, which is what distinguishes an official
 * site from a page that merely mentions it.
 */
export function pickVenueMatch(
  venue: NamedVenue,
  options: readonly VenueMatchOption[],
): VenueMatchOption | null {
  let best: { option: VenueMatchOption; score: number } | null = null;
  for (const option of options) {
    let score = 0;
    const domainRoot = option.canonicalDomain
      .replace(/^www\./, "")
      .split(".")
      .slice(0, -1)
      .join("")
      .replace(/[^a-z0-9]/g, "");
    const tokens = venueTokens(venue.name);
    const joined = tokens.join("");
    if (joined.length >= 3 && domainRoot.includes(joined)) {
      score += 5;
    } else if (tokens.some((token) => domainRoot.includes(token))) {
      score += 3;
    }

    let path = "";
    try {
      path = new URL(option.canonicalUrl).pathname;
    } catch {
      path = "";
    }
    // A document that mentions the venue is evidence, not the venue's source.
    if (/\.(pdf|docx?|jpe?g|png)$/i.test(path)) score -= 6;
    if (/\/wp-content\/|\/uploads\//i.test(path)) score -= 6;
    // Prefer the site root over a deep page on someone else's site.
    const depth = path.split("/").filter(Boolean).length;
    if (depth === 0) score += 2;
    else if (depth >= 3) score -= 1;

    if (best === null || score > best.score) {
      best = { option, score };
    }
  }
  return best === null || best.score < 0 ? null : best.option;
}
