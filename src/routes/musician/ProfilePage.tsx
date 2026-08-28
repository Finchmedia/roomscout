import { Brain, Download, LoaderCircle, Network, Trash2 } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ContextImportDialog } from "../../components/memory/ContextImportDialog";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import { ActionDialog } from "../../components/ui/ActionDialog";
import { EmptyState, LedgerCard, PageHeader } from "../../components/ui/LedgerCard";

function label(value: string): string {
  return value.replaceAll("_", " ");
}

export function ProfilePage() {
  const currentUser = useQuery(api.users.current);
  const memory = useQuery(api.memory.listMine);
  const deleteFact = useMutation(api.memory.deleteFact);
  const refreshEmbeddings = useAction(api.memory.refreshMyEmbeddings);
  const refreshContext = useAction(api.memory.refreshMyContext);
  const [importOpen, setImportOpen] = useState(false);
  const [importedCount, setImportedCount] = useState<number>();
  const [forgetFactId, setForgetFactId] = useState<Id<"memoryFacts">>();
  const [forgetting, setForgetting] = useState(false);
  const [embeddingRefresh, setEmbeddingRefresh] = useState<"idle" | "working" | "missing-key" | "done">("idle");
  const [contextRefresh, setContextRefresh] = useState(false);

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
            <table className="facts"><tbody>
              <tr><td>Username</td><td>{currentUser?.displayName ?? currentUser?.username ?? "Loading…"}</td></tr>
              <tr><td>Role</td><td>{currentUser?.role ?? "Musician"}</td></tr>
              <tr><td>Raw import</td><td>Analyzed, never stored</td></tr>
              <tr><td>Outreach</td><td>Exact approval always required</td></tr>
              <tr><td>Semantic index</td><td>{memory?.facts.filter((fact) => fact.embeddingState === "ready").length ?? 0} / {memory?.facts.length ?? 0} facts ready</td></tr>
            </tbody></table>
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
