import { LoaderCircle, Mic, Send } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import styles from "./ScoutConversation.module.css";

export type ScoutConversationMessage = {
  id: string;
  author: "scout" | "user" | "system";
  body: string;
};

type ScoutConversationProps = {
  messages: ScoutConversationMessage[];
  starters?: string[];
  onSend: (message: string) => Promise<void | boolean> | void | boolean;
  onVoice?: () => void;
  busy?: boolean;
  error?: string;
  compact?: boolean;
  autoFocus?: boolean;
};

function renderScoutFormatting(body: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const boldPattern = /\*\*([^*\n]+)\*\*/g;
  let cursor = 0;
  for (const match of body.matchAll(boldPattern)) {
    const start = match.index;
    if (start > cursor) parts.push(body.slice(cursor, start));
    parts.push(<strong key={`${start}:${match[1]}`}>{match[1]}</strong>);
    cursor = start + match[0].length;
  }
  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}

export function ScoutConversation({
  messages,
  starters = [],
  onSend,
  onVoice,
  busy = false,
  error,
  compact = false,
  autoFocus = false,
}: ScoutConversationProps) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  async function send(message: string) {
    if (busy) return false;
    return await onSend(message);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    if ((await send(message)) !== false) setDraft("");
  }
  return (
    <section
      aria-label="Scout conversation"
      className={`${styles.conversation}${compact ? ` ${styles.compact}` : ""}`}
    >
      <div aria-live="polite" className={styles.messages}>
        {messages.map((message) => (
          <div
            className={`${styles.message} ${styles[message.author]}`}
            key={message.id}
          >
            {message.author === "user"
              ? message.body
              : renderScoutFormatting(message.body)}
          </div>
        ))}
        {busy ? (
          <div
            className={`${styles.message} ${styles.scout} ${styles.thinking}`}
          >
            <LoaderCircle aria-hidden="true" size={15} />
            Scout is thinking…
          </div>
        ) : null}
      </div>
      {starters.length ? (
        <div aria-label="Conversation starters" className={styles.starters}>
          {starters.map((starter) => (
            <button
              disabled={busy}
              key={starter}
              onClick={() => void send(starter)}
              type="button"
            >
              {starter}
            </button>
          ))}
        </div>
      ) : null}
      <form className={styles.composer} onSubmit={submit}>
        <label className="sr-only" htmlFor={inputId}>
          Message your Room Scout
        </label>
        <input
          autoFocus={autoFocus}
          disabled={busy}
          id={inputId}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tell Scout what matters…"
          value={draft}
        />
        {onVoice ? (
          <button
            aria-label="Talk to Scout"
            className={styles.voice}
            onClick={onVoice}
            type="button"
          >
            <Mic aria-hidden="true" size={18} />
          </button>
        ) : null}
        <button
          aria-label="Send message"
          className={styles.send}
          disabled={busy || !draft.trim()}
          type="submit"
        >
          <Send aria-hidden="true" size={18} />
        </button>
      </form>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
