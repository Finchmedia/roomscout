import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { MarketSignal, SavedSearch, SearchField } from "../mocks/demoData";

type PublicSignal = {
  _id: Id<"signals">;
  side: "supply" | "demand";
  title: string;
  city: string;
  district?: string;
  summary: string;
  arrangement: "permanent" | "shared" | "hourly" | "unknown";
  priceEur?: number;
  pricePeriod?: "hour" | "month" | "unknown";
  requirements: string[];
  unknowns: string[];
  status: "published" | "stale";
  verification: "observed" | "verified" | "conflicting";
  sourceCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
};

const arrangementLabels = {
  permanent: "Permanent",
  shared: "Shared",
  hourly: "Hourly",
  unknown: "Arrangement unknown",
} as const;

function relativeTime(timestamp: number, prefix: string): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return `${prefix} just now`;
  if (minutes < 60) return `${prefix} ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${prefix} ${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${prefix} ${days} d ago`;
}

export function publicSignalToMarketSignal(
  signal: PublicSignal,
  sourceName?: string,
  fit?: string,
): MarketSignal {
  const age = Date.now() - signal.lastSeenAt;
  const freshness = signal.status === "stale" || age > 7 * 86_400_000
    ? "possibly_stale"
    : age <= 86_400_000
      ? "fresh"
      : "current";
  const pricePeriod = signal.pricePeriod === "hour" ? "hour" : "month";
  const facts = [
    signal.priceEur === undefined
      ? { label: "Price", value: "Not stated", unknown: true }
      : { label: "Price", value: `€${signal.priceEur} / ${pricePeriod}` },
    { label: "Arrangement", value: arrangementLabels[signal.arrangement] },
    ...(signal.requirements.length > 0
      ? [{ label: "Requirements", value: signal.requirements.join(" · ") }]
      : [{ label: "Requirements", value: "Not stated", unknown: true }]),
  ];

  return {
    id: signal._id,
    side: signal.side,
    verification: signal.verification === "verified"
      ? "source_verified"
      : signal.verification,
    freshness,
    freshnessLabel: relativeTime(signal.lastSeenAt, signal.status === "stale" ? "Last seen" : "Checked"),
    title: signal.title,
    location: [signal.city, signal.district].filter(Boolean).join(" · "),
    arrangement: arrangementLabels[signal.arrangement],
    source: sourceName ?? `${signal.sourceCount} indexed source${signal.sourceCount === 1 ? "" : "s"}`,
    firstSeen: relativeTime(signal.firstSeenAt, "First seen"),
    facts,
    summary: signal.summary,
    fit,
    unknowns: signal.unknowns,
  };
}

export function savedNeedToSearch(need: Doc<"savedNeeds">): SavedSearch {
  const fields: SearchField[] = [];
  const location = [need.city, ...need.districts].filter(Boolean).join(" · ");
  if (location) fields.push({ label: "Location", value: location, source: "you" });
  if (need.radiusKm !== undefined) fields.push({ label: "Radius", value: `${need.radiusKm} km`, source: "you" });
  if (need.arrangement.length > 0) {
    fields.push({
      label: "Arrangement",
      value: need.arrangement.map((value) => arrangementLabels[value]).join(" · "),
      source: "you",
    });
  }
  if (need.maxBudgetEur !== undefined) fields.push({ label: "Budget", value: `≤ €${need.maxBudgetEur} / month`, source: "you" });
  if (need.schedule.length > 0) fields.push({ label: "Schedule", value: need.schedule.join(" · "), source: "you" });
  if (need.requirements.length > 0) fields.push({ label: "Essential", value: need.requirements.join(" · "), source: "you" });
  if (need.genres?.length) fields.push({ label: "Music", value: need.genres.join(" · "), source: "you" });
  if (need.instruments?.length) fields.push({ label: "Instruments", value: need.instruments.join(" · "), source: "you" });
  if (need.openToSharing !== undefined) {
    fields.push({
      label: "Sharing",
      value: need.openToSharing ? "Open to compatible room-sharing" : "Not looking to share",
      source: "you",
    });
  }

  return {
    id: need._id,
    title: need.title,
    status: need.status === "draft" ? "draft" : need.status === "paused" ? "paused" : "active",
    fields,
  };
}

export function formatMessageTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
