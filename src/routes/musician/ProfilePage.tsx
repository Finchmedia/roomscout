import { Brain, Download, LoaderCircle, Network, Trash2, Unplug } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ContextImportDialog } from "../../components/memory/ContextImportDialog";
import {
  PortalConnectionsWorkspace,
  type AvailablePortal,
  type PortalUiConnection,
  type PortalUiStatus,
} from "../../components/connections/PortalConnectionsWorkspace";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { ActionDialog } from "../../components/ui/ActionDialog";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";
import { Table, TableBody, TableCell, TableRow } from "../../components/ui/table";

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function domainFromUrl(value: string): string | undefined {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function portalUiStatus(status: "draft" | "needs_auth" | "active" | "paused" | "reauth_required" | "disabled", policyDecision: "pending" | "allowed" | "restricted" | "prohibited"): PortalUiStatus {
  if (status === "disabled" || policyDecision === "prohibited") return "disabled";
  if (status === "needs_auth") return "login_needed";
  if (status === "active") return "connected";
  if (status === "reauth_required") return "reauth_required";
  if (status === "paused") return "paused";
  return "not_connected";
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useQuery(api.users.current);
  const memory = useQuery(api.memory.listMine);
  const mailbox = useQuery(api.mailboxes.getMine);
  const portalRows = useQuery(api.portalConnections.listMine);
  const connectableRows = useQuery(api.portalConnections.listConnectableSources, { limit: 50 });
  const deleteFact = useMutation(api.memory.deleteFact);
  const refreshEmbeddings = useAction(api.memory.refreshMyEmbeddings);
  const refreshContext = useAction(api.memory.refreshMyContext);
  const ensureMailbox = useAction(api.mailboxes.ensureMine);
  const startPortalAuthentication = useAction(api.browserbasePortal.startAuthentication);
  const startAgentRegistration = useAction(api.browserbasePortal.startAgentRegistration);
  const syncPortalInbox = useAction(api.browserbasePortal.syncInboxNow);
  const disablePortalConnection = useAction(api.browserbasePortal.disableConnection);
  const pausePortalConnection = useMutation(api.portalConnections.pauseMine);
  const requestPortalConnection = useMutation(api.portalConnections.requestConnection);
  const [importOpen, setImportOpen] = useState(false);
  const [importedCount, setImportedCount] = useState<number>();
  const [forgetFactId, setForgetFactId] = useState<Id<"memoryFacts">>();
  const [forgetting, setForgetting] = useState(false);
  const [embeddingRefresh, setEmbeddingRefresh] = useState<"idle" | "working" | "missing-key" | "done">("idle");
  const [contextRefresh, setContextRefresh] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [connectionWorking, setConnectionWorking] = useState<string>();
  const [disableConnectionId, setDisableConnectionId] = useState<Id<"portalConnections">>();

  const profile = memory?.profile;
  const contextIsBuilding = profile && profile.contextVersion < profile.factVersion;
  const groupedFacts = memory?.facts.reduce<Record<string, typeof memory.facts>>(
    (groups, fact) => {
      (groups[fact.subject] ??= []).push(fact);
      return groups;
    },
    {},
  );

  async function confirmForget() {
    if (!forgetFactId) return;
    setForgetting(true);
    try {
      await deleteFact({ factId: forgetFactId });
      setForgetFactId(undefined);
    } finally {
      setForgetting(false);
    }
  }

  async function refreshSemanticMemory() {
    setEmbeddingRefresh("working");
    const result = await refreshEmbeddings();
    setEmbeddingRefresh(result.configured ? "done" : "missing-key");
  }

  async function retryContext() {
    setContextRefresh(true);
    try {
      await refreshContext();
    } finally {
      setContextRefresh(false);
    }
  }

  const activeTab = searchParams.get("tab") === "connections" ? "connections" : "memory";
  const portals: PortalUiConnection[] = (portalRows ?? []).map((connection) => ({
    id: connection._id,
    name: connection.platformName ?? connection.sourceName,
    domain: domainFromUrl(connection.baseUrl),
    status: portalUiStatus(connection.status, connection.policyDecision),
    policyReady: connection.policyDecision === "allowed",
    canAuthenticate: connection.policyDecision === "allowed" && (connection.status === "needs_auth" || connection.status === "reauth_required" || connection.status === "paused"),
    canSync: connection.policyDecision === "allowed" && connection.status === "active" && connection.allowInboxPolling,
    scopes: [connection.allowReadOnlyRecon ? "Read-only research" : "", connection.allowInboxPolling ? "Inbox sync" : ""].filter(Boolean),
    lastVerifiedLabel: connection.lastSuccessAt ? new Date(connection.lastSuccessAt).toLocaleString() : undefined,
    identityLabel: connection.label !== connection.sourceName && connection.label !== connection.platformName ? connection.label : undefined,
    note: connection.policyDecision !== "allowed" ? `Platform policy: ${connection.policyDecision}.` : connection.lastErrorCode ? `Last connection error: ${connection.lastErrorCode}.` : connection.platformName ? `Reviewed source: ${connection.sourceName}.` : undefined,
  }));
  const connectedSourceIds = new Set((portalRows ?? []).map((connection) => String(connection.sourceId)));
  const connectableSources: AvailablePortal[] = (connectableRows ?? []).filter((source) => !connectedSourceIds.has(String(source.sourceId))).map((source) => ({
    id: source.sourceId,
    name: source.name,
    domain: domainFromUrl(source.baseUrl) ?? source.baseUrl,
    url: source.baseUrl,
    platformName: source.platformName,
  }));

  async function connectPortal(connectionId: string) {
    setConnectionWorking(connectionId);
    setConnectionError("");
    try {
      const result = await startPortalAuthentication({ connectionId: connectionId as Id<"portalConnections"> });
      navigate(`/app/runs/${result.runId}`);
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "The secure portal session could not be started.");
    } finally {
      setConnectionWorking(undefined);
    }
  }

  async function letScoutRegister(connectionId: string) {
    setConnectionWorking(connectionId);
    setConnectionError("");
    try {
      const result = await startAgentRegistration({
        connectionId: connectionId as Id<"portalConnections">,
      });
      navigate(`/app/runs/${result.runId}`);
    } catch (caught) {
      setConnectionError(
        caught instanceof Error
          ? caught.message
          : "The controlled portal registration could not be started.",
      );
    } finally {
      setConnectionWorking(undefined);
    }
  }

  async function pausePortal(connectionId: string) {
    setConnectionWorking(connectionId);
    setConnectionError("");
    try {
      await pausePortalConnection({ connectionId: connectionId as Id<"portalConnections"> });
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "The portal connection could not be paused.");
    } finally {
      setConnectionWorking(undefined);
    }
  }

  async function syncPortal(connectionId: string) {
    setConnectionWorking(connectionId);
    setConnectionError("");
    try {
      await syncPortalInbox({ connectionId: connectionId as Id<"portalConnections"> });
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "The portal inbox could not be synchronized.");
    } finally {
      setConnectionWorking(undefined);
    }
  }

  async function addPortalSource(sourceId: string, connectionLabel: string) {
    setConnectionWorking(sourceId);
    setConnectionError("");
    try {
      await requestPortalConnection({ sourceId: sourceId as Id<"sources">, label: connectionLabel });
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "The portal connection could not be created.");
    } finally {
      setConnectionWorking(undefined);
    }
  }

  async function provisionMailbox() {
    setConnectionWorking("mailbox");
    setConnectionError("");
    try {
      const result = await ensureMailbox();
      if (result.status === "failed") setConnectionError(result.lastError ?? "The RoomScout email address could not be created.");
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "The RoomScout email address could not be created.");
    } finally {
      setConnectionWorking(undefined);
    }
  }

  async function disablePortal() {
    if (!disableConnectionId) return;
    setConnectionWorking(disableConnectionId);
    setConnectionError("");
    try {
      await disablePortalConnection({ connectionId: disableConnectionId });
      setDisableConnectionId(undefined);
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "The portal connection could not be disabled.");
    } finally {
      setConnectionWorking(undefined);
    }
  }
  const profileTabs = (
    <div aria-label="Profile sections" className="rs-page-tabs" role="tablist">
      <button aria-selected={activeTab === "memory"} className={activeTab === "memory" ? "on" : undefined} onClick={() => setSearchParams({ tab: "memory" })} role="tab" type="button">Scout memory</button>
      <button aria-selected={activeTab === "connections"} className={activeTab === "connections" ? "on" : undefined} onClick={() => setSearchParams({ tab: "connections" })} role="tab" type="button">Connections</button>
    </div>
  );

  if (activeTab === "connections") {
    return (
      <WorkspaceShell mode="musician">
        <PageHeader eyebrow="Separate identities, explicit scopes" title="Profile & connections" />
        {profileTabs}
        <PortalConnectionsWorkspace
          availablePortals={connectableSources}
          error={connectionError}
          loading={portalRows === undefined || connectableRows === undefined}
          mailbox={mailbox}
          onAuthenticate={(connectionId) => void connectPortal(connectionId)}
          onAgentRegister={(connectionId) => void letScoutRegister(connectionId)}
          onCreate={(sourceId, connectionLabel) => void addPortalSource(sourceId, connectionLabel)}
          onDisable={(connectionId) => setDisableConnectionId(connectionId as Id<"portalConnections">)}
          onEnsureMailbox={() => void provisionMailbox()}
          onPause={(connectionId) => void pausePortal(connectionId)}
          onSync={(connectionId) => void syncPortal(connectionId)}
          portals={portals}
          workingId={connectionWorking}
        />
        <ActionDialog
          description="This affects only the selected portal. Other connected sites keep their own Contexts."
          footer={
            <>
              <button className="btn btn-g" disabled={Boolean(connectionWorking)} onClick={() => setDisableConnectionId(undefined)} type="button">Keep connected</button>
              <button className="btn btn-p" disabled={Boolean(connectionWorking)} onClick={() => void disablePortal()} type="button"><Unplug aria-hidden="true" size={14} />Disable & delete Context</button>
            </>
          }
          onOpenChange={(open) => { if (!open) setDisableConnectionId(undefined); }}
          open={disableConnectionId !== undefined}
          title="Disable this portal connection?"
        >
          <p>RoomScout will stop using this portal and ask Browserbase to delete its persisted Context. This removes the reusable portal session; it does not delete the account on the third-party website.</p>
        </ActionDialog>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell mode="musician">
      <PageHeader
        eyebrow="You control what the Scout remembers"
        meta={
          <button className="btn btn-p btn-sm" onClick={() => setImportOpen(true)} type="button">
            <Download aria-hidden="true" size={14} />Import music context
          </button>
        }
        title="Scout memory"
      />
      {profileTabs}

      {importedCount !== undefined ? (
        <div className="rs-memory-notice" role="status">
          <span className="dot" />{importedCount} reviewed {importedCount === 1 ? "fact" : "facts"} added. Your Scout is rebuilding its working context.
        </div>
      ) : null}

      <div className="cols rs-memory-layout">
        <div className="stack">
          <LedgerCard
            accent
            header={
              <>
                <span className="type t-scout">Working context</span>
                <span className="mono">
                  {contextIsBuilding ? <><LoaderCircle aria-hidden="true" className="rs-spin" size={11} />Learning</> : `Version ${profile?.contextVersion ?? 0}`}
                </span>
              </>
            }
          >
            {profile?.summary ? (
              <div className="rs-memory-context">
                <div className="rs-memory-summary"><Brain aria-hidden="true" size={17} /><p>{profile.summary}</p></div>
                <section><span className="mono">Musical identity</span><p>{profile.musicalIdentity || "Not enough context yet."}</p></section>
                <section><span className="mono">Practical context</span><p>{profile.practicalContext || "Not enough context yet."}</p></section>
                <section><span className="mono">People + relationships</span><p>{profile.relationshipContext || "Not enough context yet."}</p></section>
              </div>
            ) : (
              <>
                <EmptyState
                  body="Tell the Scout about your project, or import context from an assistant that already knows your music life."
                  title="Your Scout is ready to learn"
                />
                {contextIsBuilding ? <button className="btn btn-s btn-sm rs-context-retry" disabled={contextRefresh} onClick={retryContext} type="button">{contextRefresh ? <LoaderCircle aria-hidden="true" className="rs-spin" size={14} /> : <Brain aria-hidden="true" size={14} />}Build working context now</button> : null}
              </>
            )}
          </LedgerCard>

          {profile && (profile.hardConstraints.length > 0 || profile.softPreferences.length > 0 || profile.openQuestions.length > 0) ? (
            <div className="grid3 rs-memory-layers">
              <LedgerCard header={<span className="type">Hard constraints</span>}>
                <ul>{profile.hardConstraints.map((item) => <li key={item}>{item}</li>)}</ul>
              </LedgerCard>
              <LedgerCard header={<span className="type">Soft preferences</span>}>
                <ul>{profile.softPreferences.map((item) => <li key={item}>{item}</li>)}</ul>
              </LedgerCard>
              <LedgerCard header={<span className="type">Worth asking</span>}>
                <ul>{profile.openQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
              </LedgerCard>
            </div>
          ) : null}

          <LedgerCard
            header={
              <>
                <span className="type">Fact memory</span>
                <span className="mono">{memory?.facts.length ?? 0} active facts</span>
              </>
            }
          >
            {!memory || memory.facts.length === 0 ? (
              <EmptyState body="Facts you state or approve will appear here. Inferences stay visibly marked." title="Nothing remembered yet" />
            ) : (
              <div className="rs-memory-entities">
                {Object.entries(groupedFacts ?? {}).map(([subject, facts]) => (
                  <section className="rs-memory-entity" key={subject}>
                    <div className="rs-memory-entity__head">
                      <h2>{subject}</h2>
                      <span className="chip">{facts[0]?.subjectKind}</span>
                    </div>
                    <ul>
                      {facts.map((fact) => (
                        <li key={fact._id}>
                          <span>
                            <span className="mono">{label(fact.predicate)} · {label(fact.category)}</span>
                            <b>{fact.value}{fact.objectName ? ` → ${fact.objectName}` : ""}</b>
                            <small>{label(fact.verification)} · {label(fact.source)} · {Math.round(fact.confidence * 100)}% confidence</small>
                          </span>
                          <button aria-label={`Forget ${fact.value}`} className="xbtn" onClick={() => setForgetFactId(fact._id)} type="button"><Trash2 aria-hidden="true" size={14} /></button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </LedgerCard>
        </div>

        <div className="stack">
          <LedgerCard header={<><span className="type">Account</span><span className="mono">Private workspace</span></>}>
            <Table className="facts"><TableBody>
              <TableRow><TableCell>Username</TableCell><TableCell>{currentUser?.displayName ?? currentUser?.username ?? "Loading…"}</TableCell></TableRow>
              <TableRow><TableCell>Role</TableCell><TableCell>{currentUser?.role ?? "Musician"}</TableCell></TableRow>
              <TableRow><TableCell>Raw import</TableCell><TableCell>Analyzed, never stored</TableCell></TableRow>
              <TableRow><TableCell>Autopilot</TableCell><TableCell>Non-binding outreach only · commitments stay with you</TableCell></TableRow>
              <TableRow><TableCell>Semantic index</TableCell><TableCell>{memory?.facts.filter((fact) => fact.embeddingState === "ready").length ?? 0} / {memory?.facts.length ?? 0} facts ready</TableCell></TableRow>
            </TableBody></Table>
            {memory && memory.facts.some((fact) => fact.embeddingState !== "ready") ? (
              <div className="rs-memory-embedding-action">
                <button className="btn btn-s btn-sm" disabled={embeddingRefresh === "working"} onClick={refreshSemanticMemory} type="button">
                  {embeddingRefresh === "working" ? <LoaderCircle aria-hidden="true" className="rs-spin" size={14} /> : <Network aria-hidden="true" size={14} />}
                  Build semantic index
                </button>
                {embeddingRefresh === "missing-key" ? <p className="hint">Set OPENAI_API_KEY in this Convex deployment first.</p> : null}
                {embeddingRefresh === "done" ? <p className="hint">Semantic memory is up to date.</p> : null}
              </div>
            ) : null}
          </LedgerCard>
          <LedgerCard header={<><span className="type">Memory activity</span><Network aria-hidden="true" size={14} /></>}>
            {!memory || memory.events.length === 0 ? <p className="hint">The event ledger will show what changed and when.</p> : (
              <ul className="stream rs-memory-events">
                {memory.events.map((event) => (
                  <li className="ev" key={event._id}>
                    <span className="mono">{new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span>{event.summary}</span>
                    <span className="chip">{label(event.eventType)}</span>
                  </li>
                ))}
              </ul>
            )}
          </LedgerCard>
        </div>
      </div>

      <ContextImportDialog
        onImported={(count) => setImportedCount(count)}
        onOpenChange={setImportOpen}
        open={importOpen}
      />
      <ActionDialog
        description="The original memory event remains in the audit trail."
        footer={
          <>
            <button className="btn btn-g" disabled={forgetting} onClick={() => setForgetFactId(undefined)} type="button">Keep it</button>
            <button className="btn btn-p" disabled={forgetting} onClick={confirmForget} type="button">
              {forgetting ? <LoaderCircle aria-hidden="true" className="rs-spin" size={15} /> : <Trash2 aria-hidden="true" size={15} />}
              Forget fact
            </button>
          </>
        }
        onOpenChange={(open) => { if (!open) setForgetFactId(undefined); }}
        open={forgetFactId !== undefined}
        title="Forget this fact?"
      >
        <p>RoomScout will stop using this fact and rebuild the working context without it.</p>
      </ActionDialog>
    </WorkspaceShell>
  );
}
