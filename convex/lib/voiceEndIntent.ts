export type VoiceEndReason = "user_request" | "farewell";

const negatedEnd = /(?:\b(?:don't|do\s+not|never)\b.{0,30}\b(?:hang\s+up|end\s+(?:the\s+)?call|close\s+(?:the\s+)?call|disconnect|goodbye|bye)\b|\b(?:hang\s+up|end\s+(?:the\s+)?call|close\s+(?:the\s+)?call|disconnect)\b.{0,15}\bnot\b|\b(?:nicht|nie)\b.{0,30}\b(?:auflegen|auf|beenden|trennen|tschüss|wiedersehen)\b|\bleg(?:e)?\s+(?:bitte\s+)?nicht\s+auf\b)/iu;

const hypotheticalOrQuoted = /(?:\b(?:if|when|whenever|falls|wenn)\b.{0,70}\b(?:say|said|sag(?:e|st|t|en)?|sagt(?:e|en)?)\b|\b(?:say|said|saying|quote|quoted|phrase|word|instruction|example|mean|means|translate|sag(?:e|st|t|en)?|zitat|ausdruck|wort|anweisung|beispiel|bedeutet|übersetz(?:e|en)?)\b.{0,55}\b(?:hang\s+up|end\s+(?:the\s+)?call|goodbye|bye|see\s+you|tschüss|wiedersehen|bis\s+(?:später|bald|dann)|auflegen)\b)/iu;

const quotedEndPhrase = /["“”'„‚](?:please\s+|bitte\s+)?(?:hang\s+up|end\s+(?:the\s+)?call|goodbye|bye|see\s+you|leg(?:e)?\s+(?:bitte\s+)?auf|tschüss|auf\s+wiedersehen)["“”'“”‘’]/iu;

const unrelatedVoiceOrWorkControl = /^(?:please\s+|bitte\s+)?(?:stop\s+(?:speaking|talking|the\s+search)|pause\s+(?:the\s+)?search|mute(?:\s+yourself)?|hör\s+auf\s+zu\s+sprechen|sei\s+still|schalte\s+dich\s+stumm|pausiere|stoppe)\s*[.!?]*$/iu;

/** A narrow deterministic veto around the model-owned semantic intent decision. */
export function rejectsVoiceEndIntent(input: string): boolean {
  const normalized = input.replace(/\s+/g, " ").trim();
  return !normalized || negatedEnd.test(normalized) || hypotheticalOrQuoted.test(normalized) ||
    quotedEndPhrase.test(normalized) ||
    unrelatedVoiceOrWorkControl.test(normalized);
}

export function voiceEndFarewell(locale: "en" | "de", reason: VoiceEndReason): string {
  if (locale === "de") {
    return reason === "user_request" ? "Alles klar, ich beende den Anruf jetzt." : "Tschüss!";
  }
  return reason === "user_request" ? "Okay, I'll end the call now." : "Bye for now!";
}
