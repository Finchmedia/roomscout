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

/**
 * Read-only history of the external action ledger. Approvals are
 * Entscheidungen in the Scout chat (Kandidat B); execution belongs to the
 * server-side dispatcher, so this panel has no controls.
 */
type Props = {
  actions: ActionLifecycleItem[] | undefined;
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
  blocked: { label: "Gestoppt", tone: "warn" },
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

export function ActionLifecyclePanel({ actions }: Props) {
  if (actions === undefined) return <p className={styles.empty}>Loading action ledger…</p>;
  if (actions.length === 0) return <p className={styles.empty}>No persisted external actions yet.</p>;

  return (
    <div className={styles.panel}>
      {actions.map((action) => {
        const status = statusCopy[action.status];
        const providerStatus = executionLabel(action);

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

            {action.error || action.execution?.error ? <p className={styles.error} role="alert">{action.error ?? action.execution?.error}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
