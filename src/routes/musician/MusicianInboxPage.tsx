import { Bot, Mail, MessageSquare, Send, SquarePen } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ActionLifecyclePanel } from "../../components/actions/ActionLifecyclePanel";
import { MailboxVerificationPanel } from "../../components/actions/MailboxVerificationPanel";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { OpportunityHandoff } from "../../components/opportunities/OpportunityHandoff";
import { ProviderOfferPanel } from "../../components/opportunities/ProviderOfferPanel";
import { EmptyState } from "../../components/ui/LedgerCard";
import { Table, TableBody, TableCell, TableRow } from "../../components/ui/table";
import { formatMessageTime } from "../../data/convexAdapters";
import type { CommunicationChannel, Opportunity } from "../../features/agentOperations/types";

type ChannelFilter = "all" | "needs_action" | CommunicationChannel;
type SelectedThread = { channel: "email" | "platform" | "webform"; id: string };

const channelLabels: Record<"email" | "platform" | "webform", string> = {
  email: "Email",
  platform: "Platform DM",
  webform: "Web form",
};

function opportunityTitle(kind: "supply_match" | "demand_collaboration" | "source_lead"): string {
  if (kind === "supply_match") return "Room opportunity";
  if (kind === "demand_collaboration") return "Potential band collaboration";
  return "Source lead";
}

