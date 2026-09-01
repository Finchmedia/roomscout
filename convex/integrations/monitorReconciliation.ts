import type {
  CreateMonitorRequest,
  NativeMonitor,
} from "../components/firecrawlRoomScout/client";
import { stableFingerprint } from "./fingerprints";
import {
  SOURCE_ENTRY_CHANGE_TRACKING_SCHEMA,
  SOURCE_ENTRY_EXTRACTION_PROMPT,
} from "./sourceEntryExtraction";

export type MonitorCandidate = {
  targetId: string;
  sourceName: string;
  url: string;
  mode: "scrape" | "crawl" | "batch";
  scheduleMinutes: number;
  paused: boolean;
};

export function buildDesiredMonitor(args: {
  candidate: MonitorCandidate;
  webhookUrl: string;
  webhookSecret: string;
}): CreateMonitorRequest {
  const interval = Math.max(15, Math.floor(args.candidate.scheduleMinutes));
  const scrapeOptions = {
    onlyMainContent: true,
    maxAge: 0,
    formats: [
      {
        type: "changeTracking" as const,
        modes: ["json" as const],
        prompt: SOURCE_ENTRY_EXTRACTION_PROMPT,
        schema: SOURCE_ENTRY_CHANGE_TRACKING_SCHEMA,
      },
    ],
  };
  const target =
    args.candidate.mode === "crawl"
      ? {
          id: args.candidate.targetId,
          type: "crawl" as const,
          url: args.candidate.url,
          scrapeOptions,
        }
      : {
          id: args.candidate.targetId,
          type: "scrape" as const,
          urls: [args.candidate.url],
          scrapeOptions,
        };

  return {
    name: `RoomScout · ${args.candidate.sourceName}`.slice(0, 120),
    schedule: {
      text: `every ${interval} minutes`,
      timezone: "Europe/Berlin",
    },
    webhook: {
      url: args.webhookUrl,
      headers: { Authorization: `Bearer ${args.webhookSecret}` },
      metadata: { sourceTargetId: args.candidate.targetId },
      events: ["monitor.page", "monitor.check.completed"],
    },
    targets: [target],
    retentionDays: 7,
    goal:
      "Alert when rehearsal-room listings are added, removed, or substantively changed. Ignore unrelated navigation, advertising, and page chrome.",
    judgeEnabled: true,
  };
}

export function monitorConfigFingerprint(
  request: CreateMonitorRequest,
  paused: boolean,
): string {
  return stableFingerprint(
    JSON.stringify({
      ...request,
      webhook: request.webhook
        ? { ...request.webhook, headers: Object.keys(request.webhook.headers ?? {}).sort() }
        : undefined,
      desiredStatus: paused ? "paused" : "active",
    }),
  );
}

export function monitorMatchesDesired(
  monitor: NativeMonitor,
  fingerprint: string,
  storedFingerprint: string | undefined,
  paused: boolean,
): boolean {
  const expectedStatus = paused ? "paused" : "active";
  return storedFingerprint === fingerprint && monitor.status === expectedStatus;
}

export type ParsedMonitorWebhook = {
  eventType: string;
  providerEventId: string;
  sourceTargetId?: string;
  providerMonitorId?: string;
  providerCheckId?: string;
  pageId?: string;
  pageUrl?: string;
  changeStatus?: "new" | "same" | "changed" | "removed";
  snapshot?: unknown;
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && !!value);
}

export function parseMonitorWebhook(payload: Record<string, unknown>): ParsedMonitorWebhook {
  const data = recordOf(payload.data) ?? {};
  const page = recordOf(data.page) ?? data;
  const rootMetadata = recordOf(payload.metadata) ?? {};
  const dataMetadata = recordOf(data.metadata) ?? {};
  const pageMetadata = recordOf(page.metadata) ?? {};
  const eventType = stringValue(payload.type, payload.event) ?? "unknown";
  const providerMonitorId = stringValue(
    payload.monitorId,
    data.monitorId,
    page.monitorId,
  );
  const completionCheckId =
    eventType === "monitor.check.completed" ? data.id : undefined;
  const providerCheckId = stringValue(
    payload.checkId,
    data.checkId,
    page.checkId,
    completionCheckId,
  );
  const pageId = stringValue(page.id, data.pageId);
  const pageUrl = stringValue(
    page.url,
    data.url,
    pageMetadata.url,
    pageMetadata.sourceURL,
  );
  const statusValue = stringValue(page.status, data.status);
  const changeStatus =
    statusValue === "new" ||
    statusValue === "same" ||
    statusValue === "changed" ||
    statusValue === "removed"
      ? statusValue
      : undefined;
  const providerEventId =
    stringValue(payload.id, payload.eventId) ??
    stableFingerprint(
      [eventType, providerMonitorId, providerCheckId, pageId, pageUrl, changeStatus]
        .filter(Boolean)
        .join("\n"),
    );
  const snapshotRecord = recordOf(page.snapshot) ?? recordOf(data.snapshot);

  return {
    eventType,
    providerEventId,
    sourceTargetId: stringValue(
      rootMetadata.sourceTargetId,
      dataMetadata.sourceTargetId,
      pageMetadata.sourceTargetId,
    ),
    ...(providerMonitorId ? { providerMonitorId } : {}),
    ...(providerCheckId ? { providerCheckId } : {}),
    ...(pageId ? { pageId } : {}),
    ...(pageUrl ? { pageUrl } : {}),
    ...(changeStatus ? { changeStatus } : {}),
    ...(snapshotRecord && "json" in snapshotRecord
      ? { snapshot: snapshotRecord.json }
      : page.snapshot !== undefined
        ? { snapshot: page.snapshot }
        : {}),
  };
}
