/**
 * Handlungsspielraum — the user's rules for how independently the Scout works.
 *
 * Pure module: no Convex ctx. `convex/autonomy.ts` stores one row per user
 * (ADR 0001) and later slices derive the Freigabeprüfung from these helpers.
 * Daily limits are deliberately absent (ADR 0002).
 */

import { v, type Infer } from "convex/values";
import { contentHash } from "../integrations/contentHash";
import type {
  ExternalActionType,
  PersonalDataScope,
} from "./mandateAuthorization";

export type AutonomyMode = "autopilot" | "review";

export const autonomyRulesValidator = v.object({
  mode: v.union(v.literal("autopilot"), v.literal("review")),
  contact: v.boolean(),
  viewings: v.boolean(),
  publishAd: v.boolean(),
  shareProfile: v.boolean(),
  sharePrivate: v.boolean(),
});

export type AutonomyRules = Infer<typeof autonomyRulesValidator>;

/** What a user without a `scoutAutonomy` row gets. */
export const DEFAULT_AUTONOMY_RULES: AutonomyRules = {
  mode: "autopilot",
  contact: true,
  viewings: true,
  publishAd: false,
  shareProfile: true,
  sharePrivate: false,
};

/** Fixed field order — the canonical form the hash and every comparison use. */
const RULE_FIELDS = [
  "mode",
  "contact",
  "viewings",
  "publishAd",
  "shareProfile",
  "sharePrivate",
] as const satisfies readonly (keyof AutonomyRules)[];

/** Copies the six fields in canonical order; drops anything else the caller carried. */
export function normalizeAutonomyRules(rules: AutonomyRules): AutonomyRules {
  return {
    mode: rules.mode,
    contact: rules.contact,
    viewings: rules.viewings,
    publishAd: rules.publishAd,
    shareProfile: rules.shareProfile,
    sharePrivate: rules.sharePrivate,
  };
}

/**
 * Outbound action types the rules permit. `create_portal_account` is always
 * allowed: registering the Scout on a portal is not outbound communication.
 */
export function allowedActions(rules: AutonomyRules): ExternalActionType[] {
  const actions: ExternalActionType[] = ["create_portal_account"];
  if (rules.contact) {
    actions.push("send_email", "submit_webform", "send_platform_dm");
  }
  if (rules.viewings) actions.push("propose_visit_time");
  if (rules.publishAd) actions.push("publish_listing");
  if (rules.sharePrivate) actions.push("share_contact_details");
  return actions;
}

/** Datenfelder the Scout may share: Bandprofil via `shareProfile`, Privat via `sharePrivate`. */
export function allowedDataScopes(rules: AutonomyRules): PersonalDataScope[] {
  const scopes: PersonalDataScope[] = [];
  if (rules.shareProfile) {
    scopes.push(
      "band_name",
      "member_first_names",
      "reply_email",
      "availability",
      "budget",
      "music_profile",
    );
  }
  if (rules.sharePrivate) scopes.push("phone", "precise_location");
  return scopes;
}

/** Stable hash of the six fields in fixed order; independent of object key order. */
export async function autonomyHash(rules: AutonomyRules): Promise<string> {
  return contentHash(RULE_FIELDS.map((field) => `${field}=${String(rules[field])}`));
}
