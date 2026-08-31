import type { MandateActionType, ScoutMandate } from "./types";

export const hardHumanActionTypes = [
  "accept_terms",
  "accept_contract",
  "confirm_booking",
  "make_payment",
  "pay_deposit",
  "enter_password",
  "complete_2fa",
  "solve_captcha",
] as const satisfies readonly MandateActionType[];

const researchActionTypes = [
  "browse_public",
  "browse_connected",
  "read_messages",
  "extract_facts",
] as const satisfies readonly MandateActionType[];

export function isHardHumanAction(actionType: MandateActionType): boolean {
  return hardHumanActionTypes.includes(actionType as (typeof hardHumanActionTypes)[number]);
}

export function canMandateAuthorize(
  mandate: ScoutMandate,
  actionType: MandateActionType,
  now = Date.now(),
): boolean {
  if (!mandate.persisted || mandate.version === undefined || mandate.status !== "active") return false;
  if (!mandate.killSwitchEnabled || (mandate.expiresAt !== undefined && mandate.expiresAt <= now)) return false;
  if (isHardHumanAction(actionType) || !mandate.allowedActionTypes.includes(actionType)) return false;
  if (mandate.mode === "guided") return false;
  if (mandate.mode === "research") {
    return researchActionTypes.includes(actionType as (typeof researchActionTypes)[number]);
  }
  return mandate.mode === "outreach" || mandate.mode === "negotiation";
}

export function mandateRequiresExactApproval(
  mandate: ScoutMandate,
  actionType: MandateActionType,
  now = Date.now(),
): boolean {
  return !canMandateAuthorize(mandate, actionType, now);
}
