import type { Doc, Id } from "../../../convex/_generated/dataModel";

export type ScoutFact = {
  key: string;
  label: string;
  value: string;
};

export type ScoutWorkspaceMode =
  "discovery" | "waiting" | "attention" | "results" | "paused";

type MatchProjection = {
  signalId: Id<"signals">;
  reasons: string[];
  uncertainties: string[];
};

type OpportunityProjection = {
  status:
    | "new"
    | "reviewing"
    | "saved"
    | "dismissed"
    | "contacted"
    | "converted"
    | "expired";
  uncertainties: string[];
};

const arrangementLabels: Record<
  Doc<"savedNeeds">["arrangement"][number],
  string
> = {
  permanent: "Permanent room",
  shared: "Shared room",
  hourly: "Hourly room",
};

export function factsFromNeed(need: Doc<"savedNeeds">): ScoutFact[] {
  const facts: ScoutFact[] = [];
  const location = [need.city, ...need.districts].filter(Boolean).join(" · ");
  if (location)
    facts.push({ key: "location", label: "Location", value: location });
  if (need.arrangement.length)
    facts.push({
      key: "arrangement",
      label: "Arrangement",
      value: need.arrangement
        .map((value) => arrangementLabels[value])
        .join(" · "),
    });
  if (need.maxBudgetEur !== undefined)
    facts.push({
      key: "budget",
      label: "Budget",
      value: `Up to €${need.maxBudgetEur} / month`,
    });
  if (need.radiusKm !== undefined)
    facts.push({
      key: "radius",
      label: "Radius",
      value: `${need.radiusKm} km`,
    });
  if (need.schedule.length)
    facts.push({
      key: "schedule",
      label: "Schedule",
      value: need.schedule.join(" · "),
    });
  if (need.requirements.length)
    facts.push({
      key: "requirements",
      label: "Essential",
      value: need.requirements.join(" · "),
    });
  if (need.openToSharing !== undefined)
    facts.push({
      key: "sharing",
      label: "Sharing",
      value: need.openToSharing
        ? "Open to a compatible band"
        : "Not looking to share",
    });
  if (need.genres?.length)
    facts.push({
      key: "music",
      label: "Music",
      value: need.genres.join(" · "),
    });
  if (need.instruments?.length)
    facts.push({
      key: "instruments",
      label: "Instruments",
      value: need.instruments.join(" · "),
    });
  if (need.collaborationOpen !== undefined)
    facts.push({
      key: "connections",
      label: "Connections",
      value: need.collaborationOpen
        ? "Open to band connections"
        : "Room search only",
    });
  // New constraints remain visible without expanding a closed list of UI fields.
  for (const facet of need.facets ?? []) {
    const value = Array.isArray(facet.value)
      ? facet.value.join(" · ")
      : typeof facet.value === "boolean"
        ? facet.value ? "Ja" : "Nein"
        : String(facet.value);
    if (!value) continue;
    facts.push({
      key: `facet:${facet.namespace}:${facet.key}`,
      label: facet.key.replace(/[_-]/g, " "),
      value: facet.confidence < 0.75 ? `${value} · noch zu klären` : value,
    });
  }
  return facts;
}

export function getScoutWorkspaceMode(
  need: Doc<"savedNeeds">,
  matches: MatchProjection[] | undefined,
  opportunities: OpportunityProjection[] | undefined,
): ScoutWorkspaceMode {
  if (need.status === "draft") return "discovery";
  if (need.status === "paused") return "paused";
  if (
    opportunities?.some(
      (row) =>
        ["new", "reviewing", "contacted"].includes(row.status) &&
        row.uncertainties.length > 0,
    )
  )
    return "attention";
  if (matches?.length) return "results";
  return "waiting";
}

export function activeMatchCount(
  matches: MatchProjection[] | undefined,
): number {
  return matches?.length ?? 0;
}
