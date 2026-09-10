import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import styles from "./DemoSourceCheckControls.module.css";

type DemoSourceCheckControlsProps = {
  variant: "musician" | "operator";
};

const activeStatuses = new Set(["queued", "scraping", "processing", "waiting"]);

const statusLabels: Record<string, string> = {
  idle: "Bereit",
  queued: "Eingeplant",
  scraping: "Quelle wird geprüft",
  processing: "Treffer werden verarbeitet",
  waiting: "Wartet auf den nächsten Check",
  completed: "Abgeschlossen",
  stopped: "Gestoppt",
  failed: "Fehlgeschlagen",
};

function newRequestId(kind: "manual" | "demo") {
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${kind}:${unique}`;
}

function mutationError(error: unknown) {
  if (error instanceof Error && /rate.?limit|too many/i.test(error.message)) {
    return "Das Anfrage-Limit ist erreicht. Bitte versuche es später erneut.";
  }
  return "Der Auftrag konnte nicht bestätigt werden. Erneut versuchen nutzt dieselbe Anfrage sicher weiter.";
}

export function DemoSourceCheckControls({ variant }: DemoSourceCheckControlsProps) {
  const status = useQuery(api.demoSourceChecks.status, {});
  const requestNow = useMutation(api.demoSourceChecks.requestNow);
  const startDemo = useMutation(api.demoSourceChecks.startDemo);
  const stopDemo = useMutation(api.demoSourceChecks.stopDemo);
  const requestIds = useRef<Partial<Record<"manual" | "demo", string>>>({});
  const [working, setWorking] = useState<"manual" | "demo" | "stop" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const active = status ? activeStatuses.has(status.status) : false;

  async function start(kind: "manual" | "demo") {
    const requestId = requestIds.current[kind] ?? newRequestId(kind);
    requestIds.current[kind] = requestId;
    setWorking(kind);
    setFeedback("");
    setIsError(false);
    try {
      const result = await (kind === "manual"
        ? requestNow({ requestId })
        : startDemo({ requestId }));
      requestIds.current[kind] = undefined;
      setFeedback(
        result.accepted
          ? kind === "manual"
            ? "Quellenprüfung eingeplant."
            : "10-Minuten-Demo gestartet."
          : "Eine Quellenprüfung läuft bereits.",
      );
    } catch (error) {
      setIsError(true);
      setFeedback(mutationError(error));
    } finally {
      setWorking(null);
    }
  }

  async function stop() {
    setWorking("stop");
    setFeedback("");
    setIsError(false);
    try {
      const result = await stopDemo({});
      setFeedback(result.accepted ? "Demo wird gestoppt." : "Keine laufende Demo gefunden.");
    } catch (error) {
      setIsError(true);
      setFeedback(mutationError(error));
    } finally {
      setWorking(null);
    }
  }

  return (
    <section
      aria-label="Demo-Quellenprüfung"
      className={`${styles.panel} ${variant === "operator" ? styles.operator : ""}`}
    >
      <h2 className={styles.heading}>Live-Check · nur roomscout.dev</h2>
      <p className={styles.summary} aria-live="polite">
        {!status ? "Status wird geladen …" : statusLabels[status.status]}
      </p>
      {status ? (
        <div className={styles.metrics}>
          <span className={styles.metric}>Checks {status.checksCompleted}/{status.maxChecks}</span>
          <span className={styles.metric}>Detailseiten {status.detailPagesUsed}/{status.maxDetailPages}</span>
          {status.mode ? <span className={styles.metric}>{status.mode === "demo" ? "10-Min.-Demo" : "Einmalig"}</span> : null}
          {status.mode === "demo" && status.expiresAt ? (
            <span className={styles.metric}>
              Ende {new Date(status.expiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>
      ) : null}
      {status?.status === "failed" ? (
        <p className={styles.feedback} role="alert">
          Der Check wurde beendet. Bitte erneut starten; bleibt das Problem bestehen, Konfiguration und Provider-Status prüfen.
        </p>
      ) : null}
      <div className={styles.actions}>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={working !== null || active || status === undefined}
          onClick={() => void start("manual")}
          type="button"
        >
          {working === "manual" ? "Wird eingeplant …" : "Jetzt Quellen prüfen"}
        </button>
        {variant === "operator" ? (
          active && status?.mode === "demo" ? (
            <button className={styles.button} disabled={working !== null} onClick={() => void stop()} type="button">
              {working === "stop" ? "Wird gestoppt …" : "Demo stoppen"}
            </button>
          ) : (
            <button className={styles.button} disabled={working !== null || active || status === undefined} onClick={() => void start("demo")} type="button">
              {working === "demo" ? "Startet …" : "10-Minuten-Demo starten"}
            </button>
          )
        ) : null}
      </div>
      <p className={styles.note}>
        {variant === "musician"
          ? "Ein Lauf: höchstens 1 Check und 5 Detailseiten; keine Kostenfreigabe."
          : `Begrenzt auf ${status?.maxChecks ?? 10} Checks und ${status?.maxDetailPages ?? 50} Detailseiten; keine Kostenfreigabe.`}
      </p>
      {feedback ? <p className={styles.feedback} role={isError ? "alert" : "status"}>{feedback}</p> : null}
    </section>
  );
}
