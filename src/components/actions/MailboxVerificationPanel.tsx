import { Archive, ExternalLink, MailCheck } from "lucide-react";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import styles from "./MailboxVerificationPanel.module.css";

type MailboxMessage = {
  _id: Id<"mailboxMessages">;
  from: string;
  subject: string;
  body: string;
  kind: "portal_verification" | "general";
  status: "unread" | "read" | "archived";
  receivedAt: number;
};

type Props = {
  messages: MailboxMessage[] | undefined;
  onStatusChange: (messageId: Id<"mailboxMessages">, status: "read" | "archived") => Promise<void> | void;
};

const LINK_SPLIT = /(https?:\/\/[^\s<>"']+)/gi;

function LinkedPlainText({ body }: { body: string }) {
  return (
    <p className={styles.body}>
      {body.split(LINK_SPLIT).map((part, index) => part.toLowerCase().startsWith("http")
        ? <a href={part} key={`${part}:${index}`} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={10} />{part}</a>
        : part)}
    </p>
  );
}

export function MailboxVerificationPanel({ messages, onStatusChange }: Props) {
  const [openId, setOpenId] = useState<Id<"mailboxMessages">>();
  const [workingId, setWorkingId] = useState<Id<"mailboxMessages">>();
  const visible = messages?.filter((message) => message.status !== "archived") ?? [];
  const unreadCount = visible.filter((message) => message.status === "unread").length;

  async function openMessage(message: MailboxMessage) {
    setOpenId((current) => current === message._id ? undefined : message._id);
    if (message.status !== "unread") return;
    setWorkingId(message._id);
    try {
      await onStatusChange(message._id, "read");
    } finally {
      setWorkingId(undefined);
    }
  }

  async function archiveMessage(messageId: Id<"mailboxMessages">) {
    setWorkingId(messageId);
    try {
      await onStatusChange(messageId, "archived");
      setOpenId((current) => current === messageId ? undefined : current);
    } finally {
      setWorkingId(undefined);
    }
  }

  if (messages === undefined) return <p className={styles.empty}>Loading personal mailbox…</p>;
  if (visible.length === 0) return <p className={styles.empty}>No unmatched account or verification mail.</p>;

  return (
    <div className={styles.panel}>
      <div className={styles.summary}><p>{visible.length} message{visible.length === 1 ? "" : "s"}</p><span className={`pill ${unreadCount ? "new" : ""}`}>{unreadCount} unread</span></div>
      <div className={styles.list}>
        {visible.slice(0, 6).map((message) => {
          const open = openId === message._id;
          const working = workingId === message._id;
          return (
            <article className={styles.message} data-unread={message.status === "unread"} key={message._id}>
              <button aria-expanded={open} className={styles.messageHeader} disabled={working} onClick={() => void openMessage(message)} type="button">
                <strong>{message.subject || "Message without subject"}</strong>
                <span className={styles.meta}>{message.kind.replaceAll("_", " ")} · {message.from} · {new Date(message.receivedAt).toLocaleString()}</span>
              </button>
              {open ? (
                <>
                  <LinkedPlainText body={message.body} />
                  <div className={styles.controls}>
                    <button className="btn btn-g btn-sm" disabled={working} onClick={() => void archiveMessage(message._id)} type="button"><Archive aria-hidden="true" size={12} />Archive</button>
                  </div>
                </>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className={styles.safety}><MailCheck aria-hidden="true" size={10} /> Verification links are opened only by you. RoomScout never follows them automatically.</p>
    </div>
  );
}
