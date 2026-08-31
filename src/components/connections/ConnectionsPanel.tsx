import { ExternalLink, Link2, Mail, Pause, RotateCcw, ShieldCheck } from "lucide-react";
import type { ConnectablePortalSource, PortalConnection } from "../../features/agentOperations/types";
import { EmptyState, LedgerCard } from "../ui/LedgerCard";

type ConnectionsPanelProps = {
  mailbox?: { status: "provisioning" | "active" | "failed" | "disabled"; emailAddress?: string; lastError?: string } | null;
  portals: PortalConnection[];
  connectableSources?: ConnectablePortalSource[];
  loading?: boolean;
  error?: string;
  onConnect?: (connectionId: string) => void;
  onPause?: (connectionId: string) => void;
  onReconnect?: (connectionId: string) => void;
  onSync?: (connectionId: string) => void;
  onRequestConnection?: (sourceId: string, label: string) => void;
};

export function ConnectionsPanel({ mailbox, portals, connectableSources = [], loading = false, error, onConnect, onPause, onReconnect, onSync, onRequestConnection }: ConnectionsPanelProps) {
  return (
    <div className="stack">
      <LedgerCard accent header={<><span className="type t-scout">Scout mail identity</span><span className={`pill ${mailbox?.status === "active" ? "new" : mailbox?.status === "failed" ? "warn" : ""}`}>{mailbox?.status ?? "Not provisioned"}</span></>}>
        <div className="rs-agent-identity"><Mail aria-hidden="true" size={20} /><div><strong>{mailbox?.emailAddress ?? "Created on first approved outreach"}</strong><p>Personal AgentMail identity for communication you explicitly approve. It is separate from your RoomScout login and any portal account.</p></div></div>
        {mailbox?.lastError ? <p className="err">{mailbox.lastError}</p> : null}
      </LedgerCard>

      <LedgerCard header={<><span className="type">Connected portals</span><span className="mono">User-authorized identities</span></>}>
        <div className="rs-connection-boundary"><ShieldCheck aria-hidden="true" size={15} /><p>A connection alone is never authorization. A persisted standing mandate may allow listed communication actions; passwords, 2FA, CAPTCHA, terms, contracts, bookings, payments, and deposits remain human-only.</p></div>
      </LedgerCard>

      {connectableSources.length ? <LedgerCard header={<><span className="type">Available portal connections</span><span className="mono">Reviewed authenticated sources</span></>}>
        <div className="stack">
          {connectableSources.map((source) => <div className="rs-source-coverage-row" key={source.id}><div><strong>{source.platformName ?? source.name}</strong><p><a href={source.url} rel="noreferrer" target="_blank">{source.domain}<ExternalLink aria-hidden="true" size={12} /></a>{source.platformName && source.platformName !== source.name ? ` · ${source.name}` : ""}</p></div><button className="btn btn-s btn-sm" disabled={!onRequestConnection} onClick={() => onRequestConnection?.(source.id, source.platformName ?? source.name)} type="button"><Link2 aria-hidden="true" size={13} />Add connection</button></div>)}
        </div>
        <p className="hint">Adding a connection creates a scoped record first. Browser authentication becomes available after its connection policy is approved.</p>
      </LedgerCard> : null}

      {error ? <p className="rs-form-error" role="alert">{error}</p> : null}
      {loading ? (
        <EmptyState body="Loading your persisted portal connections and policy state." title="Loading connections…" />
      ) : portals.length === 0 ? (
        <EmptyState body="No third-party portal account is connected. RoomScout continues to use reviewed public sources and your personal approved-email flow." title="No portal connections" />
      ) : portals.map((portal) => (
        <LedgerCard header={<><span className="type">{portal.name}</span><span className={`pill ${portal.status === "connected" ? "new" : portal.status === "needs_attention" ? "warn" : ""}`}>{portal.status.replaceAll("_", " ")}</span></>} key={portal.id}>
          <div className="rs-connection-card">
            <div>{portal.domain ? <a href={`https://${portal.domain}`} rel="noreferrer" target="_blank">{portal.domain}<ExternalLink aria-hidden="true" size={12} /></a> : null}<p>{portal.identityLabel ?? portal.note ?? "No identity metadata available."}</p></div>
            <div className="actionsrow">
              {portal.status === "not_connected" ? <button className="btn btn-s btn-sm" disabled={!onConnect || !portal.canAuthenticate} onClick={() => onConnect?.(portal.id)} type="button"><Link2 aria-hidden="true" size={13} />Connect with live setup</button> : null}
              {portal.status === "needs_attention" || portal.status === "paused" ? <button className="btn btn-s btn-sm" disabled={!onReconnect || !portal.canAuthenticate} onClick={() => onReconnect?.(portal.id)} type="button"><RotateCcw aria-hidden="true" size={13} />{portal.status === "paused" ? "Resume connection" : "Reconnect"}</button> : null}
              {portal.status === "connected" && portal.canSync ? <button className="btn btn-s btn-sm" disabled={!onSync} onClick={() => onSync?.(portal.id)} type="button"><RotateCcw aria-hidden="true" size={13} />Sync inbox</button> : null}
              {portal.status === "connected" ? <button className="btn btn-g btn-sm" disabled={!onPause} onClick={() => onPause?.(portal.id)} type="button"><Pause aria-hidden="true" size={13} />Pause</button> : null}
            </div>
          </div>
          {portal.scopes.length ? <p className="hint">Allowed preparation: {portal.scopes.join(" · ")}</p> : null}
        </LedgerCard>
      ))}
    </div>
  );
}