export function MusicianInboxPage() {
  const threads = useQuery(api.communications.listThreadsMine, { limit: 50 });
  const mailbox = useQuery(api.mailboxes.getMine);
  const providerConversations = useQuery(api.providerConversations.listMine, { limit: 50 });
  const opportunityRows = useQuery(api.opportunities.listMine, { limit: 20 });
  const actionRows = useQuery(api.externalActions.listMine, { limit: 30 });
  const mailboxMessages = useQuery(api.inbox.listMailboxMessagesMine, { limit: 10 });
  const createHandoff = useMutation(api.opportunities.createHandoff);
  const updateOpportunityStatus = useMutation(api.opportunities.updateStatus);
  const updateMailboxMessageStatus = useMutation(api.inbox.updateMailboxMessageStatus);
  const [selectedThread, setSelectedThread] = useState<SelectedThread>();
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [handoffError, setHandoffError] = useState("");
  const [mailboxError, setMailboxError] = useState("");

  const webformThreads = (actionRows ?? []).flatMap((action) => {
    if (action.requestedActionType !== "submit_webform" || action.payload.kind !== "contact_form") return [];
    const payload = action.payload;
    return [{
      channel: "webform" as const,
      threadId: action._id,
      subject: payload.fields.find((field) => field.name.toLowerCase().includes("subject"))?.value || "Web-form outreach",
      status: action.status,
      participants: [new URL(payload.targetUrl).hostname],
      lastMessageAt: action.updatedAt,
    }];
  });
  const unifiedThreads = [...(threads ?? []), ...webformThreads].sort((left, right) => right.lastMessageAt - left.lastMessageAt);
  const visibleThreads = unifiedThreads.filter((thread) => {
    if (channelFilter === "all") return true;
    if (channelFilter === "email") return thread.channel === "email";
    if (channelFilter === "platform_dm") return thread.channel === "platform";
    if (channelFilter === "webform") return thread.channel === "webform";
    if (thread.channel === "webform") return thread.status === "awaiting_approval" || thread.status === "failed" || thread.status === "executing";
    return thread.channel === "email"
      ? thread.status === "replied" || thread.status === "failed"
      : thread.status === "open";
  });
  const selectedStillVisible = selectedThread && visibleThreads.some((thread) => thread.channel === selectedThread.channel && thread.threadId === selectedThread.id);
  const effectiveThread: SelectedThread | undefined = selectedStillVisible
    ? selectedThread
    : visibleThreads[0] ? { channel: visibleThreads[0].channel, id: visibleThreads[0].threadId } : undefined;
  const emailSelected = useQuery(
    api.inbox.getThreadMine,
    effectiveThread?.channel === "email" ? { threadId: effectiveThread.id as Id<"mailThreads">, limit: 100 } : "skip",
  );
  const platformSelected = useQuery(
    api.platformInbox.getThreadMine,
    effectiveThread?.channel === "platform" ? { threadId: effectiveThread.id as Id<"platformThreads">, messageLimit: 100 } : "skip",
  );
  const webformSelected = effectiveThread?.channel === "webform"
    ? actionRows?.find((action) => action._id === effectiveThread.id && action.payload.kind === "contact_form")
    : undefined;

  const opportunities: Opportunity[] = (opportunityRows ?? []).map((opportunity) => ({
    id: opportunity._id,
    title: opportunityTitle(opportunity.kind),
    counterparty: "Counterparty identity is not exposed by the opportunity API",
    confirmed: opportunity.reasons,
    unresolved: opportunity.uncertainties,
    recommendedNextStep: opportunity.status === "converted"
      ? "The opportunity has been handed off for a human decision."
      : "Review the evidence and unresolved facts before preparing a human handoff.",
    status: opportunity.status === "converted" ? "handed_off" : opportunity.status === "contacted" ? "visit_proposed" : "qualified",
  }));
  async function markHandedOff(opportunityId: string) {
    const source = opportunityRows?.find((candidate) => candidate._id === opportunityId);
    if (!source) return;
    setHandoffError("");
    try {
      await createHandoff({
        opportunityId: source._id,
        channel: "manual",
        summary: [opportunityTitle(source.kind), ...source.reasons, ...source.uncertainties.map((item) => `Unresolved: ${item}`)].join("\n"),
      });
      await updateOpportunityStatus({ opportunityId: source._id, status: "converted" });
    } catch (caught) {
      setHandoffError(caught instanceof Error ? caught.message : "The handoff could not be persisted.");
    }
  }

  async function changeMailboxMessageStatus(messageId: Id<"mailboxMessages">, status: "read" | "archived") {
    setMailboxError("");
    try {
      await updateMailboxMessageStatus({ messageId, status });
    } catch (caught) {
      setMailboxError(caught instanceof Error ? caught.message : "The mailbox message status could not be saved.");
    }
  }

  const selectedLoading = effectiveThread?.channel === "email" ? emailSelected === undefined : effectiveThread?.channel === "platform" ? platformSelected === undefined : effectiveThread?.channel === "webform" ? actionRows === undefined : false;
  const providerConversation = providerConversations?.find((conversation) =>
    effectiveThread?.channel === "email" ? conversation.mailThreadId === effectiveThread.id
      : effectiveThread?.channel === "platform" ? conversation.platformThreadId === effectiveThread.id : false,
  );

  return (
    <WorkspaceShell mode="musician">
      <div className="rs-inbox-filterbar">
        <div><h1>Nachrichten</h1><p>Alle Gespräche zu eurer Suche. Dein Scout bleibt für euch dran.</p></div>
        <div aria-label="Inbox channel" className="fchips" role="tablist">
          {(["all", "needs_action", "email", "webform", "platform_dm"] as const).map((filter) => <button aria-selected={channelFilter === filter} className={`fchip${channelFilter === filter ? " on" : ""}`} key={filter} onClick={() => { setChannelFilter(filter); setSelectedThread(undefined); }} role="tab" type="button">{filter.replaceAll("_", " ")}</button>)}
        </div>
      </div>
      <div className="threepane rs-inbox">
        <section className="pane rs-inbox__threads">
          <header className="phead"><h2>Gespräche</h2><span className="mono">{visibleThreads.length || ""}</span></header>
          {threads === undefined || actionRows === undefined ? <p className="rs-inbox__hint">Loading your communication threads…</p> : null}
          {visibleThreads.map((thread) => {
            const active = effectiveThread?.channel === thread.channel && effectiveThread.id === thread.threadId;
            return (
              <button aria-current={active ? "true" : undefined} className={`titem${active ? " on" : ""}`} key={`${thread.channel}:${thread.threadId}`} onClick={() => setSelectedThread({ channel: thread.channel, id: thread.threadId })} type="button">
                <span className="who"><strong>{thread.subject}</strong><span className="mono">{thread.status}</span></span>
                <span className="prev">{thread.channel === "email" ? <Mail aria-hidden="true" size={12} /> : <MessageSquare aria-hidden="true" size={12} />} {channelLabels[thread.channel]} · {thread.participants.length ? thread.participants.join(", ") : "participants not exposed"}</span>
                <span className="mono">{formatMessageTime(thread.lastMessageAt)}</span>
              </button>
            );
          })}
          {threads && actionRows && visibleThreads.length === 0 ? <p className="rs-inbox__hint">Hier ist es noch ruhig. Sobald ein Gespräch beginnt, erscheint es hier.</p> : null}
        </section>

        <section className="pane rs-inbox__conversation">
          {selectedLoading ? <div className="convo"><EmptyState body="Fetching persisted messages from the selected channel." title="Loading conversation…" /></div> : emailSelected ? (
            <>
              <header className="phead rs-inbox__conversation-head"><div><h1>{emailSelected.thread.subject}</h1><span className="mono"><Mail aria-hidden="true" size={11} /> Email · {emailSelected.thread.status}</span></div><span className="mono live"><span className="dot dot-pulse" />Live thread</span></header>
              <div className="convo rs-communication-timeline">
                {emailSelected.messages.map((message) => <article className={`mail ${message.direction === "outbound" ? "out" : "in"}`} key={message._id}><header className="mail-top"><span className="mono">{message.direction === "outbound" ? `You → ${message.to.join(", ")}` : `${message.from} → You`}{message.deliveryStatus ? ` · ${message.deliveryStatus}` : ""}</span><time className="mono">{formatMessageTime(message.receivedAt)}</time></header><div className="mail-body">{message.subject ? `Subject: ${message.subject}\n\n` : ""}{message.body}</div></article>)}
                {emailSelected.thread.lastDeliveryStatus ? <div className="rs-timeline-event"><Mail aria-hidden="true" size={13} /><span><strong>Delivery update</strong> · {emailSelected.thread.lastDeliveryStatus}</span></div> : null}
                {(() => {
                  const parsed = [...emailSelected.messages].reverse().find((message) => message.direction === "inbound" && (message.parsedSummary || message.parsedFacts?.length));
                  return parsed ? <section className="parsed"><header className="rs-parsed-header"><h2 className="type t-scout">Scout · Parsed reply</h2><span className="mono">AI interpretation · original stays above</span></header>{parsed.parsedFacts?.length ? <ul className="rs-unknown-list">{parsed.parsedFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}{parsed.parsedSummary ? <p className="fitline">{parsed.parsedSummary}</p> : null}</section> : null;
                })()}
              </div>
              <div className="cactions"><Link className="btn btn-p" to="/app/scout?mode=outreach_drafting"><Send aria-hidden="true" size={14} />Draft reply with Scout</Link><Link className="btn btn-s" to="/app/scout"><Bot aria-hidden="true" size={14} />Ask Scout</Link><Link className="btn btn-s" to="/app/search"><SquarePen aria-hidden="true" size={14} />Update search</Link></div>
            </>
          ) : platformSelected ? (
            <>
              <header className="phead rs-inbox__conversation-head"><div><h1>{platformSelected.thread.subject ?? "Platform conversation"}</h1><span className="mono"><MessageSquare aria-hidden="true" size={11} /> Platform DM · {platformSelected.thread.status}</span></div><span className="mono live"><span className="dot dot-pulse" />Synced thread</span></header>
              <div className="convo rs-communication-timeline">
                {platformSelected.messages.map((message) => <article className={`mail ${message.direction === "outbound" ? "out" : "in"}`} key={message._id}><header className="mail-top"><span className="mono">{message.senderLabel ?? message.direction}</span><time className="mono">{formatMessageTime(message.sentAt)}</time></header><div className="mail-body">{message.bodyText}</div></article>)}
                {platformSelected.messages.length === 0 ? <EmptyState body="The platform thread exists, but no persisted messages were returned." title="No messages in this thread" /> : null}
              </div>
              <div className="cactions"><Link className="btn btn-p" to="/app/scout?mode=outreach_drafting"><Send aria-hidden="true" size={14} />Draft platform reply</Link><Link className="btn btn-s" to="/app/scout"><Bot aria-hidden="true" size={14} />Ask Scout</Link></div>
            </>
          ) : webformSelected && webformSelected.payload.kind === "contact_form" ? (
            <>
              <header className="phead rs-inbox__conversation-head"><div><h1>{webformSelected.payload.fields.find((field) => field.name.toLowerCase().includes("subject"))?.value ?? "Web-form outreach"}</h1><span className="mono"><MessageSquare aria-hidden="true" size={11} /> Web form · {webformSelected.status}</span></div><span className="mono">Persisted action</span></header>
              <div className="convo rs-communication-timeline">
                <article className="mail out"><header className="mail-top"><span className="mono">Prepared for {new URL(webformSelected.payload.targetUrl).hostname}</span><time className="mono">{formatMessageTime(webformSelected.updatedAt)}</time></header><div className="mail-body">{webformSelected.payload.fields.map((field) => `${field.label ?? field.name}: ${field.value}`).join("\n\n")}</div></article>
                <div className="rs-timeline-event"><MessageSquare aria-hidden="true" size={13} /><span><strong>Action state</strong> · {webformSelected.status}{webformSelected.error ? ` · ${webformSelected.error}` : ""}</span></div>
              </div>
              <div className="cactions">{webformSelected.status === "awaiting_approval" ? <Link className="btn btn-p" to="/app/scout"><Bot aria-hidden="true" size={14} />Im Scout-Chat entscheiden</Link> : null}<Link className="btn btn-s" to="/app/scout?mode=outreach_drafting"><Bot aria-hidden="true" size={14} />Ask Scout</Link></div>
            </>
          ) : <div className="convo"><EmptyState body="Wähle links ein Gespräch. Hier findest du den Verlauf und neue Antworten." title="Platz für gute Nachrichten." /></div>}
        </section>

        <aside className="pane ctx rs-inbox__context">
          {providerConversation ? <ProviderOfferPanel conversation={providerConversation} /> : null}
          <section><h2>Scout mailbox</h2><strong>{mailbox?.emailAddress ?? (mailbox?.status === "provisioning" ? "Provisioning…" : "Created on first outreach")}</strong><span className="mono rs-brand-accent">{mailbox?.status ?? "Not provisioned"}</span></section>
          <section><h2>Du hast das letzte Wort.</h2><p>Dein Scout kümmert sich um unverbindliche Gespräche. Zusagen, Buchungen und Zahlungen bleiben bei dir.</p></section>
          <details className="rs-inbox-advanced">
            <summary>Advanced activity</summary>
            <div>
              <section><h2>Selected channel</h2><Table className="facts"><TableBody><TableRow><TableCell>Type</TableCell><TableCell>{effectiveThread ? channelLabels[effectiveThread.channel] : "—"}</TableCell></TableRow><TableRow><TableCell>Storage</TableCell><TableCell>{effectiveThread?.channel === "platform" ? "Platform thread" : effectiveThread?.channel === "email" ? "AgentMail thread" : effectiveThread?.channel === "webform" ? "External action ledger" : "—"}</TableCell></TableRow></TableBody></Table></section>
              <section>
                <h2>Account &amp; verification mail</h2>
                {mailboxError ? <p className="rs-form-error" role="alert">{mailboxError}</p> : null}
                <MailboxVerificationPanel messages={mailboxMessages} onStatusChange={changeMailboxMessageStatus} />
              </section>
              <section>
                <h2>External action ledger</h2>
                <ActionLifecyclePanel actions={actionRows?.slice(0, 10)} />
              </section>
              <section><h2>Opportunities</h2>{handoffError ? <p className="rs-form-error" role="alert">{handoffError}</p> : null}{opportunityRows === undefined ? <p>Loading…</p> : opportunities.length ? opportunities.slice(0, 3).map((opportunity) => <OpportunityHandoff key={opportunity.id} onMarkHandedOff={markHandedOff} opportunity={opportunity} />) : <p>No persisted opportunity is ready for handoff.</p>}</section>
            </div>
          </details>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
