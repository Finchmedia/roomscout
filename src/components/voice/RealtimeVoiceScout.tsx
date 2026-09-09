import {
  CircleStop,
  Keyboard,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { VoiceScoutStatus } from "../../hooks/useRealtimeVoiceScout";
import type { ScoutFact } from "../../features/scout/viewModel";
import { ScoutFactList } from "../scout/ScoutFactList";
import { useVoiceSession } from "./VoiceSessionContext";
import { VoiceVolumeBlob } from "./VoiceVolumeBlob";
import styles from "./RealtimeVoiceScout.module.css";

const statusCopy: Record<VoiceScoutStatus, string> = {
  idle: "Bereit, wenn du es bist",
  requesting_microphone: "Warte auf Mikrofonfreigabe …",
  connecting: "Verbinde …",
  creating_session: "Gespräch wird vorbereitet …",
  listening: "Ich höre zu",
  thinking: "Ich denke kurz nach",
  speaking: "Dein Scout spricht",
  disconnected: "Gespräch beendet",
  error: "Verbindung unterbrochen",
};

export type RealtimeVoiceScoutProps = {
  title?: string;
  className?: string;
  facts?: ScoutFact[];
  onEnd?: () => void;
};

export function RealtimeVoiceScout(props: RealtimeVoiceScoutProps) {
  const {
    title = "Erzähl mir, was ihr sucht.",
    className = "",
    facts = [],
    onEnd,
  } = props;
  const voice = useVoiceSession();
  const [draft, setDraft] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const busy = [
    "requesting_microphone",
    "connecting",
    "creating_session",
  ].includes(voice.status);
  const active =
    voice.connected ||
    ["listening", "thinking", "speaking"].includes(voice.status);
  const latest = useMemo(
    () => [...voice.transcript].reverse().find((item) => item.text.trim()),
    [voice.transcript],
  );
  const caption =
    latest?.text ||
    (active ? "Sag einfach, was bei eurem Proberaum wichtig ist." : title);
  const speaker = latest
    ? latest.role === "user"
      ? "Du"
      : "Dein Scout"
    : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (voice.sendText(draft)) setDraft("");
  }

  function end() {
    voice.disconnect();
    onEnd?.();
  }

  return (
    <section
      aria-label="Gespräch mit deinem Room Scout"
      className={`${styles.stage}${facts.length ? ` ${styles.withFacts}` : ""}${className ? ` ${className}` : ""}`}
    >
      <div className={styles.center}>
        <VoiceVolumeBlob
          active={active && !voice.muted}
          label="Sprachaktivität"
          state={voice.status}
          volume={voice.volume}
        />
        <div aria-atomic="true" aria-live="polite" className={styles.caption}>
          {speaker ? <span>{speaker}</span> : null}
          <p>{caption}</p>
        </div>
        <div
          aria-live="polite"
          className={`${styles.connection} ${voice.error ? styles.connectionError : ""}`}
        >
          <i aria-hidden="true" />
          {voice.error ?? statusCopy[voice.status]}
          {voice.muted ? " · Mikro aus" : ""}
        </div>
        <div
          aria-label="Gesprächssteuerung"
          className={styles.controls}
          role="group"
        >
          {!active && !busy ? (
            <button
              aria-label={
                voice.status === "error" || voice.status === "disconnected"
                  ? "Gespräch erneut starten"
                  : "Gespräch starten"
              }
              className={styles.primaryControl}
              onClick={() => void voice.connect()}
              type="button"
            >
              {voice.status === "error" || voice.status === "disconnected" ? (
                <RotateCcw />
              ) : (
                <Mic />
              )}
            </button>
          ) : null}
          {busy ? (
            <button
              aria-label="Verbindungsaufbau abbrechen"
              className={styles.endControl}
              onClick={end}
              type="button"
            >
              <X />
            </button>
          ) : null}
          {active ? (
            <>
              <button
                aria-label={
                  voice.muted ? "Mikrofon einschalten" : "Mikrofon ausschalten"
                }
                aria-pressed={voice.muted}
                onClick={() => voice.setMuted(!voice.muted)}
                type="button"
              >
                {voice.muted ? <MicOff /> : <Mic />}
              </button>
              {voice.status === "speaking" ? (
                <button
                  aria-label="Scout unterbrechen"
                  onClick={voice.interrupt}
                  type="button"
                >
                  <CircleStop />
                </button>
              ) : null}
              <button
                aria-label="Gespräch beenden"
                className={styles.endControl}
                onClick={end}
                type="button"
              >
                <PhoneOff />
              </button>
            </>
          ) : null}
          <button
            aria-label={
              transcriptOpen ? "Mitschrift schließen" : "Mitschrift öffnen"
            }
            aria-pressed={transcriptOpen}
            onClick={() => setTranscriptOpen((open) => !open)}
            type="button"
          >
            <span className={styles.transcriptIcon}>≡</span>
          </button>
          <button
            aria-label={
              composerOpen ? "Texteingabe schließen" : "Per Text schreiben"
            }
            aria-pressed={composerOpen}
            onClick={() => setComposerOpen((open) => !open)}
            type="button"
          >
            <Keyboard />
          </button>
        </div>
        {composerOpen ? (
          <form className={styles.composer} onSubmit={submit}>
            <label className="sr-only" htmlFor="realtime-voice-text">
              Nachricht an deinen Scout
            </label>
            <input
              autoFocus
              disabled={!active}
              id="realtime-voice-text"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                active ? "Schreib deinem Scout …" : "Starte zuerst das Gespräch"
              }
              value={draft}
            />
            <button
              aria-label="Nachricht senden"
              disabled={!active || !draft.trim()}
              type="submit"
            >
              <Send />
            </button>
          </form>
        ) : null}
        {active ? (
          <button
            className={styles.modeSwitch}
            onClick={() =>
              voice.setModality(voice.modality === "voice" ? "text" : "voice")
            }
            type="button"
          >
            {voice.modality === "voice"
              ? "Antworten als Text"
              : "Antworten mit Stimme"}
          </button>
        ) : null}
      </div>
      {facts.length ? (
        <aside className={styles.facts}>
          <ScoutFactList facts={facts} heading="Eure Wünsche" />
        </aside>
      ) : null}
      {transcriptOpen ? (
        <aside aria-label="Mitschrift" className={styles.drawer}>
          <header>
            <h3>Mitschrift</h3>
            <button
              aria-label="Mitschrift schließen"
              onClick={() => setTranscriptOpen(false)}
              type="button"
            >
              <X />
            </button>
          </header>
          <div>
            {voice.transcript.some((item) => item.text.trim()) ? (
              voice.transcript
                .filter((item) => item.text.trim())
                .map((item) => (
                  <p
                    className={item.role === "user" ? styles.userLine : ""}
                    key={item.id}
                  >
                    <small>{item.role === "user" ? "Du" : "Dein Scout"}</small>
                    {item.text}
                  </p>
                ))
            ) : (
              <em>Noch keine Äußerungen.</em>
            )}
          </div>
        </aside>
      ) : null}
    </section>
  );
}
