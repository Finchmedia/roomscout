import {
  Clipboard,
  ExternalLink,
  KeyRound,
  Link2,
  Mail,
  Pause,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { EmptyState, LedgerCard } from "../ui/LedgerCard";
import styles from "./PortalConnectionsWorkspace.module.css";

export type PortalUiStatus =
  | "not_connected"
  | "login_needed"
  | "connected"
  | "reauth_required"
  | "paused"
  | "disabled";

export type PortalUiConnection = {
  id: string;
  name: string;
  domain?: string;
  status: PortalUiStatus;
  policyReady: boolean;
  canAuthenticate: boolean;
  canSync: boolean;
  scopes: string[];
  lastVerifiedLabel?: string;
  identityLabel?: string;
  note?: string;
};

export type AvailablePortal = {
  id: string;
  name: string;
  domain: string;
  url: string;
  platformName?: string;
};

type Mailbox = {
  status: "provisioning" | "active" | "failed" | "disabled";
  emailAddress?: string;
  lastError?: string;
} | null | undefined;

type PortalConnectionsWorkspaceProps = {
  mailbox: Mailbox;
  portals: PortalUiConnection[];
  availablePortals?: AvailablePortal[];
  loading?: boolean;
  workingId?: string;
  error?: string;
  onEnsureMailbox?: () => void;
  onCreate?: (sourceId: string, label: string) => void;
  onAuthenticate?: (connectionId: string) => void;
  onPause?: (connectionId: string) => void;
  onSync?: (connectionId: string) => void;
  onDisable?: (connectionId: string) => void;
};

const STATUS_COPY: Record<PortalUiStatus, { label: string; description: string; warning: boolean }> = {
  not_connected: {
    label: "Not connected",
    description: "RoomScout has created the connection record, but its reviewed login flow is not ready yet.",
    warning: false,
  },
  login_needed: {
    label: "Login / registration needed",
    description: "Open a private Live View to log in or register once. RoomScout never sees or stores what you type there.",
    warning: true,
  },
  connected: {
    label: "Connected",
    description: "The saved Browserbase Context can be reused for allowed searches and inbox checks on this portal.",
    warning: false,
  },
  reauth_required: {
    label: "Reauthentication required",
    description: "This portal ended or invalidated its login. Reconnect in Live View to refresh only this portal Context.",
    warning: true,
  },
  paused: {
    label: "Paused",
    description: "RoomScout will not use this portal until you reconnect it. Other portal connections are unaffected.",
    warning: false,
  },
  disabled: {
    label: "Disabled",
    description: "The remote Browserbase Context was deleted and this portal identity can no longer be used.",
    warning: false,
  },
};

export function PortalConnectionsWorkspace({
  mailbox,
  portals,
  availablePortals = [],
  loading = false,
  workingId,
  error,
  onEnsureMailbox,
  onCreate,
  onAuthenticate,
  onPause,
  onSync,
  onDisable,
}: PortalConnectionsWorkspaceProps) {
  const [copied, setCopied] = useState(false);

  async function copyMailbox() {
    if (!mailbox?.emailAddress) return;
    await navigator.clipboard.writeText(mailbox.emailAddress);
    setCopied(true);
  }

  return (
    <div className={styles.workspace}>
      <LedgerCard
        accent
        header={
          <>
            <span className="type t-scout">Registration & reply address</span>
            <span className={`pill ${mailbox?.status === "active" ? "new" : mailbox?.status === "failed" ? "warn" : ""}`}>
              {mailbox?.status ?? "Not created"}
            </span>
          </>
        }
      >
        <div className={styles.identity}>
          <Mail aria-hidden="true" size={20} />
          <div>
            <strong className={styles.email}>{mailbox?.emailAddress ?? "Create your private RoomScout email address"}</strong>
            <p>Use this address when a portal asks for an email during registration. Verification mails and replies can then arrive in your RoomScout inbox.</p>
          </div>
          {mailbox?.status === "active" && mailbox.emailAddress ? (
            <button className="btn btn-s btn-sm" onClick={() => void copyMailbox()} type="button">
              <Clipboard aria-hidden="true" size={13} />{copied ? "Copied" : "Copy address"}
            </button>
          ) : mailbox?.status !== "disabled" ? (
            <button className="btn btn-s btn-sm" disabled={!onEnsureMailbox || mailbox?.status === "provisioning"} onClick={onEnsureMailbox} type="button">
              <Mail aria-hidden="true" size={13} />{mailbox?.status === "provisioning" ? "Creating…" : mailbox?.status === "failed" ? "Retry address" : "Create address"}
            </button>
          ) : null}
        </div>
        {mailbox?.lastError ? <p className="rs-form-error" role="alert">{mailbox.lastError}</p> : null}
      </LedgerCard>

      <div className={styles.safety}>
        <ShieldCheck aria-hidden="true" size={16} />
        <div>
          <strong>One isolated Browserbase Context per portal identity</strong>
          <p>You sign in once on each site. Browserbase persists that site&apos;s cookies/session in its own Context, so later approved runs can reuse it. Passwords, one-time codes, 2FA and CAPTCHAs are entered only by you inside the portal&apos;s Live View—never into RoomScout.</p>
        </div>
      </div>

      {error ? <p className="rs-form-error" role="alert">{error}</p> : null}

      <LedgerCard header={<><span className="type">Your portal identities</span><span className="mono">Independent connection state</span></>}>
        {loading ? (
          <EmptyState body="Loading your persisted portal connections and policy state." title="Loading connections…" />
        ) : portals.length === 0 ? (
          <EmptyState body="Choose a reviewed portal below. Public RoomScout sources continue to work without a portal login." title="No portal identities yet" />
        ) : (
          <div className={styles.portalList}>
            {portals.map((portal) => {
              const status = STATUS_COPY[portal.status];
              const busy = workingId === portal.id;
              return (
                <article className={styles.portal} key={portal.id}>
                  <div className={styles.portalHead}>
                    <div className={styles.portalTitle}>
                      <strong>{portal.name}</strong>
                      {portal.domain ? <a href={`https://${portal.domain}`} rel="noreferrer" target="_blank">{portal.domain}<ExternalLink aria-hidden="true" size={12} /></a> : null}
                      <p>{status.description}</p>
                    </div>
                    <span className={`pill ${portal.status === "connected" ? "new" : status.warning ? "warn" : ""}`}>{status.label}</span>
                  </div>

                  <div className={styles.context}>
                    <KeyRound aria-hidden="true" size={15} />
                    <div>
                      <strong>{portal.status === "connected" ? "Persistent Context ready" : portal.status === "disabled" ? "Persistent Context deleted" : "Persistent Context scoped to this portal"}</strong>
                      <p>{portal.identityLabel ? `Portal identity: ${portal.identityLabel}. ` : ""}This Context is not shared with your other connected sites.{portal.note ? ` ${portal.note}` : ""}</p>
                    </div>
                  </div>

                  <div className={styles.meta}>
                    {portal.scopes.map((scope) => <span key={scope}>{scope}</span>)}
                    {portal.lastVerifiedLabel ? <span>Checked {portal.lastVerifiedLabel}</span> : null}
                    {!portal.policyReady ? <span>Policy review pending</span> : null}
                  </div>

                  <div className={styles.actions}>
                    {portal.status === "login_needed" ? (
                      <button className="btn btn-p btn-sm" disabled={busy || !portal.canAuthenticate || !onAuthenticate} onClick={() => onAuthenticate?.(portal.id)} type="button"><Link2 aria-hidden="true" size={13} />Open secure setup</button>
                    ) : null}
                    {portal.status === "reauth_required" || portal.status === "paused" ? (
                      <button className="btn btn-p btn-sm" disabled={busy || !portal.canAuthenticate || !onAuthenticate} onClick={() => onAuthenticate?.(portal.id)} type="button"><RotateCcw aria-hidden="true" size={13} />{portal.status === "paused" ? "Reconnect portal" : "Reauthenticate"}</button>
                    ) : null}
                    {portal.status === "connected" && portal.canSync ? (
                      <button className="btn btn-s btn-sm" disabled={busy || !onSync} onClick={() => onSync?.(portal.id)} type="button"><RefreshCcw aria-hidden="true" size={13} />Sync inbox</button>
                    ) : null}
                    {portal.status === "connected" ? (
                      <button className="btn btn-g btn-sm" disabled={busy || !onPause} onClick={() => onPause?.(portal.id)} type="button"><Pause aria-hidden="true" size={13} />Pause</button>
                    ) : null}
                    {portal.status !== "disabled" ? (
                      <button className={`btn btn-g btn-sm ${styles.danger}`} disabled={busy || !onDisable} onClick={() => onDisable?.(portal.id)} type="button"><Unplug aria-hidden="true" size={13} />Disable & delete Context</button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </LedgerCard>

      {availablePortals.length > 0 ? (
        <LedgerCard header={<><span className="type">Available portals</span><span className="mono">Reviewed login surfaces</span></>}>
          {availablePortals.map((source) => (
            <div className={styles.available} key={source.id}>
              <div>
                <strong>{source.platformName ?? source.name}</strong>
                <p><a href={source.url} rel="noreferrer" target="_blank">{source.domain}<ExternalLink aria-hidden="true" size={12} /></a>{source.platformName && source.platformName !== source.name ? ` · ${source.name}` : ""}</p>
              </div>
              <button className="btn btn-s btn-sm" disabled={!onCreate || workingId === source.id} onClick={() => onCreate?.(source.id, source.platformName ?? source.name)} type="button"><Link2 aria-hidden="true" size={13} />Prepare connection</button>
            </div>
          ))}
          <p className="hint">Preparing creates an isolated connection record. Authentication opens only after RoomScout&apos;s platform policy is approved.</p>
        </LedgerCard>
      ) : null}
    </div>
  );
}
