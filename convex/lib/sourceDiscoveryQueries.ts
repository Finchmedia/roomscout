export type DiscoverySide = "supply" | "demand" | "both";

export type DiscoveryQuery = {
  key: string;
  label: string;
  query: string;
  location: string;
  side: DiscoverySide;
  sourceKind:
    | "classifieds"
    | "music_community"
    | "studio_directory"
    | "public_culture";
};

const GERMAN_REGIONS = [
  "Deutschland",
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
  "Stuttgart",
  "München",
  "Köln",
  "Frankfurt am Main",
  "Düsseldorf",
  "Leipzig",
  "Dresden",
  "Hannover",
  "Nürnberg",
  "Dortmund",
  "Essen",
  "Bochum",
  "Münster",
  "Freiburg",
  "Karlsruhe",
  "Mannheim",
] as const;

const QUERY_FAMILIES = [
  {
    key: "classifieds",
    label: "Classified listings",
    side: "both" as const,
    sourceKind: "classifieds" as const,
    terms:
      '("Proberaum frei" OR "Proberaum gesucht" OR "Bandraum mieten") (Kleinanzeigen OR Anzeigen OR Inserate)',
  },
  {
    key: "communities",
    label: "Musician communities",
    side: "both" as const,
    sourceKind: "music_community" as const,
    terms:
      '("Proberaum" OR "Bandraum") (Musikerforum OR Musikerbörse OR Bandforum OR Musikverein)',
  },
  {
    key: "studios",
    label: "Studios and room directories",
    side: "supply" as const,
    sourceKind: "studio_directory" as const,
    terms:
      '("Proberaum mieten" OR "Proberaum stundenweise" OR "Rehearsal room") (Studio OR Verzeichnis OR Buchung)',
  },
  {
    key: "culture",
    label: "Culture and youth organizations",
    side: "supply" as const,
    sourceKind: "public_culture" as const,
    terms:
      '("Proberaum" OR "Bandraum") (Jugendhaus OR Kulturzentrum OR Musikschule OR Hochschule OR Kommune)',
  },
] as const;

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildGermanySourceDiscoveryQueries(): DiscoveryQuery[] {
  return GERMAN_REGIONS.flatMap((location) =>
    QUERY_FAMILIES.map((family) => ({
      key: `${family.key}:${slug(location)}`,
      label: `${family.label} · ${location}`,
      query: `${family.terms} ${location}`,
      location,
      side: family.side,
      sourceKind: family.sourceKind,
    })),
  );
}

export function discoveryQuerySlice(args: {
  cursor: number;
  limit: number;
}): { queries: DiscoveryQuery[]; nextCursor: number | null; total: number } {
  const all = buildGermanySourceDiscoveryQueries();
  const cursor = Math.max(0, Math.floor(args.cursor));
  const limit = Math.max(1, Math.min(10, Math.floor(args.limit)));
  const queries = all.slice(cursor, cursor + limit);
  const nextCursor = cursor + queries.length < all.length
    ? cursor + queries.length
    : null;
  return { queries, nextCursor, total: all.length };
}
