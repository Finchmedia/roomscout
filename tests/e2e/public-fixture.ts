import { test as base, expect } from "@playwright/test";

const observedAt = Date.UTC(2026, 8, 1, 12);
const sharedSignal = {
  city: "Stuttgart",
  summary: "A rehearsal space with evening access.",
  arrangement: "shared",
  priceEur: 230,
  pricePeriod: "month",
  requirements: ["Evenings", "Storage"],
  unknowns: ["Drum kit availability"],
  status: "published",
  sourceCount: 1,
  firstSeenAt: observedAt,
};
const signals = [
  { ...sharedSignal, _id: "older-supply", title: "Verified rehearsal room", side: "supply", verification: "verified", lastSeenAt: observedAt },
  { ...sharedSignal, _id: "newer-supply", title: "Newly listed rehearsal room", side: "supply", verification: "observed", lastSeenAt: observedAt + 86_400_000 },
  { ...sharedSignal, _id: "band-demand", title: "Band looking for a shared room", side: "demand", verification: "observed", lastSeenAt: observedAt },
];

function queryResult(path: string, args: Record<string, unknown>) {
  if (path === "signals:list") {
    return signals.filter((signal) =>
      (!args.city || args.city === signal.city) && (!args.side || args.side === signal.side),
    );
  }
  if (path === "signals:get") {
    const signal = signals.find((item) => item._id === args.signalId);
    return signal ? {
      signal,
      evidence: [{ sourceName: "Rehearsal directory fixture", sourceUrl: "https://example.com/rehearsal-room", excerpt: "Shared room, evening access, monthly rent EUR 230." }],
    } : null;
  }
  throw new Error(`Public browser test needs an explicit fixture for ${path}`);
}

type QueryChange =
  | { type: "Add"; queryId: number; udfPath: string; args: [Record<string, unknown>] }
  | { type: "Remove"; queryId: number };

// Simulate only the external Convex transport. Real routing, React components,
// Convex subscriptions, filtering and rendering remain under test. No live data
// or provider writes are used; unknown queries and writes fail the test.
export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    await page.addInitScript(() => localStorage.setItem("roomscout.locale", "en"));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === "http://127.0.0.1:4173"
        ? route.continue()
        : route.abort(),
    );
    await page.routeWebSocket(/.*/, (socket) => {
      let version = { querySet: 0, identity: 0, ts: "AAAAAAAAAAA=" };
      let timestamp = 0n;
      socket.onMessage((raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === "Connect" || message.type === "Event") return;
        const startVersion = version;
        const encodedTime = Buffer.alloc(8);
        encodedTime.writeBigUInt64LE(++timestamp);
        version = { ...version, ts: encodedTime.toString("base64") };
        let modifications: unknown[] = [];
        if (message.type === "Authenticate" && message.tokenType === "None") {
          version.identity = message.baseVersion + 1;
        } else if (message.type === "ModifyQuerySet") {
          version.querySet = message.newVersion;
          modifications = (message.modifications as QueryChange[]).map((change) =>
            change.type === "Remove"
              ? { type: "QueryRemoved", queryId: change.queryId }
              : { type: "QueryUpdated", queryId: change.queryId, value: queryResult(change.udfPath, change.args[0]), logLines: [], journal: null },
          );
        } else {
          throw new Error(`Unexpected operation in read-only public test: ${message.type}`);
        }
        socket.send(JSON.stringify({ type: "Transition", startVersion, endVersion: version, modifications }));
      });
    });
    await runWithPage(page);
  },
});

export { expect };
