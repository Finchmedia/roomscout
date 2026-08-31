import { stableFingerprint } from "./fingerprints";
import { redactContactData } from "./piiRedaction";
import { canonicalizeUrl } from "./urlCanonicalization";

export type SignalSide = "supply" | "demand";
export type Arrangement = "permanent" | "shared" | "hourly" | "unknown";
export type PricePeriod = "hour" | "month" | "unknown";

export type ExtractedSourceEntry = {
  externalId?: string;
  canonicalUrl: string;
  detailUrl: string;
  title: string;
  excerpt: string;
  side: SignalSide;
  city?: string;
  district?: string;
  sourcePublishedAt?: number;
  contentFingerprint: string;
  contactDataPresent: boolean;
  summary: string;
  arrangement: Arrangement;
  priceEur?: number;
  pricePeriod?: PricePeriod;
  requirements: string[];
  unknowns: string[];
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 30)
    : [];
}

function optionalTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function normalizeSide(value: unknown, fallback: SignalSide): SignalSide {
  return value === "supply" || value === "demand" ? value : fallback;
}

function normalizeArrangement(value: unknown): Arrangement {
  return value === "permanent" || value === "shared" || value === "hourly"
    ? value
    : "unknown";
}

function normalizePricePeriod(value: unknown): PricePeriod | undefined {
  return value === "hour" || value === "month" || value === "unknown"
    ? value
    : undefined;
}

function entryArrayFromSnapshot(snapshot: unknown): unknown[] {
  if (Array.isArray(snapshot)) {
    return snapshot;
  }
  const record = recordOf(snapshot);
  if (!record) {
    return [];
  }
  for (const key of ["entries", "listings", "results", "items", "posts"]) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  return [];
}

export function extractSourceEntriesFromSnapshot(args: {
  snapshot: unknown;
  pageUrl: string;
  defaultSide: SignalSide;
  maxEntries?: number;
}): ExtractedSourceEntry[] {
  const pageCanonical = canonicalizeUrl(args.pageUrl);
  if (!pageCanonical) {
    return [];
  }
  const maxEntries = Math.max(1, Math.min(args.maxEntries ?? 50, 100));
  const output: ExtractedSourceEntry[] = [];
  const seen = new Set<string>();

  for (const rawValue of entryArrayFromSnapshot(args.snapshot).slice(0, maxEntries)) {
    const raw = recordOf(rawValue);
    if (!raw) {
      continue;
    }
    const titleResult = redactContactData(
      stringValue(raw.title) ?? stringValue(raw.name) ?? "",
    );
    if (!titleResult.redacted) {
      continue;
    }
    const rawDetailUrl =
      stringValue(raw.detailUrl) ??
      stringValue(raw.url) ??
      stringValue(raw.link) ??
      pageCanonical;
    const detailUrl = canonicalizeUrl(rawDetailUrl, pageCanonical);
    if (!detailUrl || seen.has(detailUrl)) {
      continue;
    }
    seen.add(detailUrl);

    const excerptResult = redactContactData(
      stringValue(raw.excerpt) ??
        stringValue(raw.summary) ??
        stringValue(raw.description) ??
        titleResult.redacted,
    );
    const side = normalizeSide(raw.side, args.defaultSide);
    const summary = excerptResult.redacted.slice(0, 1_500);
    const externalId = stringValue(raw.externalId) ?? stringValue(raw.id);
    const fingerprint = stableFingerprint(
      JSON.stringify({ detailUrl, side, title: titleResult.redacted, summary }),
    );

    output.push({
      ...(externalId ? { externalId: externalId.slice(0, 300) } : {}),
      canonicalUrl: detailUrl,
      detailUrl,
      title: titleResult.redacted.slice(0, 300),
      excerpt: summary.slice(0, 1_000),
      side,
      ...(stringValue(raw.city) ? { city: stringValue(raw.city)!.slice(0, 200) } : {}),
      ...(stringValue(raw.district)
        ? { district: stringValue(raw.district)!.slice(0, 200) }
        : {}),
      ...(optionalTimestamp(raw.sourcePublishedAt ?? raw.publishedAt ?? raw.date)
        ? {
            sourcePublishedAt: optionalTimestamp(
              raw.sourcePublishedAt ?? raw.publishedAt ?? raw.date,
            ),
          }
        : {}),
      contentFingerprint: fingerprint,
      contactDataPresent:
        titleResult.contactDataPresent || excerptResult.contactDataPresent,
      summary,
      arrangement: normalizeArrangement(raw.arrangement),
      ...(optionalNumber(raw.priceEur) !== undefined
        ? { priceEur: optionalNumber(raw.priceEur) }
        : {}),
      ...(normalizePricePeriod(raw.pricePeriod)
        ? { pricePeriod: normalizePricePeriod(raw.pricePeriod) }
        : {}),
      requirements: stringArray(raw.requirements),
      unknowns: stringArray(raw.unknowns),
    });
  }

  return output;
}

export const SOURCE_ENTRY_CHANGE_TRACKING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    entries: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          externalId: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          summary: { type: "string" },
          side: { type: "string", enum: ["supply", "demand"] },
          city: { type: "string" },
          district: { type: "string" },
          publishedAt: { type: "string" },
          arrangement: {
            type: "string",
            enum: ["permanent", "shared", "hourly", "unknown"],
          },
          priceEur: { type: "number" },
          pricePeriod: {
            type: "string",
            enum: ["hour", "month", "unknown"],
          },
          requirements: { type: "array", items: { type: "string" } },
          unknowns: { type: "array", items: { type: "string" } },
        },
        required: ["title", "url", "summary"],
      },
    },
  },
  required: ["entries"],
} as const;

export const SOURCE_ENTRY_EXTRACTION_PROMPT =
  "Extract every distinct rehearsal-room supply or demand listing visible on the page. Preserve only explicitly stated facts. Use each listing's stable detail URL when available, never invent contact details, and return an empty entries array when the page contains no listings.";
