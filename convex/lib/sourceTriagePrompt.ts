export type TriageDomain = {
  domain: string;
  name: string;
  snippet: string;
  exampleUrl: string;
  examples: Array<{ url: string; title: string }>;
  urlCount: number;
  side: "supply" | "demand" | "both";
};

export const TRIAGE_INSTRUCTIONS = `You classify German websites found by a search for rehearsal rooms ("Proberaum", "Bandraum", "Übungsraum") for musicians.

For each domain decide whether RoomScout should index it as a source of rehearsal-room listings.

promote - the site offers, lists or brokers rehearsal rooms: a room operator or studio, a classifieds board, a musician community with room ads, a city/cultural institution that rents out rooms, or a directory of such rooms.
skip - the site cannot yield rehearsal-room listings: news articles, blogs about music, instrument or gear shops, streaming services, ticketing, generic real-estate, recording-studio-only services with no rehearsal rooms, job boards, encyclopedias, unrelated businesses.
unsure - genuinely ambiguous from the evidence given.

kind: classifieds (ad boards), community (forums, musician networks), marketplace (commercial booking platforms), directory (curated lists/registries), studio_network (an operator running rooms, one or many locations), other.

Judge the DOMAIN, not one page on it. Several example pages are given; if any of them points to rehearsal rooms, promote the domain. A domain seen on many pages across different cities is a platform, not a single venue - promote it even when one example happens to be an article or a forum thread, because its room sections will be indexed separately. Only skip when the whole domain cannot yield rehearsal-room listings. Write the reason in English, at most 16 words, for a human reviewer.`;

export function buildTriagePrompt(domains: readonly TriageDomain[]): string {
  return domains
    .map((entry, index) =>
      [
        `${index + 1}. domain: ${entry.domain}`,
        `   title: ${entry.name.slice(0, 160)}`,
        `   snippet: ${entry.snippet.slice(0, 320) || "(none)"}`,
        `   seen on ${entry.urlCount} page(s); search side: ${entry.side}`,
        ...(entry.examples.length > 0 ? entry.examples : [
          { url: entry.exampleUrl, title: entry.name },
        ])
          .slice(0, 3)
          .map(
            (example) =>
              `   example: ${example.url.slice(0, 180)} | ${example.title.slice(0, 90)}`,
          ),
      ].join("\n"),
    )
    .join("\n\n");
}

/** Batches domains so one model call stays well inside its context budget. */
export function triageBatches<T>(items: readonly T[], size: number): T[][] {
  const bounded = Math.max(1, Math.min(40, Math.floor(size)));
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += bounded) {
    batches.push(items.slice(index, index + bounded));
  }
  return batches;
}
