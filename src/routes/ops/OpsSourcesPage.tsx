import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { PortalOperationsPanel } from "../../components/ops/PortalOperationsPanel";
import { SourceIntelligencePanel } from "../../components/ops/SourceIntelligencePanel";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { formatAge, formatDuration, toneForStatus, titleCase } from "./opsFormat";

export function OpsSourcesPage() {
  const sources = useQuery(api.ops.listSources, { limit: 40 });
  const seedSources = useMutation(api.sourceRegistry.seedReviewSources);
  const reviewSource = useMutation(api.sourceRegistry.reviewSource);
  const setSourceActive = useMutation(api.sourceRegistry.setSourceActive);
  const syncMonitors = useMutation(api.sourceRegistry.syncMonitors);
  const continueBacklog = useMutation(api.sourceRegistry.continueBacklog);
  const runMonitorNow = useAction(api.opsActions.runMonitorNow);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  async function run(label: string, operation: () => Promise<unknown>) {
    setWorking(label);
    setMessage("");
    try {
      await operation();
      setMessage(`${label} queued successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setWorking("");
    }
  }

  return (
    <WorkspaceShell mode="ops">
      <PageHeader
        meta={<span className="rs-page-meta"><span className="chip">Live source graph</span><span className="mono">Discovery → policy → adapter → run</span></span>}
        title="Sources & portals"
      />
      <div className="stack">
      <SourceIntelligencePanel />
      <PortalOperationsPanel />
      <LedgerCard header={<><span className="type">Legacy monitor registry</span><span className="mono">Firecrawl Native Monitoring</span></>}>
      <div className="actionsrow">
        <button className="btn btn-s" disabled={Boolean(working)} onClick={() => void run("Seed review sources", seedSources)} type="button">Seed review sources</button>
        <button className="btn btn-s" disabled={Boolean(working)} onClick={() => void run("Monitor sync", syncMonitors)} type="button">Sync monitors</button>
        <button className="btn btn-g" disabled={Boolean(working)} onClick={() => void run("Backlog continuation", continueBacklog)} type="button">Continue bounded backlog</button>
      </div>
      {message ? <p className="rs-memory-notice" role="status">{message}</p> : null}
      {sources === undefined ? (
        <EmptyState body="Reading sources, targets, and Firecrawl monitor state." title="Loading source registry…" />
      ) : sources.length === 0 ? (
        <EmptyState body="Seed or review a source before starting a controlled monitor run." title="No sources registered" />
      ) : (
        <div className="stack">
          {sources.map((source) => (
            <LedgerCard
              header={<><span className="type">{source.name}</span><span className={`pill ${toneForStatus(source.health)}`}>{titleCase(source.health)}</span></>}
              key={source._id}
            >
              <Table className="facts">
                <TableBody>
                  <TableRow><TableCell>Scope</TableCell><TableCell>{source.geographicScope ?? "Not defined"}</TableCell></TableRow>
                  <TableRow><TableCell>Side</TableCell><TableCell>{titleCase(source.side)}</TableCell></TableRow>
                  <TableRow><TableCell>Lifecycle</TableCell><TableCell>{titleCase(source.status)}</TableCell></TableRow>
                  <TableRow><TableCell>Automation review</TableCell><TableCell>{source.automationReview ? titleCase(source.automationReview) : "Pending metadata"}</TableCell></TableRow>
                  <TableRow><TableCell>Access</TableCell><TableCell>{titleCase(source.accessMode ?? "public")}</TableCell></TableRow>
                  <TableRow><TableCell>Last source check</TableCell><TableCell>{formatAge(source.lastCheckedAt)}</TableCell></TableRow>
                </TableBody>
              </Table>
              {source.policyNotes ? <p className="fitline">{source.policyNotes}</p> : null}
              <div className="actionsrow">
                {source.automationReview !== "approved" ? (
                  <button className="btn btn-s btn-sm" disabled={Boolean(working)} onClick={() => void run("Source review", () => reviewSource({ sourceId: source._id, decision: "approved", policyNotes: source.policyNotes ?? (source.accessMode === "authenticated" ? "Authenticated portal connection scope, terms, and permitted actions reviewed by operator." : "Public access, terms, robots policy, and extraction quality reviewed by operator.") }))} type="button">Approve automation review</button>
                ) : source.accessMode === "authenticated" ? (
                  <span className="pill new">Available for reviewed portal connections</span>
                ) : source.status === "active" ? (
                  <button className="btn btn-g btn-sm" disabled={Boolean(working)} onClick={() => void run("Pause source", () => setSourceActive({ sourceId: source._id, active: false }))} type="button">Pause source</button>
                ) : (
                  <button className="btn btn-p btn-sm" disabled={Boolean(working)} onClick={() => void run("Activate source", () => setSourceActive({ sourceId: source._id, active: true }))} type="button">Activate reviewed source</button>
                )}
              </div>
              {source.targets.length === 0 ? (
                <EmptyState body="This registry record has no Firecrawl target." title="No monitor target" />
              ) : (
                <div className="lcard rs-review-table-wrap">
                  <Table className="q rs-review-table">
                    <TableHeader><TableRow><TableHead>Target</TableHead><TableHead>Monitor</TableHead><TableHead>Cadence</TableHead><TableHead>Backlog</TableHead><TableHead>Last event</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {source.targets.map((target) => {
                        const monitorState = target.monitor?.state ?? target.monitorStatus ?? "unconfigured";
                        return (
                          <TableRow key={target._id}>
                            <TableCell><a href={target.url} rel="noreferrer" target="_blank">{new URL(target.url).hostname}</a><span className="mono">{target.successfulSnapshotCount} snapshots</span></TableCell>
                            <TableCell><span className={`pill ${toneForStatus(monitorState)}`}>{titleCase(monitorState)}</span>{target.monitor?.error || target.monitorError ? <span className="mono">{target.monitor?.error ?? target.monitorError}</span> : null}{source.status === "active" && target.providerMonitorId ? <button className="btn btn-g btn-sm" disabled={Boolean(working)} onClick={() => void run("Manual monitor check", () => runMonitorNow({ sourceTargetId: target._id as Id<"sourceTargets"> }))} type="button">Run once</button> : null}</TableCell>
                            <TableCell>{formatDuration(target.scheduleMinutes)}<span className="mono">{target.paused ? "Paused" : "Scheduled"}</span></TableCell>
                            <TableCell>{target.backlogCount}</TableCell>
                            <TableCell>{formatAge(target.lastMonitorEventAt ?? target.monitor?.lastCheckAt ?? target.lastRunAt)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </LedgerCard>
          ))}
        </div>
      )}
      </LedgerCard>
      </div>
    </WorkspaceShell>
  );
}
