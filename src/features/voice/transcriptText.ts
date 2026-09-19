/** Hide speech delivery cues, preserving meaningful bracketed text and raw audio events. */
export function cleanVoiceTranscript(text: string): string {
  return text
    .replace(/\[\s*(?:chuckles?|chuckling|laughs?|laughter|laughing|sighs?|sighing|inhales?|exhales?|breathing|clears? throat|coughs?|coughing|gasps?|gasping)\s*\]/gi, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .trim();
}
