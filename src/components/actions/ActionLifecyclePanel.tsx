import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import styles from "./ActionLifecyclePanel.module.css";

type ActionStatus = Doc<"actionRequests">["status"];
type Executor = "firecrawl" | "browserbase" | "agentmail" | "direct_api" | "manual";

export type ActionLifecycleItem = Pick<
  Doc<"actionRequests">,
  "_id" | "requestedActionType" | "payload" | "status" | "error" | "updatedAt"
> & {
  executor?: Executor;
  execution?: {
    id: Id<"actionExecutions">;
    status: Doc<"actionExecutions">["status"];
    error?: string;
    updatedAt: number;
  };
};

export type EphemeralActionExecution = {
  executionId?: Id<"actionExecutions">;
  state: string;
  reasonCode?: string;
  liveViewUrl?: string;
  interactiveLiveViewUrl?: string;
  liveViewExpiresAt?: number;
  filled?: string[];
  missing?: string[];
  blockers?: string[];
};

type Props = {
  actions: ActionLifecycleItem[] | undefined;
  busyActionId?: Id<"actionRequests">;
  executionResults: Partial<Record<Id<"actionRequests">, EphemeralActionExecution>>;
  onReview: (requestId: Id<"actionRequests">) => void;
  onExecute: (action: ActionLifecycleItem) => Promise<void> | void;
  onConfirmHumanCompleted: (requestId: Id<"actionRequests">, submitted: boolean) => Promise<void> | void;
};

const statusCopy: Record<ActionStatus, { label: string; tone: string }> = {
  drafted: { label: "Draft", tone: "" },
  awaiting_approval: { label: "Approval needed", tone: "warn" },
  approved: { label: "Approved", tone: "new" },
  rejected: { label: "Rejected", tone: "warn" },
  queued: { label: "Queued", tone: "new" },
  executing: { label: "Executing", tone: "new" },
  executed: { label: "Executed", tone: "new" },
  failed: { label: "Failed", tone: "warn" },
  cancelled: { label: "Cancelled", tone: "warn" },
  expired: { label: "Expired", tone: "warn" },
};

function actionLabel(action: ActionLifecycleItem): string {
  return action.requestedActionType.replaceAll("_", " ");
}

function destination(action: ActionLifecycleItem): string {
  const payload = action.payload;
  if (payload.kind === "email_message") return payload.recipientEmail;
  if (payload.kind === "contact_form") return payload.targetUrl;
  if (payload.kind === "platform_message") {
    return payload.recipients.join(", ") || "Existing platform thread";
  }
  return payload.accountLabel ?? `Portal connection ${payload.connectionId}`;
}

function executionLabel(action: ActionLifecycleItem): string | undefined {
  if (action.execution?.status === "unknown") return "Outcome unknown";
  if (action.execution?.status === "running" || action.execution?.status === "claimed") {
    return "Provider running";
  }
  return undefined;
}

function canExecute(action: ActionLifecycleItem): boolean {
  return (action.status === "approved" || (action.status === "executing" && action.execution?.status !== "unknown")) &&
    (action.executor === "firecrawl" || action.executor === "browserbase");
}

function needsHumanConfirmation(result: EphemeralActionExecution | undefined): boolean {
  return result?.state === "human_required" && Boolean(result.liveViewUrl || result.interactiveLiveViewUrl);
}

export function ActionLifecyclePanel({
  actions,
  busyActionId,
  executionResults,
  onReview,
  onExecute,
  onConfirmHumanCompleted,
}: Props) {
  if (actions === undefined) return <p className={styles.empty}>Loading action ledger…</p>;
  if (actions.length === 0) return <p className={styles.empty}>No persisted external actions yet.</p>;

  return (
    <div className={styles.panel}>
      {actions.map((action) => {
        const status = statusCopy[action.status];
        const providerStatus = executionLabel(action);
        const result = executionResults[action._id];
        const liveViewUrl = result?.interactiveLiveViewUrl ?? result?.liveViewUrl;
        const busy = busyActionId === action._id;
        const humanConfirmation = needsHumanConfirmation(result);
        const retry = action.status === "executing";

        return (
          <article className={styles.card} data-state={action.status} key={action._id}>
            <header className={styles.header}>
              <h3 className={styles.title}>{actionLabel(action)}</h3>
              <span className={`pill ${status.tone}`}>{providerStatus ?? status.label}</span>
            </header>
            <p className={styles.destination}>{destination(action)}</p>
            <div className={styles.meta}>
              <span>{action.executor ?? "No executor"}</span>
              <span>·</span>
              <time dateTime={new Date(action.updatedAt).toISOString()}>
                {new Date(action.updatedAt).toLocaleString()}
              </time>
            </div>

            {action.status === "awaiting_approval" ? (
              <div className={styles.controls}>
                <button className="btn btn-p btn-sm" onClick={() => onReview(action._id)} type="button">
                  <ShieldCheck aria-hidden="true" size={13} />Review exact action
                </button>
              </div>
            ) : null}

            {canExecute(action) && !humanConfirmation ? (
              <div className={styles.controls}>
                <button className="btn btn-p btn-sm" disabled={busy} onClick={() => void onExecute(action)} type="button">
                  {busy ? <LoaderCircle aria-hidden="true" className="rs-spin" size={13} /> : retry ? <RotateCcw aria-hidden="true" size={13} /> : <Play aria-hidden="true" size={13} />}
                  {busy ? "Starting…" : retry ? "Resume provider" : "Execute approved action"}
                </button>
              </div>
            ) : null}

            {action.status === "approved" && !canExecute(action) ? (
              <p className={styles.notice}><CircleAlert aria-hidden="true" size={12} /> This approved action has no supported provider executor.</p>
            ) : null}

            {humanConfirmation ? (
              <div className={styles.humanBoundary}>
                <p className={styles.notice}>The provider paused at a human-only step. Open the ephemeral Live View, then explicitly tell RoomScout whether you submitted.</p>
                {liveViewUrl ? <a className={styles.liveView} href={liveViewUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={13} />Open ephemeral Live View</a> : null}
                <div className={styles.humanControls}>
                  <button className="btn btn-p btn-sm" disabled={busy} onClick={() => void onConfirmHumanCompleted(action._id, true)} type="button"><CheckCircle2 aria-hidden="true" size={13} />I submitted it</button>
                  <button className="btn btn-g btn-sm" disabled={busy} onClick={() => void onConfirmHumanCompleted(action._id, false)} type="button"><XCircle aria-hidden="true" size={13} />Cancel action</button>
                </div>
              </div>
            ) : null}

            {result?.reasonCode && !humanConfirmation ? <p className={styles.notice}>{result.reasonCode.replaceAll("_", " ").toLowerCase()}</p> : null}
            {action.error || action.execution?.error ? <p className={styles.error} role="alert">{action.error ?? action.execution?.error}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
