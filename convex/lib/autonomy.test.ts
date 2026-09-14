import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTONOMY_RULES,
  allowedActions,
  allowedDataScopes,
  autonomyHash,
  normalizeAutonomyRules,
  type AutonomyRules,
} from "./autonomy";

const allOff: AutonomyRules = {
  mode: "review",
  contact: false,
  viewings: false,
  publishAd: false,
  shareProfile: false,
  sharePrivate: false,
};

describe("DEFAULT_AUTONOMY_RULES", () => {
  it("matches the contract: autopilot, contact + viewings + profile on, ad + private off", () => {
    expect(DEFAULT_AUTONOMY_RULES).toEqual({
      mode: "autopilot",
      contact: true,
      viewings: true,
      publishAd: false,
      shareProfile: true,
      sharePrivate: false,
    });
  });
});

describe("allowedActions", () => {
  it("always includes create_portal_account, even with every switch off", () => {
    expect(allowedActions(allOff)).toEqual(["create_portal_account"]);
  });

  it.each([
    ["contact", ["send_email", "submit_webform", "send_platform_dm"]],
    ["viewings", ["propose_visit_time"]],
    ["publishAd", ["publish_listing"]],
    ["sharePrivate", ["share_contact_details"]],
  ] as const)("switch %s adds exactly %j", (key, expected) => {
    const on = allowedActions({ ...allOff, [key]: true });
    expect(on).toEqual(["create_portal_account", ...expected]);
    expect(allowedActions({ ...allOff, [key]: false })).toEqual(["create_portal_account"]);
  });

  it("shareProfile does not add an action", () => {
    expect(allowedActions({ ...allOff, shareProfile: true })).toEqual(["create_portal_account"]);
  });

  it("is independent of the mode", () => {
    expect(allowedActions({ ...DEFAULT_AUTONOMY_RULES, mode: "review" }))
      .toEqual(allowedActions(DEFAULT_AUTONOMY_RULES));
  });

  it("derives the default set", () => {
    expect(allowedActions(DEFAULT_AUTONOMY_RULES)).toEqual([
      "create_portal_account",
      "send_email",
      "submit_webform",
      "send_platform_dm",
      "propose_visit_time",
    ]);
  });
});

describe("allowedDataScopes", () => {
  it("is empty with both share switches off", () => {
    expect(allowedDataScopes(allOff)).toEqual([]);
  });

  it("shareProfile grants the Bandprofil fields", () => {
    expect(allowedDataScopes({ ...allOff, shareProfile: true })).toEqual([
      "band_name",
      "member_first_names",
      "reply_email",
      "availability",
      "budget",
      "music_profile",
    ]);
  });

  it("sharePrivate grants phone and precise_location only", () => {
    expect(allowedDataScopes({ ...allOff, sharePrivate: true })).toEqual(["phone", "precise_location"]);
  });

  it("both switches grant all eight scopes", () => {
    expect(allowedDataScopes({ ...allOff, shareProfile: true, sharePrivate: true })).toHaveLength(8);
  });

  it("contact, viewings and publishAd do not grant data scopes", () => {
    expect(allowedDataScopes({ ...allOff, contact: true, viewings: true, publishAd: true })).toEqual([]);
  });
});

describe("autonomyHash", () => {
  it("is stable for equal rules", async () => {
    expect(await autonomyHash(DEFAULT_AUTONOMY_RULES)).toBe(await autonomyHash({ ...DEFAULT_AUTONOMY_RULES }));
    expect(await autonomyHash(DEFAULT_AUTONOMY_RULES)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is independent of key order", async () => {
    const reordered = {
      sharePrivate: false,
      shareProfile: true,
      publishAd: false,
      viewings: true,
      contact: true,
      mode: "autopilot",
    } as AutonomyRules;
    expect(await autonomyHash(reordered)).toBe(await autonomyHash(DEFAULT_AUTONOMY_RULES));
  });

  it("changes when any field changes", async () => {
    const base = await autonomyHash(DEFAULT_AUTONOMY_RULES);
    for (const key of ["contact", "viewings", "publishAd", "shareProfile", "sharePrivate"] as const) {
      expect(await autonomyHash({ ...DEFAULT_AUTONOMY_RULES, [key]: !DEFAULT_AUTONOMY_RULES[key] })).not.toBe(base);
    }
    expect(await autonomyHash({ ...DEFAULT_AUTONOMY_RULES, mode: "review" })).not.toBe(base);
  });
});

describe("normalizeAutonomyRules", () => {
  it("keeps only the six fields", () => {
    const row = { ...DEFAULT_AUTONOMY_RULES, _id: "x", version: 3, ownerId: "u" };
    expect(normalizeAutonomyRules(row)).toEqual(DEFAULT_AUTONOMY_RULES);
  });
});
