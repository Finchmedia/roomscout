import { CircleStop, ExternalLink, LogIn, Pause, Play, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatAge, toneForStatus, titleCase } from "../../routes/ops/opsFormat";
import { EmptyState, LedgerCard } from "../ui/LedgerCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

type ConnectionId = Id<"portalConnections">;
type RunId = Id<"browserRuns">;

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "The Browserbase operation failed.";
}

export function PortalOperationsPanel() {
  const connections = useQuery(api.portalConnections.listMine, {});
  const [selectedId, setSelectedId] = useState<ConnectionId>();
  const selected = connections?.find((connection) => connection._id === selectedId) ?? connections?.[0];
  const runs = useQuery(
    api.portalConnections.listRunsMine,
    selected ? { connectionId: selected._id } : "skip",
  );
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [liveView, setLiveView] = useState<{ runId: RunId; url: string; expiresAt: number }>();

  const pause = useMutation(api.portalConnections.pauseMine);
  const runRecon = useAction(api.browserbasePortal.runRecon);
  const startAuthentication = useAction(api.browserbasePortal.startAuthentication);
  const getLiveView = useAction(api.browserbasePortal.getLiveView);
  const resumeAuthentication = useAction(api.browserbasePortal.resumeAuthentication);
  const stopRun = useAction(api.browserbasePortal.stopRun);
  const syncInbox = useAction(api.browserbasePortal.syncInboxNow);
  const disableConnection = useAction(api.browserbasePortal.disableConnection);

  const latestHumanRun = useMemo(
    () => runs?.find((run) => run.status === "human_required"),
    [runs],
  );

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

  async function loadLiveView(runId: RunId) {
    setWorking("Live View");
    setNotice("");
    try {
      const result = await getLiveView({ runId });
      setLiveView({ runId, ...result });
      setNotice("A short-lived Live View link is ready. It is not persisted in Convex.");
    } catch (error) {
      setNotice(safeError(error));
    } finally {
      setWorking("");
    }
  }

  return (
    <LedgerCard
      header={
        <>
          <span className="type">Browserbase portal operations</span>
          <span className="mono">Operator-owned test connections only</span>
        </>
      }
    >
      <div className="rs-connection-boundary">
        <ShieldAlert aria-hidden="true" size={15} />
        <p>
          This surface shows only portals connected by the signed-in operator. Live View URLs are short-lived bearer links; they remain local to this screen and are never stored. Passwords, 2FA, CAPTCHA, terms, contracts, bookings, and payments stay human-only.
        </p>
      </div>
      {connections === undefined ? (
        <EmptyState body="Reading user-owned Browserbase contexts and runs." title="Loading portal connections…" />
      ) : connections.length === 0 ? (
        <EmptyState body="Create a portal connection from Profile after a source has passed review. No Browserbase context is implied when this list is empty." title="No portal connections" />
      ) : (
        <div className="rs-portal-ops-grid">
          <div className="rs-queue-list">
            {connections.map((connection) => (
              <button
                className={`qrow rs-queue-button${connection._id === selected?._id ? " on" : ""}`}
                key={connection._id}
                onClick={() => {
                  setSelectedId(connection._id);
                  setLiveView(undefined);
                }}
                type="button"
              >
                <span className="t"><strong>{connection.label}</strong><span className="mono">{titleCase(connection.policyDecision)} · {formatAge(connection.lastSuccessAt)}</span></span>
                <span className={`pill ${toneForStatus(connection.status)}`}>{titleCase(connection.status)}</span>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="stack">
              <Table className="facts"><TableBody>
                <TableRow><TableCell>Status</TableCell><TableCell>{titleCase(selected.status)}</TableCell></TableRow>
                <TableRow><TableCell>Policy</TableCell><TableCell>{titleCase(selected.policyDecision)}</TableCell></TableRow>
                <TableRow><TableCell>Read-only recon</TableCell><TableCell>{selected.allowReadOnlyRecon ? "Allowed" : "Disabled"}</TableCell></TableRow>
                <TableRow><TableCell>Inbox polling</TableCell><TableCell>{selected.allowInboxPolling ? `${selected.pollIntervalMinutes} min` : "Disabled"}</TableCell></TableRow>
                <TableRow><TableCell>Next poll</TableCell><TableCell>{formatAge(selected.nextPollAt)}</TableCell></TableRow>
                <TableRow><TableCell>Circuit breaker</TableCell><TableCell>{selected.circuitOpenUntil ? `Recorded until ${new Date(selected.circuitOpenUntil).toLocaleTimeString()} (${formatAge(selected.circuitOpenUntil)})` : "Closed"}</TableCell></TableRow>
              </TableBody></Table>
              {selected.lastErrorCode ? <p className="fitline"><ShieldAlert aria-hidden="true" size={14} />{selected.lastErrorCode}</p> : null}
              <div className="actionsrow">
                {selected.allowReadOnlyRecon && selected.status === "active" ? <button className="btn btn-s btn-sm" disabled={Boolean(working)} onClick={() => void run("Read-only recon", () => runRecon({ connectionId: selected._id }))} type="button"><Play aria-hidden="true" size={12} />Run recon</button> : null}
                {(selected.status === "needs_auth" || selected.status === "reauth_required") ? <button className="btn btn-p btn-sm" disabled={Boolean(working)} onClick={() => void run("Authentication session", () => startAuthentication({ connectionId: selected._id }))} type="button"><LogIn aria-hidden="true" size={12} />Start human login</button> : null}
                {selected.allowInboxPolling && selected.status === "active" ? <button className="btn btn-s btn-sm" disabled={Boolean(working)} onClick={() => void run("Inbox sync", () => syncInbox({ connectionId: selected._id }))} type="button"><RefreshCw aria-hidden="true" size={12} />Sync inbox</button> : null}
                {selected.status !== "disabled" && selected.status !== "paused" ? <button className="btn btn-g btn-sm" disabled={Boolean(working)} onClick={() => void run("Connection pause", () => pause({ connectionId: selected._id }))} type="button"><Pause aria-hidden="true" size={12} />Pause</button> : null}
                {selected.status !== "disabled" ? <button className="btn btn-g btn-sm" disabled={Boolean(working)} onClick={() => void run("Connection disable", () => disableConnection({ connectionId: selected._id }))} type="button"><Trash2 aria-hidden="true" size={12} />Delete context & disable</button> : null}
              </div>
              <div>
                <h3>Recent browser runs</h3>
                {runs === undefined ? <p className="hint">Loading runs…</p> : runs.length === 0 ? <p className="hint">No Browserbase run has been reserved for this connection.</p> : (
                  <div className="lcard rs-review-table-wrap">
                    <Table className="q rs-review-table"><TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Status</TableHead><TableHead>Result</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader><TableBody>
                      {runs.map((browserRun) => (
                        <TableRow key={browserRun._id}>
                          <TableCell>{titleCase(browserRun.kind)}</TableCell>
                          <TableCell><span className={`pill ${toneForStatus(browserRun.status)}`}>{titleCase(browserRun.status)}</span></TableCell>
                          <TableCell>{browserRun.resultCount ?? browserRun.errorCode ?? "—"}</TableCell>
                          <TableCell className="mono">{formatAge(browserRun.createdAt)}</TableCell>
                          <TableCell><div className="actionsrow">
                            {browserRun.status === "human_required" ? <button className="btn btn-s btn-sm" disabled={Boolean(working)} onClick={() => void loadLiveView(browserRun._id)} type="button">Live View</button> : null}
                            {browserRun.status === "human_required" ? <button className="btn btn-p btn-sm" disabled={Boolean(working)} onClick={() => void run("Authentication confirmation", () => resumeAuthentication({ runId: browserRun._id }))} type="button">Confirm complete</button> : null}
                            {browserRun.status === "queued" || browserRun.status === "running" || browserRun.status === "human_required" ? <button className="btn btn-g btn-sm" disabled={Boolean(working)} onClick={() => void run("Run stop", () => stopRun({ runId: browserRun._id }))} type="button"><CircleStop aria-hidden="true" size={12} /></button> : null}
                          </div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table>
                  </div>
                )}
              </div>
              {latestHumanRun && liveView?.runId === latestHumanRun._id ? (
                <a className="btn btn-p" href={liveView.url} rel="noreferrer" target="_blank">Open short-lived Browserbase Live View <ExternalLink aria-hidden="true" size={13} /></a>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {notice ? <p className="rs-memory-notice" role="status">{notice}</p> : null}
    </LedgerCard>
  );
}
