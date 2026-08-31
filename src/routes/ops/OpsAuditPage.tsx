import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { formatAge, toneForStatus, titleCase } from "./opsFormat";

export function OpsAuditPage() {
  const events = useQuery(api.ops.listAudit, { limit: 60 });
  const connections = useQuery(api.portalConnections.listMine, {});
  const [connectionId, setConnectionId] = useState<Id<"portalConnections">>();
  const selectedConnection = connections?.find((connection) => connection._id === connectionId) ?? connections?.[0];
  const browserRuns = useQuery(
    api.portalConnections.listRunsMine,
    selectedConnection ? { connectionId: selectedConnection._id } : "skip",
  );

  return (
    <WorkspaceShell mode="ops">
      <PageHeader
        meta={<span className="rs-page-meta"><span className="chip">Live safeguards</span><span className="mono">No raw mail or audio</span></span>}
        title="Audit log"
      />
      <LedgerCard header={<><span className="type">Approval and provider events</span><span className="mono">Bounded recent history</span></>}>
        {events === undefined ? (
          <EmptyState body="Reading approvals, verified provider events, and voice-session lifecycle records." title="Loading audit events…" />
        ) : events.length === 0 ? (
          <EmptyState body="Approval decisions and provider lifecycle events will appear here once those flows run." title="No audit events yet" />
        ) : (
          <ol className="stream rs-event-stream">
            {events.map((event) => (
              <li className="ev" key={event.id}>
                <time className="mono" dateTime={new Date(event.at).toISOString()}>{formatAge(event.at)}</time>
                <span><b>{event.title}</b> — {event.detail}</span>
                <span className={`pill ${toneForStatus(event.status)}`}>{titleCase(event.status)}</span>
              </li>
            ))}
          </ol>
        )}
      </LedgerCard>
      <LedgerCard header={<><span className="type">Browserbase run ledger</span><span className="mono">Signed-in operator only</span></>}>
        {connections === undefined ? (
          <EmptyState body="Reading operator-owned portal connections." title="Loading browser run ledger…" />
        ) : connections.length === 0 ? (
          <EmptyState body="No persistent Browserbase context or browser run exists for this operator." title="No portal run history" />
        ) : (
          <div className="stack">
            <div className="filters rs-ops-filters rs-ops-compact-filters">
              {connections.map((connection) => (
                <button className={`fchip${connection._id === selectedConnection?._id ? " on" : ""}`} key={connection._id} onClick={() => setConnectionId(connection._id)} type="button">{connection.label}</button>
              ))}
            </div>
            {browserRuns === undefined ? <p className="hint">Loading runs…</p> : browserRuns.length === 0 ? (
              <EmptyState body="This connection has no reserved Browserbase sessions." title="No runs for this connection" />
            ) : (
              <ol className="stream rs-event-stream">
                {browserRuns.map((run) => (
                  <li className="ev" key={run._id}>
                    <time className="mono" dateTime={new Date(run.createdAt).toISOString()}>{formatAge(run.createdAt)}</time>
                    <span><b>{titleCase(run.kind)}</b> — {run.resultCount === undefined ? run.errorCode ?? "No result payload stored" : `${run.resultCount} normalized items`}</span>
                    <span className={`pill ${toneForStatus(run.status)}`}>{titleCase(run.status)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </LedgerCard>
    </WorkspaceShell>
  );
}
