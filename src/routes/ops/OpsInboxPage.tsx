import { Bot, Mail, MailCheck, MessagesSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { Table, TableBody, TableCell, TableRow } from "../../components/ui/table";
import { formatAge, toneForStatus, titleCase } from "./opsFormat";

type Channel = "agentmail" | "platform";

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "The inbox operation failed.";
}

export function OpsInboxPage() {
  const [channel, setChannel] = useState<Channel>("agentmail");
  const threads = useQuery(api.ops.listInboxRouting, { limit: 30 });
  const [selectedId, setSelectedId] = useState<string>();
  const selected = threads?.find((thread) => thread._id === selectedId) ?? threads?.[0];

  const connections = useQuery(api.portalConnections.listMine, {});
  const [connectionId, setConnectionId] = useState<Id<"portalConnections">>();
  const selectedConnection = connections?.find((connection) => connection._id === connectionId) ?? connections?.[0];
  const platformThreads = useQuery(
    api.platformInbox.listThreadsMine,
    selectedConnection ? { connectionId: selectedConnection._id, limit: 40 } : "skip",
  );
  const [platformThreadId, setPlatformThreadId] = useState<Id<"platformThreads">>();
  const selectedPlatformThread = platformThreads?.find((thread) => thread._id === platformThreadId) ?? platformThreads?.[0];
  const platformThread = useQuery(
    api.platformInbox.getThreadMine,
    selectedPlatformThread ? { threadId: selectedPlatformThread._id, messageLimit: 60 } : "skip",
  );
  const syncInbox = useAction(api.browserbasePortal.syncInboxNow);
  const [syncState, setSyncState] = useState("");

  async function syncSelectedPortal() {
    if (!selectedConnection) return;
    setSyncState("Syncing the reviewed portal inbox…");
    try {
      const result = await syncInbox({ connectionId: selectedConnection._id });
      setSyncState(`${result.threadsCreated} threads and ${result.messagesCreated} messages added.`);
    } catch (error) {
      setSyncState(safeError(error));
    }
  }

  return (
    <WorkspaceShell mode="ops">
      <PageHeader
        meta={<span className="rs-page-meta"><span className="chip">Real channel state</span><span className="mono">Mail aggregate · own portal test accounts</span></span>}
        title="Inbox routing"
      />
      <div className="filters rs-ops-filters">
        <button aria-pressed={channel === "agentmail"} className={`fchip${channel === "agentmail" ? " on" : ""}`} onClick={() => setChannel("agentmail")} type="button"><Mail aria-hidden="true" size={13} />AgentMail routing</button>
        <button aria-pressed={channel === "platform"} className={`fchip${channel === "platform" ? " on" : ""}`} onClick={() => setChannel("platform")} type="button"><MessagesSquare aria-hidden="true" size={13} />Platform inbox</button>
      </div>

      {channel === "agentmail" ? (
        threads === undefined ? (
          <EmptyState body="Reading AgentMail threads and parsed reply metadata." title="Loading inbox routing…" />
        ) : threads.length === 0 ? (
          <EmptyState body="Threads appear after a user approves an outreach, AgentMail sends it, and delivery or reply events arrive." title="No mail threads yet" />
        ) : (
          <div className="cols rs-ops-inbox-layout">
            <LedgerCard header={<><span className="type">Mail threads</span><span className="mono">{threads.length} recent</span></>}>
              <div className="rs-queue-list">
                {threads.map((thread) => (
                  <button
                    className={`qrow rs-queue-button rs-routing-item${thread._id === selected?._id ? " on" : ""}`}
                    key={thread._id}
                    onClick={() => setSelectedId(thread._id)}
                    type="button"
                  >
                    <span className="t"><strong>{thread.subject}</strong><span className="mono">{thread.ownerName} · {formatAge(thread.lastMessageAt)}</span><span>{thread.parsedSummary ?? `${titleCase(thread.status)} · ${thread.latestDirection ? `${thread.latestDirection} message` : "no stored message"}`}</span></span>
                    <span className={`pill ${toneForStatus(thread.deliveryStatus ?? thread.status)}`}>{titleCase(thread.deliveryStatus ?? thread.status)}</span>
                  </button>
                ))}
              </div>
            </LedgerCard>
            {selected ? (
              <div className="stack">
                <LedgerCard accent header={<><span className="type t-scout">Routing context</span><Bot aria-hidden="true" size={15} /></>}>
                  <Table className="facts"><TableBody>
                    <TableRow><TableCell>Owner</TableCell><TableCell>{selected.ownerName}</TableCell></TableRow>
                    <TableRow><TableCell>Recipient</TableCell><TableCell>{selected.recipientName} · {selected.recipientEmailMasked}</TableCell></TableRow>
                    <TableRow><TableCell>Search</TableCell><TableCell>{selected.searchTitle}</TableCell></TableRow>
                    <TableRow><TableCell>Signal</TableCell><TableCell>{selected.signalTitle}</TableCell></TableRow>
                    <TableRow><TableCell>Thread</TableCell><TableCell>{titleCase(selected.status)}</TableCell></TableRow>
                    <TableRow><TableCell>Delivery</TableCell><TableCell>{selected.deliveryStatus ? titleCase(selected.deliveryStatus) : "No provider update"}</TableCell></TableRow>
                    <TableRow><TableCell>Latest direction</TableCell><TableCell>{selected.latestDirection ? titleCase(selected.latestDirection) : "No message"}</TableCell></TableRow>
                  </TableBody></Table>
                  {selected.parsedSummary ? <p className="fitline"><MailCheck aria-hidden="true" size={15} />{selected.parsedSummary}</p> : null}
                  {selected.parsedFacts.length > 0 ? <ul className="checks">{selected.parsedFacts.map((fact) => <li className="check" key={fact}>{fact}</li>)}</ul> : null}
                  {selected.lastError ? <p className="fitline">{selected.lastError}</p> : null}
                  <p className="mono">This aggregate exposes routing metadata and parsed facts only; raw private message bodies remain omitted.</p>
                </LedgerCard>
              </div>
            ) : null}
          </div>
        )
      ) : (
        <div className="stack">
          <LedgerCard accent header={<><span className="type t-scout">Portal privacy boundary</span><ShieldCheck aria-hidden="true" size={15} /></>}>
            <p className="fitline">This is not a cross-user operator mailbox. It reads only platform accounts explicitly connected by the currently signed-in operator, using reviewed read-only inbox adapters.</p>
          </LedgerCard>
          {connections === undefined ? (
            <EmptyState body="Reading operator-owned portal connections." title="Loading portal inboxes…" />
          ) : connections.length === 0 ? (
            <EmptyState body="Connect an authenticated source from Profile, then complete the human login through Browserbase before any portal inbox can be read." title="No connected portal inbox" />
          ) : (
            <>
              <LedgerCard header={<><span className="type">Portal connection</span><span className="mono">Read-only sync</span></>}>
                <div className="actionsrow">
                  {connections.map((connection) => (
                    <button className={`fchip${connection._id === selectedConnection?._id ? " on" : ""}`} key={connection._id} onClick={() => { setConnectionId(connection._id); setPlatformThreadId(undefined); }} type="button">{connection.label} · {titleCase(connection.status)}</button>
                  ))}
                  {selectedConnection?.allowInboxPolling ? <button className="btn btn-s btn-sm" onClick={() => void syncSelectedPortal()} type="button"><RefreshCw aria-hidden="true" size={12} />Sync now</button> : null}
                </div>
                {syncState ? <p className="rs-memory-notice" role="status">{syncState}</p> : null}
              </LedgerCard>
              {platformThreads === undefined ? (
                <EmptyState body="Reading normalized portal threads." title="Loading platform messages…" />
              ) : platformThreads.length === 0 ? (
                <EmptyState body="The selected portal has not produced a reviewed inbox snapshot. No placeholder conversation is shown." title="No platform threads" />
              ) : (
                <div className="cols rs-ops-inbox-layout">
                  <LedgerCard header={<><span className="type">Platform threads</span><span className="mono">{platformThreads.length} recent</span></>}>
                    <div className="rs-queue-list">
                      {platformThreads.map((thread) => (
                        <button className={`qrow rs-queue-button${thread._id === selectedPlatformThread?._id ? " on" : ""}`} key={thread._id} onClick={() => setPlatformThreadId(thread._id)} type="button">
                          <span className="t"><strong>{thread.subject ?? "Untitled platform thread"}</strong><span className="mono">{thread.participants.join(" · ") || "Participants not exposed"}</span></span>
                          <span className={`pill ${toneForStatus(thread.status)}`}>{formatAge(thread.lastMessageAt)}</span>
                        </button>
                      ))}
                    </div>
                  </LedgerCard>
                  <LedgerCard accent header={<><span className="type t-scout">Read-only transcript</span><span className="mono">{platformThread?.messages.length ?? 0} messages</span></>}>
                    {platformThread === undefined ? <p className="hint">Loading messages…</p> : platformThread === null ? <EmptyState body="The selected thread is no longer available." title="Thread unavailable" /> : (
                      <ol className="rs-platform-transcript">
                        {platformThread.messages.map((message) => (
                          <li className={`rs-platform-message rs-platform-message--${message.direction}`} key={message._id}>
                            <span className="mono">{message.senderLabel ?? titleCase(message.direction)} · {formatAge(message.sentAt)}</span>
                            <p>{message.bodyText}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </LedgerCard>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}
