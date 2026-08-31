import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BrowserRunWorkspace } from "../../components/browser/BrowserRunWorkspace";
import { PortalAuthenticationGuide } from "../../components/connections/PortalAuthenticationGuide";
import { WorkspaceShell } from "../../components/navigation/WorkspaceShell";
import type { BrowserRun } from "../../features/agentOperations/types";

export function BrowserRunPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const storedRun = useQuery(api.portalConnections.getRunMine, runId ? { runId: runId as Id<"browserRuns"> } : "skip");
  const connection = useQuery(api.portalConnections.getMine, storedRun ? { connectionId: storedRun.connectionId } : "skip");
  const mailbox = useQuery(api.mailboxes.getMine);
  const getLiveView = useAction(api.browserbasePortal.getLiveView);
  const resumeAuthentication = useAction(api.browserbasePortal.resumeAuthentication);
  const stopRun = useAction(api.browserbasePortal.stopRun);
  const startAuthentication = useAction(api.browserbasePortal.startAuthentication);
  const ensureMailbox = useAction(api.mailboxes.ensureMine);
  const [liveView, setLiveView] = useState<{ url: string; expiresAt: number }>();
  const [working, setWorking] = useState(false);
  const [mailboxWorking, setMailboxWorking] = useState(false);
  const [signedInConfirmed, setSignedInConfirmed] = useState(false);
  const [error, setError] = useState("");

  const run: BrowserRun | null = storedRun && connection ? {
    id: storedRun._id,
    sourceName: connection.platformName ?? connection.sourceName,
    sourceDomain: (() => { try { return new URL(connection.baseUrl).hostname; } catch { return undefined; } })(),
    searchTitle: storedRun.kind === "authenticate" ? "Connect portal account" : storedRun.kind === "inbox_sync" ? "Sync portal inbox" : "Review portal source",
    mandateLabel: "Policy-reviewed portal run",
    state: liveView && storedRun.status === "human_required" ? "human_controlling" : storedRun.status === "running" ? "agent_running" : storedRun.status === "expired" ? "failed" : storedRun.status,
    liveViewUrl: liveView?.url,
    humanPrompt: storedRun.status === "human_required" ? "Open Live View and complete login, registration, email verification, password, 2FA, or CAPTCHA yourself. RoomScout never receives those secrets." : undefined,
    steps: [
      { id: "reserved", label: "Session reserved", state: storedRun.status === "queued" ? "active" : "done" },
      { id: "human", label: "Human authentication", state: storedRun.status === "human_required" ? "active" : storedRun.status === "completed" ? "done" : "pending" },
      { id: "persist", label: "Persist authenticated Browserbase context", state: storedRun.status === "completed" ? "done" : storedRun.status === "failed" ? "blocked" : "pending" },
    ],
  } : null;

  async function takeControl() {
    if (!storedRun) return;
    setWorking(true); setError("");
    try { setLiveView(await getLiveView({ runId: storedRun._id })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Live View is not available."); }
    finally { setWorking(false); }
  }

  async function returnControl() {
    if (!storedRun || !signedInConfirmed) return;
    setWorking(true); setError("");
    try { await resumeAuthentication({ runId: storedRun._id }); setLiveView(undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The authenticated context could not be finalized."); }
    finally { setWorking(false); }
  }

  async function stop() {
    if (!storedRun) return;
    setWorking(true); setError("");
    try { await stopRun({ runId: storedRun._id }); setLiveView(undefined); setSignedInConfirmed(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The browser run could not be stopped."); }
    finally { setWorking(false); }
  }

  async function retry() {
    if (!storedRun) return;
    setWorking(true); setError("");
    try {
      const next = await startAuthentication({ connectionId: storedRun.connectionId });
      setSignedInConfirmed(false);
      setLiveView(undefined);
      navigate(`/app/runs/${next.runId}`, { replace: true });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The browser run could not be restarted."); }
    finally { setWorking(false); }
  }

  async function provisionMailbox() {
    setMailboxWorking(true); setError("");
    try {
      const result = await ensureMailbox();
      if (result.status === "failed") setError(result.lastError ?? "The RoomScout registration address could not be created.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The RoomScout registration address could not be created.");
    } finally {
      setMailboxWorking(false);
    }
  }

  return (
    <WorkspaceShell mode="musician">
      <div className="wrap rs-browser-run-page">
        {error ? <p className="rs-form-error" role="alert">{error}</p> : null}
        {storedRun === undefined || (storedRun && connection === undefined) ? <p className="mono">Loading persisted browser run…</p> : null}
        {storedRun?.kind === "authenticate" && connection ? (
          <PortalAuthenticationGuide
            liveViewOpen={Boolean(liveView)}
            mailboxAddress={mailbox?.emailAddress}
            mailboxWorking={mailboxWorking || mailbox?.status === "provisioning"}
            onEnsureMailbox={() => void provisionMailbox()}
            onSignedInConfirmedChange={setSignedInConfirmed}
            portalName={connection.platformName ?? connection.sourceName}
            signedInConfirmed={signedInConfirmed}
          />
        ) : null}
        <BrowserRunWorkspace onRetry={working ? undefined : retry} onReturnControl={working || !signedInConfirmed ? undefined : returnControl} onStop={working ? undefined : stop} onTakeControl={working ? undefined : takeControl} run={run} />
        <p className="mono">Requested run: {runId ?? "none"}</p>
        <Link className="btn btn-s" to="/app/profile?tab=connections">Back to connections</Link>
      </div>
    </WorkspaceShell>
  );
}
