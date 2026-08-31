import { usePaginatedQuery, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { formatAge, toneForStatus, titleCase } from "./opsFormat";

export function OpsOverviewPage() {
  const overview = useQuery(api.ops.overview);
  const platforms = usePaginatedQuery(api.sourceIntelligence.listPlatforms, {}, { initialNumItems: 50 });
  const newCandidates = usePaginatedQuery(api.sourceIntelligence.listCandidates, { status: "new" }, { initialNumItems: 50 });
  const portalConnections = useQuery(api.portalConnections.listMine, {});

  if (overview === undefined) {
    return (
      <WorkspaceShell mode="ops">
        <PageHeader title="Operations overview" />
        <EmptyState body="Reading the live Convex operations state." title="Loading operations…" />
      </WorkspaceShell>
    );
  }

  const metrics = [
    { label: "Published signals", value: overview.metrics.publishedSignals },
    { label: "Stale signals", value: overview.metrics.staleSignals, tone: overview.metrics.staleSignals > 0 ? "warning" : undefined },
    { label: "Detail backlog", value: overview.metrics.detailBacklog },
    { label: "Detail failures", value: overview.metrics.detailFailures, tone: overview.metrics.detailFailures > 0 ? "warning" : undefined },
    { label: "Pending approvals", value: overview.metrics.awaitingApproval },
    { label: "Replies", value: overview.metrics.repliedThreads },
    { label: "Unhealthy sources", value: overview.metrics.unhealthySources, tone: overview.metrics.unhealthySources > 0 ? "warning" : undefined },
    { label: "Active voice", value: overview.metrics.activeVoiceSessions },
    { label: "AgentMail inboxes", value: overview.metrics.activeMailboxes },
    { label: "Source platforms", value: platforms.results.length },
    { label: "New source candidates", value: newCandidates.results.length, tone: newCandidates.results.length > 0 ? "warning" : undefined },
    { label: "My portal connections", value: portalConnections?.length ?? 0 },
  ];
  const queues = [
    { title: "Signal detail queue", detail: `${overview.metrics.detailBacklog} waiting · ${overview.metrics.detailFailures} failed`, to: "/ops/signals" },
    { title: "Outreach awaiting approval", detail: `${overview.metrics.awaitingApproval} user-controlled drafts`, to: "/ops/outreach" },
    { title: "Mail threads with replies", detail: `${overview.metrics.repliedThreads} live threads`, to: "/ops/inbox" },
    { title: "Source health", detail: `${overview.metrics.unhealthySources} degraded or failing`, to: "/ops/sources" },
    { title: "Source intelligence", detail: `${newCandidates.results.length} loaded candidates need review`, to: "/ops/sources" },
    { title: "Browserbase portal operations", detail: `${portalConnections?.filter((connection) => connection.status === "active").length ?? 0} of ${portalConnections?.length ?? 0} operator-owned connections active`, to: "/ops/sources" },
  ];

  return (
    <WorkspaceShell mode="ops">
      <PageHeader
        meta={<span className="rs-page-meta"><span className="chip">Live Convex data</span><span className="mono live"><span className="dot dot-pulse" />Reactive</span></span>}
        title="Operations overview"
      />
      <div className="metrics rs-metrics-grid">
        {metrics.map((metric) => (
          <LedgerCard className={`metric${metric.tone ? ` ${metric.tone}` : ""}`} key={metric.label}>
            <div className="k">{metric.label}</div>
            <div className="v">{metric.value}</div>
          </LedgerCard>
        ))}
      </div>
      <div className="cols rs-ops-overview__columns">
        <LedgerCard header={<><span className="type">Work queues</span><span className="mono">Counts capped at {overview.boundedSample}</span></>}>
          <div className="rs-queue-list">
            {queues.map((item) => (
              <div className="qrow" key={item.title}>
                <div className="t">{item.title}<span className="mono">{item.detail}</span></div>
                <Link className="btn btn-s btn-sm" to={item.to}>Open</Link>
              </div>
            ))}
          </div>
        </LedgerCard>
        <LedgerCard header={<><span className="type">Live activity</span><span className="mono">Firecrawl · AgentMail · Realtime</span></>}>
          {overview.activity.length === 0 ? (
            <EmptyState body="Provider and workflow events will appear after the first controlled run." title="No operations events yet" />
          ) : (
            <ol className="stream rs-event-stream">
              {overview.activity.map((event) => (
                <li className="ev" key={event.id}>
                  <time className="mono" dateTime={new Date(event.at).toISOString()}>{formatAge(event.at)}</time>
                  <span><b>{event.title}</b> — {event.detail}</span>
                  <span className={`pill ${toneForStatus(event.status)}`}>{titleCase(event.status)}</span>
                </li>
              ))}
            </ol>
          )}
        </LedgerCard>
      </div>
    </WorkspaceShell>
  );
}
