import { Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { FixtureNotice, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { demoActivity, demoReviewCandidates } from "../../mocks/demoData";

const queueItems = [
  { title: "Signal review queue", detail: `${demoReviewCandidates.length} candidates`, to: "/ops/signals" },
  { title: "Outreach awaiting approval", detail: "1 draft · user-requested", to: "/ops/outreach" },
  { title: "Replies needing routing", detail: "1 parsed · high confidence", to: "/ops/inbox" },
  { title: "Source failures", detail: "1 prototype source · two failed checks", to: "/ops/sources" },
] as const;

export function OpsOverviewPage() {
  const [showDemoEvent, setShowDemoEvent] = useState(false);
  const activity = showDemoEvent
    ? [{ time: "now", title: "Check ok", detail: "Example source, 1 new demand signal detected", kind: "New" }, ...demoActivity]
    : demoActivity;
  const metrics = [
    { label: "Example signals", value: 7, detail: "today" },
    { label: "Needs review", value: demoReviewCandidates.length },
    { label: "Pending approvals", value: 1 },
    { label: "Awaiting replies", value: 1 },
    { label: "Degraded sources", value: 1, tone: "warning" },
  ];

  return (
    <WorkspaceShell mode="ops">
      <PageHeader meta={<span className="rs-page-meta"><FixtureNotice /><span className="mono live"><span className="dot dot-pulse" />Demo activity</span></span>} title="Operations overview" />
      <div className="metrics rs-metrics-grid">
        {metrics.map((metric) => <LedgerCard className={`metric${metric.tone ? ` ${metric.tone}` : ""}`} key={metric.label}><div className="k">{metric.label}</div><div className="v">{metric.value}{metric.detail ? <small>{metric.detail}</small> : null}</div></LedgerCard>)}
      </div>
      <div className="cols rs-ops-overview__columns">
        <LedgerCard header={<span className="type">Work queues</span>}>
          <div className="rs-queue-list">
            {queueItems.map((item) => <div className="qrow" key={item.title}><div className="t">{item.title}<span className="mono">{item.detail}</span></div><Link className="btn btn-s btn-sm" to={item.to}>Open</Link></div>)}
          </div>
        </LedgerCard>
        <LedgerCard header={<><span className="type">Live activity</span><span className="mono">Firecrawl → normalize → publish</span></>}>
          <ol className="stream rs-event-stream">
            {activity.map((event, index) => <li className="ev" key={`${event.time}-${event.title}-${index}`}><time className="mono">{event.time}</time><span><b>{event.title}</b> — {event.detail}</span><span className={`pill ${event.kind === "New" ? "new" : event.kind === "Degraded" ? "warn" : ""}`}>{event.kind}</span></li>)}
          </ol>
        </LedgerCard>
      </div>
      <button className="demo-trigger" disabled={showDemoEvent} onClick={() => setShowDemoEvent(true)} type="button"><Play aria-hidden="true" size={12} />{showDemoEvent ? "Demo event shown" : "Demo: reveal ingestion event"}</button>
    </WorkspaceShell>
  );
}
