import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ScoutMandate } from "../../features/agentOperations/types";
import { MandatePanel } from "../mandate/MandatePanel";
import { SearchSourcesPanel } from "../search/SearchSourcesPanel";
import { EmptyState } from "../ui/LedgerCard";

function coverageStatus(source: {
  supplyStatus?: string;
  demandStatus?: string;
  platformStatus: string;
}) {
  const states = [source.supplyStatus, source.demandStatus].filter(Boolean);
  if (source.platformStatus === "active")
    return states.some((state) => state === "verified" || state === "probed")
      ? ("watching" as const)
      : ("partial" as const);
  return source.platformStatus === "candidate" ||
    source.platformStatus === "reviewing"
    ? ("under_review" as const)
    : ("unavailable" as const);
}

export function SearchControlSettings({
  view,
}: {
  view: "autonomy" | "sources";
}) {
  const [defaultExpiry] = useState(() => Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [sourceError, setSourceError] = useState("");
  const [sourceWorking, setSourceWorking] = useState<string>();
  const needs = useQuery(api.savedNeeds.listMine, { limit: 10 });
  const scoutContext = useQuery(api.scout.getMine);
  const need =
    needs !== undefined && scoutContext !== undefined
      ? (needs.find(
          (candidate) =>
            candidate._id === scoutContext?.activeNeedId &&
            candidate.status !== "archived",
        ) ?? needs.find((candidate) => candidate.status !== "archived"))
      : undefined;
  const coverage = useQuery(
    api.searchSources.listForNeed,
    need ? { savedNeedId: need._id, limit: 100 } : "skip",
  );
  const signals = useQuery(
    api.signals.list,
    need?.locationQuery ? { city: need.locationQuery, limit: 50 } : "skip",
  );
  const activeMandate = useQuery(
    api.mandates.getActiveMine,
    need ? { savedNeedId: need._id } : "skip",
  );
  const setSourcePreference = useMutation(api.searchSources.setPreference);
  const createMandateDraft = useMutation(api.mandates.createDraft);
  const activateMandate = useMutation(api.mandates.activate);
  const enableDefaultAutopilot = useMutation(
    api.mandates.enableDefaultAutopilot,
  );
  const revokeMandate = useMutation(api.mandates.revoke);
  const killMandates = useMutation(api.mandates.killSwitch);

  if (
    needs === undefined ||
    scoutContext === undefined ||
    (need && coverage === undefined)
  )
    return (
      <EmptyState
        body="Reading your active search and its live authorization state."
        title="Loading search controls…"
      />
    );
  if (!need)
    return (
      <>
        <EmptyState
          body="Source preferences and mandates belong to a concrete search, so RoomScout will not create global permissions without one."
          title="Create a search first"
        />
        <Link className="btn btn-p" to="/app/scout?mode=search_discovery">
          Start with your Scout
        </Link>
      </>
    );
  const savedNeed = need;

  const sources = (coverage?.sources ?? []).map((source) => ({
    id: source.platformId,
    name: source.name,
    domain: source.domain,
    side:
      source.supplyStatus && source.demandStatus
        ? ("both" as const)
        : source.supplyStatus
          ? ("supply" as const)
          : ("demand" as const),
    status: coverageStatus(source),
    access: "public" as const,
    included: source.preference !== "exclude",
    lastCheckedLabel: source.lastObservedAt
      ? new Date(source.lastObservedAt).toLocaleString()
      : undefined,
    note: `${[source.supplyStatus, source.demandStatus].filter(Boolean).join(" + ") || "Coverage unavailable"} · ${Math.round(source.confidence * 100)}% confidence`,
  }));

  if (view === "sources") {
    const maxEvidenceSources = Math.max(
      0,
      ...(signals ?? []).map((signal) => signal.sourceCount),
    );
    async function changeSource(platformId: string, included: boolean) {
      setSourceWorking(platformId);
      setSourceError("");
      try {
        await setSourcePreference({
          savedNeedId: savedNeed._id,
          platformId: platformId as Id<"sourcePlatforms">,
          preference: included ? "include" : "exclude",
        });
      } catch {
        setSourceError(
          "The source preference could not be saved. Your previous setting is still in effect.",
        );
      } finally {
        setSourceWorking(undefined);
      }
    }
    return (
      <div className="stack">
        {sourceError ? (
          <p className="rs-form-error" role="alert">
            {sourceError}
          </p>
        ) : null}
        <SearchSourcesPanel
          city={need.locationLabel ?? need.locationQuery ?? "this area"}
          disclosure={`${coverage?.disclosure ?? "Coverage is based on reviewed sources."} Signal totals are a bounded sample of up to 50 city results; evidence sources is the largest source count attached to one result, not a market-wide total.`}
          indexedSignalCount={signals?.length ?? 0}
          indexedSourceCount={maxEvidenceSources}
          onScopeChange={(platformId, included) =>
            void changeSource(platformId, included)
          }
          sources={sources}
          workingSourceId={sourceWorking}
        />
      </div>
    );
  }

  const mandate: ScoutMandate = activeMandate
    ? {
        id: activeMandate._id,
        contentHash: activeMandate.contentHash,
        mode:
          activeMandate.mode === "research_autopilot"
            ? "research"
            : activeMandate.mode === "outreach_autopilot"
              ? "outreach"
              : activeMandate.mode === "negotiation_autopilot"
                ? "negotiation"
                : "guided",
        status: "active",
        version: activeMandate.version,
        goal: need.title,
        sourceAllowlist: sources
          .filter((source) => source.included)
          .map((source) => source.domain),
        platformAllowlist: activeMandate.platformIds,
        allowedActionTypes: activeMandate.allowedActionTypes.map((action) =>
          action === "propose_visit_time" ? ("propose_visit" as const) : action,
        ),
        dataScopes: activeMandate.allowedPersonalData,
    dailyContactLimit: activeMandate.maxContactsPerDay,
    dailyBrowserMinutes: activeMandate.maxBrowserMinutesPerDay,
    usesDefaultUnlimitedUsage: activeMandate.usesDefaultUnlimitedUsage,
        maxMonthlyPriceEur: activeMandate.maxMonthlyPriceEur,
        expiresAt: activeMandate.expiresAt,
        killSwitchEnabled: true,
        stopConditions: [
          activeMandate.stopOnComplaint
            ? "A complaint is received"
            : "Complaint stop disabled",
          activeMandate.stopWhenSuitableRoomConfirmed
            ? "A suitable room is confirmed"
            : "Confirmation stop disabled",
        ],
        persisted: true,
      }
    : {
        mode: "negotiation",
        status: "draft",
        goal: need.title,
        sourceAllowlist: sources
          .filter((source) => source.included)
          .map((source) => source.domain),
        platformAllowlist: sources
          .filter((source) => source.included)
          .map((source) => source.id),
        allowedActionTypes: [
          "send_email",
          "submit_webform",
          "send_platform_dm",
          "create_portal_account",
          "publish_listing",
          "propose_visit",
        ],
        dataScopes: [
          "band_name",
          "reply_email",
          "availability",
          "budget",
          "music_profile",
        ],
        dailyContactLimit: 10,
        dailyBrowserMinutes: 30,
        maxMonthlyPriceEur: need.maxBudgetEur,
        expiresAt: defaultExpiry,
        killSwitchEnabled: true,
        stopConditions: [
          "Search is paused",
          "A human-only step is required",
          "A suitable room reaches agreement handoff",
        ],
        persisted: false,
      };

  async function save(next: ScoutMandate) {
    const mode =
      next.mode === "research"
        ? ("research_autopilot" as const)
        : next.mode === "outreach"
          ? ("outreach_autopilot" as const)
          : next.mode === "negotiation"
            ? ("negotiation_autopilot" as const)
            : ("guided" as const);
    const allowedActionTypes = next.allowedActionTypes
      .filter((action) =>
        [
          "send_email",
          "submit_webform",
          "send_platform_dm",
          "create_portal_account",
          "publish_listing",
          "share_contact_details",
          "propose_visit",
        ].includes(action),
      )
      .map((action) =>
        action === "propose_visit"
          ? ("propose_visit_time" as const)
          : (action as
              | "send_email"
              | "submit_webform"
              | "send_platform_dm"
              | "create_portal_account"
              | "publish_listing"
              | "share_contact_details"),
      );
    const allowedPersonalData = next.dataScopes.filter((scope) =>
      [
        "band_name",
        "member_first_names",
        "reply_email",
        "phone",
        "precise_location",
        "availability",
        "budget",
        "music_profile",
      ].includes(scope),
    ) as Array<
      | "band_name"
      | "member_first_names"
      | "reply_email"
      | "phone"
      | "precise_location"
      | "availability"
      | "budget"
      | "music_profile"
    >;
    const created = await createMandateDraft({
      savedNeedId: savedNeed._id,
      mode,
      platformIds: next.platformAllowlist.map(
        (id) => id as Id<"sourcePlatforms">,
      ),
      allowedActionTypes:
        mode === "guided" || mode === "research_autopilot"
          ? []
          : allowedActionTypes,
      allowedPersonalData,
      maxContactsPerDay: Math.max(0, Math.floor(next.dailyContactLimit)),
      maxBrowserMinutesPerDay: Math.max(
        0,
        Math.floor(next.dailyBrowserMinutes),
      ),
      maxMonthlyPriceEur: next.maxMonthlyPriceEur,
      expiresAt: next.expiresAt ?? defaultExpiry,
      stopOnComplaint: true,
      stopWhenSuitableRoomConfirmed: true,
    });
    await activateMandate({
      mandateId: created.mandateId,
      expectedContentHash: created.contentHash,
    });
  }

  return (
    <MandatePanel
      mandate={mandate}
      onSave={save}
      onStatusChange={async (status) => {
        if (status === "killed")
          await killMandates({ savedNeedId: savedNeed._id });
        else if (status === "paused" && activeMandate)
          await revokeMandate({ mandateId: activeMandate._id });
        else if (status === "active")
          await enableDefaultAutopilot({ savedNeedId: savedNeed._id });
      }}
      platformOptions={sources.map((source) => ({
        id: source.id,
        label: source.name,
      }))}
    />
  );
}
