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

/**
 * Discovery is scoped per city, never per Bundesland and never nationally.
 * Measured against the live search API, region-wide and country-wide queries
 * return aggregators and social posts, while the same query with a city name
 * returns the local operators, Kulturzentren and board threads RoomScout can
 * actually review. Every German city above roughly 40k inhabitants is listed
 * so mid-size markets, where rehearsal rooms are cheapest, are covered too.
 */
const GERMAN_CITIES = [
  "Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main",
  "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Essen",
  "Bremen", "Dresden", "Hannover", "Nürnberg", "Duisburg",
  "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster",
  "Mannheim", "Karlsruhe", "Augsburg", "Wiesbaden", "Mönchengladbach",
  "Gelsenkirchen", "Braunschweig", "Kiel", "Chemnitz", "Aachen",
  "Halle (Saale)", "Magdeburg", "Freiburg im Breisgau", "Krefeld", "Mainz",
  "Lübeck", "Erfurt", "Oberhausen", "Rostock", "Kassel",
  "Hagen", "Potsdam", "Saarbrücken", "Hamm", "Ludwigshafen am Rhein",
  "Mülheim an der Ruhr", "Oldenburg", "Osnabrück", "Leverkusen", "Heidelberg",
  "Darmstadt", "Solingen", "Regensburg", "Herne", "Paderborn",
  "Neuss", "Ingolstadt", "Offenbach am Main", "Fürth", "Würzburg",
  "Heilbronn", "Ulm", "Pforzheim", "Wolfsburg", "Göttingen",
  "Bottrop", "Reutlingen", "Koblenz", "Bremerhaven", "Bergisch Gladbach",
  "Recklinghausen", "Erlangen", "Jena", "Remscheid", "Trier",
  "Salzgitter", "Siegen", "Moers", "Gütersloh", "Hildesheim",
  "Kaiserslautern", "Cottbus", "Schwerin", "Witten", "Gera",
  "Iserlohn", "Ludwigsburg", "Hanau", "Esslingen am Neckar", "Zwickau",
  "Düren", "Ratingen", "Tübingen", "Flensburg", "Lünen",
  "Villingen-Schwenningen", "Konstanz", "Worms", "Marl", "Velbert",
  "Minden", "Dessau-Roßlau", "Neumünster", "Norderstedt", "Delmenhorst",
  "Viersen", "Gladbeck", "Rheine", "Wilhelmshaven", "Bayreuth",
  "Troisdorf", "Castrop-Rauxel", "Lüneburg", "Brandenburg an der Havel", "Bocholt",
  "Aalen", "Bamberg", "Aschaffenburg", "Celle", "Lippstadt",
  "Fulda", "Kempten (Allgäu)", "Dorsten", "Herford", "Plauen",
  "Neuwied", "Dinslaken", "Rosenheim", "Sindelfingen", "Herten",
  "Görlitz", "Landshut", "Schwäbisch Gmünd", "Hattingen", "Wesel",
  "Friedrichshafen", "Offenburg", "Stralsund", "Greifswald", "Unna",
  "Göppingen", "Waiblingen", "Hameln", "Wetzlar", "Neubrandenburg",
  "Langenfeld", "Grevenbroich", "Sankt Augustin", "Baden-Baden", "Passau",
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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Search-friendly city name: "Halle (Saale)" searches better as "Halle". */
function searchName(city: string): string {
  return city.replace(/\s*\(.*?\)\s*/g, " ").trim();
}

/** The cities discovery sweeps, in descending population order. */
export function germanDiscoveryCities(): readonly string[] {
  return GERMAN_CITIES;
}

export function buildGermanySourceDiscoveryQueries(): DiscoveryQuery[] {
  return GERMAN_CITIES.flatMap((location) =>
    QUERY_FAMILIES.map((family) => ({
      key: `${family.key}:${slug(location)}`,
      label: `${family.label} · ${location}`,
      query: `${family.terms} ${searchName(location)}`,
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
  const limit = Math.max(1, Math.min(25, Math.floor(args.limit)));
  const queries = all.slice(cursor, cursor + limit);
  const nextCursor = cursor + queries.length < all.length
    ? cursor + queries.length
    : null;
  return { queries, nextCursor, total: all.length };
}
