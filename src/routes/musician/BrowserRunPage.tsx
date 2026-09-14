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
  const startAgentRegistration = useAction(api.browserbasePortal.startAgentRegistration);
  const recoverFirecrawlProfile = useAction(api.firecrawlPortal.recoverProfile);
  const ensureMailbox = useAction(api.mailboxes.ensureMine);
  const [liveView, setLiveView] = useState<{ url: string; expiresAt: number }>();
  const [working, setWorking] = useState(false);
  const [mailboxWorking, setMailboxWorking] = useState(false);
  const [signedInConfirmed, setSignedInConfirmed] = useState(false);
  const [error, setError] = useState("");
  const providerMismatch = Boolean(storedRun && connection &&
    (storedRun.browserProvider !== connection.browserProvider || connection.providerMismatch || connection.providerConfigurationError));
  const canOperateRun = Boolean(storedRun && !providerMismatch);
  const firecrawlRecoveryRequired = Boolean(storedRun && connection &&
    storedRun.browserProvider === "firecrawl" && storedRun.kind === "authenticate" &&
    storedRun.status === "completed" && (connection.status !== "active" || connection.contextStatus !== "ready"));

  const run: BrowserRun | null = storedRun && connection ? {
    id: storedRun._id,
    sourceName: connection.platformName ?? connection.sourceName,
    sourceDomain: (() => { try { return new URL(connection.baseUrl).hostname; } catch { return undefined; } })(),
    searchTitle: storedRun.kind === "authenticate" ? storedRun.onboardingStage ? "Scout-assisted portal registration" : "Connect portal account" : storedRun.kind === "inbox_sync" ? "Sync portal inbox" : "Review portal source",
    policyLabel: "Policy-reviewed portal run",
    state: firecrawlRecoveryRequired ? "approval_required" : liveView && storedRun.status === "human_required" ? "human_controlling" : storedRun.status === "running" ? "agent_running" : storedRun.status === "expired" ? "failed" : storedRun.status,
    liveViewUrl: liveView?.url,
    humanPrompt: storedRun.status === "human_required" ? "The controlled automation stopped before an ambiguous or human-only step. Open Live View to review it; RoomScout will not accept terms, solve CAPTCHA, or guess a code." : undefined,
    steps: storedRun.onboardingStage ? [
      { id: "reserved", label: `Open isolated ${storedRun.browserProvider === "firecrawl" ? "Firecrawl profile" : "Browserbase Context"}`, state: storedRun.status === "queued" ? "active" : "done" },
      { id: "signup", label: "Register with personal AgentMail address", state: storedRun.onboardingStage === "opening_signup" ? "active" : "done" },
      { id: "mail", label: "Receive and parse Clerk verification mail", state: storedRun.onboardingStage === "waiting_verification" ? "active" : storedRun.onboardingStage === "opening_signup" ? "pending" : storedRun.status === "failed" ? "blocked" : "done" },
      { id: "verify", label: "Verify authentication in a new profile session", state: firecrawlRecoveryRequired ? "active" : storedRun.onboardingStage === "submitting_verification" ? "active" : storedRun.status === "completed" ? "done" : storedRun.status === "human_required" || storedRun.status === "failed" ? "blocked" : "pending" },
    ] : [
      { id: "reserved", label: "Session reserved", state: storedRun.status === "queued" ? "active" : "done" },
      { id: "human", label: "Human authentication", state: storedRun.status === "human_required" ? "active" : storedRun.status === "completed" ? "done" : "pending" },
      { id: "persist", label: `Verify persistent ${storedRun.browserProvider === "firecrawl" ? "Firecrawl profile" : "Browserbase Context"}`, state: firecrawlRecoveryRequired ? "active" : storedRun.status === "completed" ? "done" : storedRun.status === "failed" ? "blocked" : "pending" },
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
      const next = storedRun.browserProvider === "firecrawl" && storedRun.kind === "authenticate"
        ? await recoverFirecrawlProfile({ connectionId: storedRun.connectionId })
        : storedRun.onboardingStage
          ? await startAgentRegistration({ connectionId: storedRun.connectionId })
        : await startAuthentication({ connectionId: storedRun.connectionId });
      setSignedInConfirmed(false);
      setLiveView(undefined);
      if (next.runId) navigate(`/app/runs/${next.runId}`, { replace: true });
      else if ("status" in next && next.status === "completed") navigate("/app/settings/sources", { replace: true });
      else setError(next.status === "auth_needed"
        ? "This saved Firecrawl profile needs a manual sign-in, which is not supported here. Review or reconnect the portal account."
        : "The saved Firecrawl profile needs review before automation can continue.");
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
        {storedRun?.kind === "authenticate" && connection && storedRun.canResume && (!storedRun.onboardingStage || storedRun.status === "human_required") ? (
          <PortalAuthenticationGuide
            browserProvider={storedRun.browserProvider}
            liveViewOpen={Boolean(liveView)}
            mailboxAddress={mailbox?.emailAddress}
            mailboxWorking={mailboxWorking || mailbox?.status === "provisioning"}
            onEnsureMailbox={() => void provisionMailbox()}
            onSignedInConfirmedChange={setSignedInConfirmed}
            portalName={connection.platformName ?? connection.sourceName}
            signedInConfirmed={signedInConfirmed}
          />
        ) : null}
        <BrowserRunWorkspace
          browserProvider={storedRun?.browserProvider}
          onRetry={working || !canOperateRun ? undefined : retry}
          onReturnControl={working || !signedInConfirmed || !storedRun?.canResume || !canOperateRun ? undefined : returnControl}
          onStop={working || !canOperateRun || !storedRun || !["queued", "running", "human_required"].includes(storedRun.status) ? undefined : stop}
          onTakeControl={working || !storedRun?.canResume || !canOperateRun ? undefined : takeControl}
          providerMismatch={providerMismatch}
          recoveryRequired={firecrawlRecoveryRequired}
          run={run}
        />
        <p className="mono">Requested run: {runId ?? "none"}</p>
        <Link className="btn btn-s" to="/app/settings/sources">Back to connections</Link>
      </div>
    </WorkspaceShell>
  );
}
