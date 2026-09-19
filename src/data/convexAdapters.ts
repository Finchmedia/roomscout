import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { MarketSignal, SavedSearch, SearchField } from "../mocks/demoData";

type SavedNeedProjection = Omit<Doc<"savedNeeds">, "city" | "districts"> & {
  city?: string;
  districts?: string[];
};

type PublicSignal = {
  _id: Id<"signals">;
  isDemo?: boolean;
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
  facets?: Array<{
    namespace: string;
    key: string;
    value: string | number | boolean | string[];
    confidence: number;
  }>;
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

type PublicFacet = NonNullable<PublicSignal["facets"]>[number];

function humanizeFacetKey(key: string): string {
  if (key.toLocaleLowerCase() === "pa") return "PA";
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function facetValue(facet: PublicFacet): string | undefined {
  const label = humanizeFacetKey(facet.key);
  const genericKey = /^(?:capacity|equipment|features?|items?|details?)$/i.test(facet.key);
  const values = Array.isArray(facet.value) ? facet.value.map((value) => value.trim()).filter(Boolean) : undefined;
  if (values) return values.length === 0 ? undefined : genericKey ? values.join(" · ") : `${label}: ${values.join(" · ")}`;
  if (typeof facet.value === "boolean") return facet.value ? label : `${label}: no`;
  if (typeof facet.value === "number") {
    return facet.namespace.toLocaleLowerCase() === "capacity" && /(?:people|persons?|capacity|occupancy)/i.test(facet.key)
      ? `${facet.value} people`
      : `${label}: ${facet.value}`;
  }
  if (typeof facet.value !== "string") return undefined;
  const value = facet.value.trim();
  if (!value) return undefined;
  if (/^(?:true|yes|available|included)$/i.test(value)) return label;
  if (/^(?:false|no|unavailable|not available)$/i.test(value)) return `${label}: no`;
  if (facet.namespace.toLocaleLowerCase() === "capacity" && /(?:people|persons?|capacity|occupancy)/i.test(facet.key) && /^\d+(?:[.,]\d+)?$/.test(value)) {
    return `${value} people`;
  }
  return genericKey ? value : `${label}: ${value}`;
}

function publicFacetFacts(facets: PublicSignal["facets"]) {
  const grouped = new Map<string, string[]>();
  for (const facet of facets ?? []) {
    const namespace = facet.namespace.trim().toLocaleLowerCase();
    const label = namespace === "capacity" ? "Capacity" : namespace === "equipment" ? "Equipment" : undefined;
    if (!label) continue;
    const value = facetValue(facet);
    if (!value) continue;
    const values = grouped.get(label) ?? [];
    if (!values.includes(value)) values.push(value);
    grouped.set(label, values);
  }
  return ["Capacity", "Equipment"]
    .flatMap((label) => {
      const values = grouped.get(label);
      return values?.length ? [{ label, value: values.join(" · ") }] : [];
    });
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
  const facetFacts = publicFacetFacts(signal.facets);
  const facts = [
    signal.priceEur === undefined
      ? { label: "Price", value: "Not stated", unknown: true }
      : { label: "Price", value: `€${signal.priceEur} / ${pricePeriod}` },
    { label: "Arrangement", value: arrangementLabels[signal.arrangement] },
    ...(signal.requirements.length > 0
      ? [{ label: "Requirements", value: signal.requirements.join(" · ") }]
      : facetFacts.length === 0
        ? [{ label: "Requirements", value: "Not stated", unknown: true }]
        : []),
    ...facetFacts,
  ];

  return {
    id: signal._id,
    isDemo: signal.isDemo === true,
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

export function savedNeedToSearch(need: SavedNeedProjection): SavedSearch {
  const fields: SearchField[] = [];
  const location = need.locationLabel?.trim() || need.locationQuery?.trim() || need.city?.trim() || "";
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
