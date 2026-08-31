import { AlertTriangle, ExternalLink, Play, ShieldCheck } from "lucide-react";
import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatAge, toneForStatus, titleCase } from "../../routes/ops/opsFormat";
import { EmptyState, LedgerCard } from "../ui/LedgerCard";

const candidateStatuses = ["new", "reviewing", "promoted", "ignored", "merged"] as const;
type CandidateStatus = (typeof candidateStatuses)[number];

const probeStatuses = ["queued", "running", "blocked", "failed", "partial", "succeeded"] as const;
type ProbeStatus = (typeof probeStatuses)[number];

type PlatformId = Id<"sourcePlatforms">;

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "The operation failed.";
}

export function SourceIntelligencePanel() {
  const [candidateStatus, setCandidateStatus] = useState<CandidateStatus>("new");
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>("failed");
  const [selectedPlatformId, setSelectedPlatformId] = useState<PlatformId>();
  const [discoveryCursor, setDiscoveryCursor] = useState(0);
  const [sourceAccessMode, setSourceAccessMode] = useState<"public" | "authenticated">("public");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  const platforms = usePaginatedQuery(
    api.sourceIntelligence.listPlatforms,
    {},
    { initialNumItems: 30 },
  );
  const candidates = usePaginatedQuery(
    api.sourceIntelligence.listCandidates,
    { status: candidateStatus },
    { initialNumItems: 30 },
  );
  const probeRuns = usePaginatedQuery(
    api.sourceProbes.listRuns,
    { status: probeStatus },
    { initialNumItems: 20 },
  );
  const approvedPolicies = usePaginatedQuery(
    api.sourcePolicies.listForPlatform,
    selectedPlatformId
      ? { platformId: selectedPlatformId, status: "approved" as const }
      : "skip",
    { initialNumItems: 25 },
  );
  const draftPolicies = usePaginatedQuery(
    api.sourcePolicies.listForPlatform,
    selectedPlatformId
      ? { platformId: selectedPlatformId, status: "draft" as const }
      : "skip",
    { initialNumItems: 25 },
  );
  const listingAdapters = usePaginatedQuery(
    api.sourceAdapters.listForPlatform,
    selectedPlatformId
      ? { platformId: selectedPlatformId, flow: "listing" as const, status: "active" as const }
      : "skip",
    { initialNumItems: 20 },
  );
  const contactAdapters = usePaginatedQuery(
    api.sourceAdapters.listForPlatform,
    selectedPlatformId
      ? { platformId: selectedPlatformId, flow: "contact" as const, status: "active" as const }
      : "skip",
    { initialNumItems: 20 },
  );
  const authAdapters = usePaginatedQuery(
    api.sourceAdapters.listForPlatform,
    selectedPlatformId
      ? { platformId: selectedPlatformId, flow: "auth" as const, status: "active" as const }
      : "skip",
    { initialNumItems: 20 },
  );

  const runGermanySlice = useAction(api.sourceDiscoveryActions.runGermanySlice);
  const promoteCandidate = useMutation(api.sourceIntelligence.promoteCandidate);
  const ensureSourceForPlatform = useMutation(api.sourceIntelligence.ensureSourceForPlatform);
  const approvePolicy = useMutation(api.sourcePolicies.approve);
  const createPolicyDraft = useMutation(api.sourcePolicies.createDraft);
  const upsertBinding = useMutation(api.sourceAdapters.upsertBinding);

  const selectedPlatform = useMemo(
    () => platforms.results.find((platform) => platform.id === selectedPlatformId),
    [platforms.results, selectedPlatformId],
  );
  const adapters = [
    ...listingAdapters.results,
    ...contactAdapters.results,
    ...authAdapters.results,
  ];

  async function run(label: string, operation: () => Promise<unknown>) {
    setWorking(label);
    setNotice("");
    try {
      await operation();
      setNotice(`${label} completed.`);
    } catch (error) {
      setNotice(safeError(error));
    } finally {
      setWorking("");
    }
  }

  async function discoverNextSlice() {
    const label = "Bounded Germany discovery";
    setWorking(label);
    setNotice("");
    try {
      const result = await runGermanySlice({
        cursor: discoveryCursor,
        queryLimit: 1,
        resultsPerQuery: 5,
      });
      setDiscoveryCursor(result.nextCursor ?? 0);
      setNotice(
        `${result.queriesAttempted} query · ${result.candidatesSeen} candidates observed · ${result.candidatesCreated} new.`,
      );
    } catch (error) {
      setNotice(safeError(error));
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="stack">
      <LedgerCard
        accent
        header={
          <>
            <span className="type t-scout">Source intelligence</span>
            <span className="mono">Firecrawl discovery · reviewed promotion</span>
          </>
        }
      >
        <div className="rs-ops-commandbar">
          <div>
            <strong>Germany source-discovery cursor {discoveryCursor}</strong>
            <p>
              Runs exactly one search query with at most five results. Candidates stay in review and never become live sources automatically.
            </p>
          </div>
          <button
            className="btn btn-p btn-sm"
            disabled={Boolean(working)}
            onClick={() => void discoverNextSlice()}
            type="button"
          >
            <Play aria-hidden="true" size={13} />
            Run next bounded slice
          </button>
        </div>
        {notice ? <p className="rs-memory-notice" role="status">{notice}</p> : null}
      </LedgerCard>

      <div className="cols rs-source-intelligence-grid">
        <LedgerCard
          header={
            <>
              <span className="type">Platform directory</span>
              <span className="mono">{platforms.results.length} loaded</span>
            </>
          }
        >
          {platforms.status === "LoadingFirstPage" ? (
            <EmptyState body="Reading the canonical platform directory." title="Loading platforms…" />
          ) : platforms.results.length === 0 ? (
            <EmptyState body="Promote reviewed discovery candidates to establish the platform directory." title="No platforms yet" />
          ) : (
            <div className="rs-queue-list">
              {platforms.results.map((platform) => (
                <button
                  className={`qrow rs-queue-button${platform.id === selectedPlatformId ? " on" : ""}`}
                  key={platform.id}
                  onClick={() => setSelectedPlatformId(platform.id)}
                  type="button"
                >
                  <span className="t">
                    <strong>{platform.name}</strong>
                    <span className="mono">{platform.canonicalDomain} · {titleCase(platform.kind)}</span>
                  </span>
                  <span className={`pill ${toneForStatus(platform.status)}`}>{titleCase(platform.status)}</span>
                </button>
              ))}
              {platforms.status === "CanLoadMore" ? (
                <button className="btn btn-g btn-sm" onClick={() => platforms.loadMore(30)} type="button">Load more platforms</button>
              ) : null}
            </div>
          )}
        </LedgerCard>

        <LedgerCard
          header={
            <>
              <span className="type">Candidate review</span>
              <span className="mono">{candidates.results.length} loaded</span>
            </>
          }
        >
          <div className="filters rs-ops-filters rs-ops-compact-filters">
            {candidateStatuses.map((status) => (
              <button
                aria-pressed={candidateStatus === status}
                className={`fchip${candidateStatus === status ? " on" : ""}`}
                key={status}
                onClick={() => setCandidateStatus(status)}
                type="button"
              >
                {titleCase(status)}
              </button>
            ))}
          </div>
          {candidates.status === "LoadingFirstPage" ? (
            <EmptyState body="Reading discovered domains from Convex." title="Loading candidates…" />
          ) : candidates.results.length === 0 ? (
            <EmptyState body="No source candidates match this review state." title="Candidate queue is empty" />
          ) : (
            <div className="rs-queue-list">
              {candidates.results.map((candidate) => (
                <div className="qrow rs-source-candidate" key={candidate.id}>
                  <span className="t">
                    <strong>{candidate.name}</strong>
                    <span className="mono">{candidate.canonicalDomain} · {titleCase(candidate.side)} · {Math.round(candidate.confidence * 100)}%</span>
                    <span>{candidate.snippet || "No retained discovery snippet."}</span>
                  </span>
                  <div className="actionsrow">
                    <a aria-label={`Open ${candidate.name}`} className="btn btn-g btn-sm" href={candidate.canonicalUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={12} /></a>
                    {candidate.status === "new" || candidate.status === "reviewing" ? (
                      <button
                        className="btn btn-s btn-sm"
                        disabled={Boolean(working)}
                        onClick={() => void run("Candidate promotion", async () => {
                          const result = await promoteCandidate({ candidateId: candidate.id, kind: "other" });
                          setSelectedPlatformId(result.platformId);
                        })}
                        type="button"
                      >
                        Promote to reviewing
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {candidates.status === "CanLoadMore" ? (
                <button className="btn btn-g btn-sm" onClick={() => candidates.loadMore(30)} type="button">Load more candidates</button>
              ) : null}
            </div>
          )}
        </LedgerCard>
      </div>

      <LedgerCard
        header={
          <>
            <span className="type">Platform transaction map</span>
            <span className="mono">{selectedPlatform?.name ?? "Select a platform"}</span>
          </>
        }
      >
        {!selectedPlatformId ? (
          <EmptyState body="Select a platform above to inspect its versioned policies and executable adapter bindings." title="No platform selected" />
        ) : (
          <div className="stack">
            <div className="rs-ops-commandbar">
              <div><strong>Create its reviewed source definition</strong><p>Public sources can feed monitors. Authenticated sources become independently connectable Browserbase contexts after operator review.</p></div>
              <div className="actionsrow">
                <button aria-pressed={sourceAccessMode === "public"} className={`fchip${sourceAccessMode === "public" ? " on" : ""}`} onClick={() => setSourceAccessMode("public")} type="button">Public</button>
                <button aria-pressed={sourceAccessMode === "authenticated"} className={`fchip${sourceAccessMode === "authenticated" ? " on" : ""}`} onClick={() => setSourceAccessMode("authenticated")} type="button">Authenticated portal</button>
                <button className="btn btn-s btn-sm" disabled={Boolean(working)} onClick={() => void run("Source definition", () => ensureSourceForPlatform({ platformId: selectedPlatformId, side: "both", accessMode: sourceAccessMode }))} type="button">Create/reuse source</button>
              </div>
            </div>
          <div className="rs-ops-detail-columns">
            <section>
              <h3>Approved policies</h3>
              {approvedPolicies.results.length === 0 ? <p className="hint">No approved flow policy.</p> : (
                <table className="facts"><tbody>
                  {approvedPolicies.results.map((policy) => (
                    <tr key={policy.id}><td>{titleCase(policy.flow)} · v{policy.version}</td><td><span className={`pill ${policy.decision === "allowed" ? "new" : "warn"}`}>{titleCase(policy.decision)}</span> {titleCase(policy.maxAutomationLevel)}{selectedPlatform?.canonicalDomain === "bandnet.hamburg" && policy.flow === "contact" ? <button className="btn btn-g btn-sm" disabled={Boolean(working)} onClick={() => void run("Bandnet contact adapter", () => upsertBinding({ platformId: selectedPlatformId, flow: "contact", adapterKey: "bandnet-contact-form-v1", executor: "firecrawl", config: { kind: "firecrawl", extractionProfileKey: "bandnet-contact-form-v1", monitorDriven: false }, configFingerprint: "bandnet-contact-form-v1:1", policyVersionId: policy.id }))} type="button">Bind reviewed form</button> : null}</td></tr>
                  ))}
                </tbody></table>
              )}
            </section>
            <section>
              <h3>Draft policies</h3>
              {selectedPlatform?.canonicalDomain === "bandnet.hamburg" && draftPolicies.results.length === 0 && approvedPolicies.results.every((policy) => policy.flow !== "contact") ? <button className="btn btn-s btn-sm" disabled={Boolean(working)} onClick={() => void run("Bandnet contact policy draft", () => createPolicyDraft({ platformId: selectedPlatformId, flow: "contact", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: true, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", retentionDays: 30, evidenceUrls: ["https://bandnet.hamburg/robots.txt", "https://bandnet.hamburg/nutzungsbedingungen"], nextReviewAt: Date.now() + 30 * 24 * 60 * 60 * 1_000 }))} type="button">Create Bandnet review draft — verify evidence</button> : null}
              {draftPolicies.results.length === 0 ? <p className="hint">No policy awaits approval.</p> : (
                <div className="rs-queue-list">
                  {draftPolicies.results.map((policy) => (
                    <div className="qrow" key={policy.id}>
                      <span className="t"><strong>{titleCase(policy.flow)} · v{policy.version}</strong><span className="mono">{titleCase(policy.decision)} · {titleCase(policy.maxAutomationLevel)}</span>{policy.evidenceUrls.map((url) => <a href={url} key={url} rel="noreferrer" target="_blank">Review evidence</a>)}</span>
                      <button className="btn btn-s btn-sm" disabled={Boolean(working)} onClick={() => void run("Policy approval", () => approvePolicy({ policyId: policy.id }))} type="button"><ShieldCheck aria-hidden="true" size={12} />Approve</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h3>Active adapter bindings</h3>
              {adapters.length === 0 ? <p className="hint">No listing, contact, or auth adapter is active.</p> : (
                <table className="facts"><tbody>
                  {adapters.map((adapter) => (
                    <tr key={adapter.id}><td>{titleCase(adapter.flow)}</td><td>{titleCase(adapter.executor)} · {adapter.adapterKey} v{adapter.adapterVersion}</td></tr>
                  ))}
                </tbody></table>
              )}
            </section>
          </div>
          </div>
        )}
      </LedgerCard>

      <LedgerCard
        header={
          <>
            <span className="type">Read-only flow probes</span>
            <span className="mono">Stored run outcomes</span>
          </>
        }
      >
        <div className="filters rs-ops-filters rs-ops-compact-filters">
          {probeStatuses.map((status) => (
            <button aria-pressed={probeStatus === status} className={`fchip${probeStatus === status ? " on" : ""}`} key={status} onClick={() => setProbeStatus(status)} type="button">{titleCase(status)}</button>
          ))}
        </div>
        {probeRuns.status === "LoadingFirstPage" ? (
          <EmptyState body="Reading bounded, read-only source probes." title="Loading probe runs…" />
        ) : probeRuns.results.length === 0 ? (
          <EmptyState body="No stored probe run matches this state." title="Probe queue is empty" />
        ) : (
          <div className="lcard rs-review-table-wrap">
            <table className="q rs-review-table">
              <thead><tr><th>Run</th><th>Trigger</th><th>Observed</th><th>Result</th><th>Updated</th></tr></thead>
              <tbody>{probeRuns.results.map((probe) => (
                <tr key={probe.id}><td className="mono">{probe.id.slice(-8)}</td><td>{titleCase(probe.trigger)}</td><td>{probe.itemsObserved ?? "—"}</td><td><span className={`pill ${toneForStatus(probe.status)}`}>{titleCase(probe.status)}</span>{probe.error ? <span className="mono"><AlertTriangle aria-hidden="true" size={11} /> {probe.error}</span> : null}</td><td className="mono">{formatAge(probe.updatedAt)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </LedgerCard>
    </div>
  );
}
