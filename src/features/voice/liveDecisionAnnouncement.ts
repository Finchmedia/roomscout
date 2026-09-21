import { MESSAGE_DECISION_KINDS, type DecisionKind } from "../../../convex/lib/decisions";

type LiveDecision = {
  _id: string;
  kind: string;
  question: string;
  options: Array<{ id: string; label: string }>;
  questions?: Array<{ answer?: unknown }>;
  conversationId?: string;
  updatedAt: number;
};

/**
 * Mirrors MAX_APPEND_UTF8_BYTES in useGptLiveVoiceScout: an announcement longer
 * than this is split into several commentary appends, and every chunk is then
 * its own speakable item for the Live model. One decision must stay one append,
 * so the question is clipped until the whole sentence fits.
 * `liveDecisionAnnouncement.test.ts` pins this against the hook's own splitter.
 */
const MAX_ANNOUNCEMENT_UTF8_BYTES = 400;
const encoder = new TextEncoder();
const utf8Bytes = (value: string) => encoder.encode(value).length;

function clipForVoice(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function fitToOneAppend(build: (question: string) => string, question: string): string {
  let text = build(question);
  let length = question.length;
  while (length > 0 && utf8Bytes(text) > MAX_ANNOUNCEMENT_UTF8_BYTES) {
    const over = utf8Bytes(text) - MAX_ANNOUNCEMENT_UTF8_BYTES;
    length = Math.max(0, length - Math.max(4, Math.ceil(over / 2)));
    text = length > 0 ? build(`${question.slice(0, length).trimEnd()}…`) : build("");
  }
  return text;
}

/**
 * The one decision the voice delegate can answer, announced with its question,
 * the spoken options and the room, so the musician can answer in conversation.
 * Sending ("yes") and the offer review never become spoken options: those stay
 * in the app's review, and the announcement says so. How to handle the reply —
 * delegate it, do not announce it twice — is a standing rule of the Live
 * prompt (RESULT DELIVERY) and is deliberately not repeated here.
 */
export function formatLiveDecisionAnnouncement(decision: LiveDecision, room: string | undefined, locale: "en" | "de"): string {
  const question = clipForVoice(decision.question, 700);
  const about = room ? clipForVoice(room, 48) : (locale === "de" ? "eurer Suche" : "your search");
  const once = locale === "de" ? " Sprich sie einmal an der nächsten Pause an." : " Raise it once at the next pause.";
  if (MESSAGE_DECISION_KINDS.has(decision.kind as DecisionKind)) {
    return fitToOneAppend((text) => (locale === "de"
      ? `Bestätigte App-Aktualisierung: offene Nachrichtenentscheidung zu ${about}. Frage: ${text} Gesprochene Optionen: Nein oder eine andere Formulierung; das Senden wie formuliert passiert nur in der App-Prüfung, biete kein Ja an.${once}`
      : `Verified application update: an open message decision about ${about}. Question: ${text} Spoken options: no, or a different wording; sending as written happens only in the app review, so do not offer yes.${once}`), question);
  }
  if (decision.kind === "offer_ready") {
    return fitToOneAppend((text) => (locale === "de"
      ? `Bestätigte App-Aktualisierung: offene Angebotsentscheidung zu ${about}. Frage: ${text} Gesprochene Option: „nicht dieses“, gern mit Grund; Prüfen und Annehmen passiert nur in der App.${once}`
      : `Verified application update: an open offer decision about ${about}. Question: ${text} Spoken option: not this one, with a reason if they like; reviewing and accepting happens only in the app.${once}`), question);
  }
  // Whole labels only: a list cut mid-label would have the model offer an
  // option the card does not carry.
  const labels: string[] = [];
  for (const option of decision.options) {
    const label = clipForVoice(option.label, 40);
    if (!label) continue;
    if ([...labels, label].join(", ").length > 100) break;
    labels.push(label);
  }
  const quoted = labels.map(label => `“${label}”`).join(", ");
  const options = quoted
    ? (locale === "de" ? `Gesprochene Optionen: ${quoted}, oder eine eigene Antwort.` : `Spoken options: ${quoted}, or their own answer.`)
    : (locale === "de" ? "Gesprochene Optionen: keine; der Musiker antwortet in eigenen Worten." : "Spoken options: none; the musician answers in their own words.");
  return fitToOneAppend((text) => (locale === "de"
    ? `Bestätigte App-Aktualisierung: offene Frage zu ${about}. Frage: ${text} ${options}${once}`
    : `Verified application update: an open question about ${about}. Question: ${text} ${options}${once}`), question);
}
