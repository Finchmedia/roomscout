import { v } from "convex/values";
import type { ProviderAssessment } from "./providerAssessment";

export const candidateDispositionValidator = v.union(v.literal("active"), v.literal("above_budget"), v.literal("not_fit"));
export const candidateExclusionReasonValidator = v.union(
  v.literal("unavailable"), v.literal("schedule"), v.literal("requirements"), v.literal("closed"), v.literal("not_fit"),
);

/** Assessment is supplied only when its conversation, search and listing revisions are current. */
export function candidateDisposition(args: {
  closed: boolean;
  assessment?: ProviderAssessment;
  maxBudgetEur?: number;
  indexedAboveBudget: boolean;
}): { disposition: "active" | "above_budget" | "not_fit"; exclusionReason?: "unavailable" | "schedule" | "requirements" | "closed" | "not_fit" } {
  const assessment = args.assessment;
  if (assessment?.availability.status === "unavailable") return { disposition: "not_fit", exclusionReason: "unavailable" };
  const terminal = assessment && ["decline", "stop"].includes(assessment.nextAction);
  const conflicts = assessment?.constraints.filter(item => item.verdict === "conflict") ?? [];
  if (terminal && conflicts.some(item => item.key === "schedule")) return { disposition: "not_fit", exclusionReason: "schedule" };
  if (terminal && conflicts.some(item => item.key.startsWith("requirement:"))) return { disposition: "not_fit", exclusionReason: "requirements" };
  // Closed history remains readable, but is no longer part of the running search.
  if (args.closed) return { disposition: "not_fit", exclusionReason: "closed" };
  const price = assessment?.monthlyPrice.totalEur;
  const aboveBudget = args.indexedAboveBudget || (price !== null && price !== undefined && args.maxBudgetEur !== undefined && price > args.maxBudgetEur);
  if (aboveBudget && (!terminal || conflicts.every(item => item.key === "budget"))) return { disposition: "above_budget" };
  if (terminal) return { disposition: "not_fit", exclusionReason: "not_fit" };
  // An unresolved alternative being put to the musician is still in play.
  return { disposition: "active" };
}
