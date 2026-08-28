import { LoaderCircle, Send } from "lucide-react";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import { LedgerCard } from "../ui/LedgerCard";

export type ScoutConversationMessage = {
  id: string;
  author: "scout" | "user" | "system";
  body: string;
};

type ScoutConversationProps = {
  messages: ScoutConversationMessage[];
  starters?: string[];
  onSend: (message: string) => Promise<void> | void;
  busy?: boolean;
  error?: string;
  compact?: boolean;
};

export function ScoutConversation({ messages, starters = [], onSend, busy = false, error, compact = false }: ScoutConversationProps) {
  const inputId = useId();
  const [draft, setDraft] = useState("");

  async function send(message: string) {
    if (busy) return;
    await onSend(message);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft("");
    await send(trimmed);
  }

  return (
    <LedgerCard
      className={`chat rs-scout-conversation${compact ? " rs-scout-conversation--compact" : ""}`}
      header={
        <>
          <span className="type t-scout">Scout conversation</span>
          <span className="mono">Nothing becomes active without your confirmation</span>
        </>
      }
    >
      <div aria-live="polite" className="msgs">
        {messages.map((message) => (
          <div className={`msg m-${message.author}`} key={message.id}>{message.body}</div>
        ))}
        {busy ? <div className="msg m-scout rs-scout-thinking"><LoaderCircle aria-hidden="true" className="rs-spin" size={14} />Scout is thinking…</div> : null}
      </div>
      {starters.length ? (
        <div aria-label="Conversation starters" className="starters">
          {starters.map((starter) => <button className="starter" disabled={busy} key={starter} onClick={() => send(starter)} type="button">{starter}</button>)}
        </div>
      ) : null}
      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor={inputId}>Message your Room Scout</label>
        <input className="input" disabled={busy} id={inputId} onChange={(event) => setDraft(event.target.value)} placeholder="Tell your Scout what matters…" value={draft} />
        <button aria-label="Send message" className="btn btn-p" disabled={busy || !draft.trim()} type="submit"><Send aria-hidden="true" size={15} />Send</button>
      </form>
      {error ? <p className="err" role="alert">{error}</p> : null}
    </LedgerCard>
  );
}
