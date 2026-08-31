import { CircleStop, Mic, MicOff, PhoneOff, Send, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRealtimeVoiceScout } from "../../hooks/useRealtimeVoiceScout";
import type { UseRealtimeVoiceScoutOptions, VoiceScoutStatus } from "../../hooks/useRealtimeVoiceScout";
import { VoiceVolumeBlob } from "./VoiceVolumeBlob";
import styles from "./RealtimeVoiceScout.module.css";

const statusCopy: Record<VoiceScoutStatus, { label: string; description: string }> = {
  idle: { label: "Ready", description: "Start when you want to describe your search out loud." },
  requesting_microphone: { label: "Microphone", description: "Waiting for microphone permission…" },
  connecting: { label: "Connecting", description: "Opening the encrypted WebRTC session…" },
  creating_session: { label: "Securing session", description: "Convex is opening the private Realtime session…" },
  listening: { label: "Listening", description: "Talk naturally. Your Scout will turn the conversation into a search." },
  thinking: { label: "Thinking", description: "Your Scout is structuring what it heard." },
  speaking: { label: "Scout speaking", description: "Interrupt at any time by speaking or pressing stop." },
  disconnected: { label: "Ended", description: "The voice session has ended. Start a new one whenever you are ready." },
  error: { label: "Needs attention", description: "The voice session could not continue." },
};

export type RealtimeVoiceScoutProps = UseRealtimeVoiceScoutOptions & {
  title?: string;
  className?: string;
};

export function RealtimeVoiceScout({
  title = "Talk to your Room Scout",
  className = "",
  ...options
}: RealtimeVoiceScoutProps) {
  const voice = useRealtimeVoiceScout(options);
  const [draft, setDraft] = useState("");
  const status = statusCopy[voice.status];
  const busy = ["requesting_microphone", "connecting", "creating_session"].includes(voice.status);
  const active = voice.connected || ["listening", "thinking", "speaking"].includes(voice.status);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (voice.sendText(draft)) setDraft("");
  }

  return (
    <section aria-label="Realtime Room Scout" className={`${styles.panel}${className ? ` ${className}` : ""}`}>
      <div className={styles.presence}>
        <p className={styles.eyebrow}><Sparkles aria-hidden="true" size={12} /> OpenAI Realtime · WebRTC</p>
        <VoiceVolumeBlob active={active && !voice.muted} label={`${status.label} audio activity`} volume={voice.volume} />
        <div><h2>{title}</h2><p className={styles.description}>{voice.error ?? status.description}</p></div>
        <div aria-live="polite" className={styles.status}>
          <span aria-hidden="true" className={`${styles.statusDot}${active ? ` ${styles.statusDotLive}` : ""}`} />
          {status.label}{voice.muted ? " · muted" : ""}
        </div>
        <div className={styles.controls}>
          {!active ? (
            <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy} onClick={() => void voice.connect()} type="button">
              <Mic aria-hidden="true" size={16} />{busy ? "Connecting…" : "Start voice Scout"}
            </button>
          ) : (
            <>
              <button className={styles.button} onClick={() => voice.setMuted(!voice.muted)} type="button">
                {voice.muted ? <MicOff aria-hidden="true" size={16} /> : <Mic aria-hidden="true" size={16} />}{voice.muted ? "Unmute" : "Mute"}
              </button>
              {voice.status === "speaking" ? <button className={styles.button} onClick={voice.interrupt} type="button"><CircleStop aria-hidden="true" size={16} />Interrupt</button> : null}
              <button className={`${styles.button} ${styles.buttonDanger}`} onClick={voice.disconnect} type="button"><PhoneOff aria-hidden="true" size={16} />End</button>
            </>
          )}
        </div>
      </div>

      <div className={styles.conversation}>
        <header className={styles.conversationHeader}>
          <h3>Live conversation</h3>
          <div aria-label="Scout response modality" className={styles.segmented} role="group">
            <button aria-pressed={voice.modality === "voice"} className={voice.modality === "voice" ? styles.selected : undefined} onClick={() => voice.setModality("voice")} type="button"><Volume2 aria-hidden="true" size={13} /> Voice</button>
            <button aria-pressed={voice.modality === "text"} className={voice.modality === "text" ? styles.selected : undefined} onClick={() => voice.setModality("text")} type="button">Text</button>
          </div>
        </header>
        <div aria-live="polite" className={styles.transcript}>
          {voice.transcript.length === 0 ? <p className={styles.empty}>The transcript appears here after the session starts. Audio remains part of the private Scout session.</p> : voice.transcript.map((item) => (
            <div className={`${styles.message}${item.role === "user" ? ` ${styles.messageUser}` : ""}${item.final ? "" : ` ${styles.messageStreaming}`}`} key={item.id}>
              <span className={styles.messageMeta}>{item.role === "user" ? "You" : "Room Scout"}</span>
              {item.text}
            </div>
          ))}
        </div>
        <form className={styles.composer} onSubmit={submit}>
          <label className="sr-only" htmlFor="realtime-voice-text">Type to the active Scout session</label>
          <input className={styles.input} disabled={!active} id="realtime-voice-text" onChange={(event) => setDraft(event.target.value)} placeholder={active ? "Type instead of speaking…" : "Start the session to type…"} value={draft} />
          <button aria-label="Send text to Scout" className={`${styles.button} ${styles.buttonPrimary}`} disabled={!active || !draft.trim()} type="submit"><Send aria-hidden="true" size={15} /></button>
        </form>
      </div>
    </section>
  );
}
