export type LiveLocale = "en" | "de";
export type LiveSpeakerRole = "user" | "assistant";

export type LiveTranscriptFragment = {
  sequence: number;
  eventId: string;
  role: LiveSpeakerRole;
  text: string;
  startMs: number;
  endMs: number;
};

export type LiveTranscriptEvent = {
  type: "session.input_transcript.delta" | "session.output_transcript.delta";
  event_id: string;
  delta: string;
  start_ms: number;
  end_ms: number;
};

export type LiveDelegationEvent = {
  type: "session.delegation.created";
  offset_ms?: number;
  delegation: { id: string; type: "delegation"; target: "client" };
};

export type LiveServerEvent = {
  type: string;
  event_id?: string;
  client_event_id?: string;
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  reason?: string;
  delegation?: { id?: string; type?: string; target?: string };
  error?: { code?: string | null; message?: string; client_event_id?: string };
  [key: string]: unknown;
};

export type LiveCaptionRow = {
  id: string;
  role: LiveSpeakerRole;
  text: string;
  startMs: number;
  endMs: number;
};

export type LiveDelegationSnapshot = {
  delegationId: string;
  maxSequence: number;
  fragments: LiveTranscriptFragment[];
  unresolvedUserEventIds: string[];
};

export type LiveCaptureCandidate = {
  fragments: LiveTranscriptFragment[];
  maxSequence: number;
  text: string;
};

const FACT_SIGNAL = /\b(?:rehearsal|practice|proberaum|probe|room|raum|studio|location|city|stadt|near|nähe|radius|kilomet|\bkm\b|budget|euro|month|monat|week|woche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morning|afternoon|evening|morgen|nachmittag|abend|band|member|mitglied|people|person|piece|musician|musiker|drum|schlagzeug|equipment|gear|verstärker|amp|storage|lager|leave|stehen lassen|noise|laut|accessible|barriere|parking|parkplatz)\b|€/iu;
const COMPLETE_CLAUSE = /[.!?](?:["')\]]*)\s*$/u;
const MAX_DELEGATE_FRAGMENTS = 1_024;
const MAX_DELEGATE_CHARACTERS = 64_000;

export class GptLiveContextOverflowError extends Error {
  constructor() {
    super("The conversation is too large to delegate safely. Restart voice from the saved brief.");
    this.name = "GptLiveContextOverflowError";
  }
}

export function isConservativeFactStatement(text: string): boolean {
  const normalized = text.trim();
  const words = normalized.match(/[\p{L}\p{N}€]+/gu) ?? [];
  return normalized.length >= 18 && words.length >= 3 && COMPLETE_CLAUSE.test(normalized) && FACT_SIGNAL.test(normalized);
}

/**
 * Browser-only transcript state. Provider event IDs are opaque dedupe keys; the
 * monotonic sequence records arrival order so a late fragment is never dropped
 * because its audio interval predates an earlier delegation.
 */
export class GptLiveFragmentBuffer {
  readonly #fragments: LiveTranscriptFragment[] = [];
  readonly #receivedIds = new Set<string>();
  readonly #resolvedUserIds = new Set<string>();
  #sequence = 0;
  #processedCursor = 0;

  append(event: LiveTranscriptEvent): LiveTranscriptFragment | undefined {
    if (this.#receivedIds.has(event.event_id)) return undefined;
    const fragment: LiveTranscriptFragment = {
      sequence: ++this.#sequence,
      eventId: event.event_id,
      role: event.type === "session.input_transcript.delta" ? "user" : "assistant",
      text: event.delta,
      startMs: event.start_ms,
      endMs: event.end_ms,
    };
    this.#receivedIds.add(event.event_id);
    this.#fragments.push(fragment);
    this.#advanceCursor();
    return fragment;
  }

  snapshot(delegationId: string): LiveDelegationSnapshot {
    const unresolvedUserFragments = this.unresolvedUserFragments();
    const unresolvedIds = new Set(unresolvedUserFragments.map((fragment) => fragment.eventId));
    const requiredCharacters = unresolvedUserFragments.reduce(
      (total, fragment) => total + fragment.text.length,
      0,
    );
    if (
      unresolvedUserFragments.length > MAX_DELEGATE_FRAGMENTS ||
      requiredCharacters > MAX_DELEGATE_CHARACTERS
    ) {
      throw new GptLiveContextOverflowError();
    }
    let remainingFragments = MAX_DELEGATE_FRAGMENTS - unresolvedUserFragments.length;
    let remainingCharacters = MAX_DELEGATE_CHARACTERS - requiredCharacters;
    const optionalIds = new Set<string>();
    for (let index = this.#fragments.length - 1; index >= 0 && remainingFragments > 0; index -= 1) {
      const fragment = this.#fragments[index]!;
      if (unresolvedIds.has(fragment.eventId) || fragment.text.length > remainingCharacters) continue;
      optionalIds.add(fragment.eventId);
      remainingFragments -= 1;
      remainingCharacters -= fragment.text.length;
    }
    const fragments = this.#fragments.filter(
      (fragment) => unresolvedIds.has(fragment.eventId) || optionalIds.has(fragment.eventId),
    );
    return {
      delegationId,
      maxSequence: this.#sequence,
      fragments,
      unresolvedUserEventIds: unresolvedUserFragments.map((fragment) => fragment.eventId),
    };
  }

  captureCandidate(afterSequence: number): LiveCaptureCandidate | undefined {
    const userFragments = this.#fragments.filter(
      (fragment) => fragment.role === "user" && fragment.sequence > afterSequence,
    );
    let text = "";
    let boundary = -1;
    for (let index = 0; index < userFragments.length; index += 1) {
      text += userFragments[index]!.text;
      if (COMPLETE_CLAUSE.test(text)) boundary = index;
    }
    if (boundary < 0) return undefined;
    const fragments = userFragments.slice(0, boundary + 1);
    const completedText = fragments.map((fragment) => fragment.text).join("");
    if (!isConservativeFactStatement(completedText)) return undefined;
    return {
      fragments,
      maxSequence: fragments.at(-1)!.sequence,
      text: completedText,
    };
  }

  resolve(eventIds: readonly string[]): void {
    const userIds = new Set(
      this.#fragments.filter((fragment) => fragment.role === "user").map((fragment) => fragment.eventId),
    );
    for (const eventId of eventIds) {
      if (userIds.has(eventId)) this.#resolvedUserIds.add(eventId);
    }
    this.#advanceCursor();
  }

  unresolvedUserFragments(): LiveTranscriptFragment[] {
    return this.#fragments.filter(
      (fragment) => fragment.role === "user" && !this.#resolvedUserIds.has(fragment.eventId),
    );
  }

  hasNewerUnresolvedUserInput(maxSequence: number): boolean {
    return this.unresolvedUserFragments().some((fragment) => fragment.sequence > maxSequence);
  }

  fragments(): LiveTranscriptFragment[] {
    return [...this.#fragments];
  }

  processedCursor(): number {
    return this.#processedCursor;
  }

  captions(gapMs = 900): LiveCaptionRow[] {
    const rows: LiveCaptionRow[] = [];
    for (const fragment of [...this.#fragments].sort(
      (left, right) => left.startMs - right.startMs || left.sequence - right.sequence,
    )) {
      const row = [...rows]
        .reverse()
        .find(
          (candidate) =>
            candidate.role === fragment.role && fragment.startMs - candidate.endMs <= gapMs,
        );
      if (row) {
        row.text += fragment.text;
        row.startMs = Math.min(row.startMs, fragment.startMs);
        row.endMs = Math.max(row.endMs, fragment.endMs);
      } else {
        rows.push({
          id: `caption-${fragment.sequence}`,
          role: fragment.role,
          text: fragment.text,
          startMs: fragment.startMs,
          endMs: fragment.endMs,
        });
      }
    }
    return rows.sort((left, right) => left.startMs - right.startMs);
  }

  clear(): void {
    this.#fragments.length = 0;
    this.#receivedIds.clear();
    this.#resolvedUserIds.clear();
    this.#sequence = 0;
    this.#processedCursor = 0;
  }

  #advanceCursor(): void {
    for (const fragment of this.#fragments) {
      if (fragment.sequence !== this.#processedCursor + 1) break;
      if (fragment.role === "user" && !this.#resolvedUserIds.has(fragment.eventId)) break;
      this.#processedCursor = fragment.sequence;
    }
  }
}

export function isLiveTranscriptEvent(event: LiveServerEvent): event is LiveTranscriptEvent {
  return (
    (event.type === "session.input_transcript.delta" ||
      event.type === "session.output_transcript.delta") &&
    typeof event.event_id === "string" &&
    typeof event.delta === "string" &&
    typeof event.start_ms === "number" &&
    typeof event.end_ms === "number"
  );
}

export function isClientDelegationEvent(event: LiveServerEvent): event is LiveDelegationEvent {
  return (
    event.type === "session.delegation.created" &&
    event.delegation?.type === "delegation" &&
    event.delegation.target === "client" &&
    typeof event.delegation.id === "string"
  );
}

export function safeLiveError(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === "NotAllowedError")
    return "Microphone access was not allowed.";
  if (cause instanceof DOMException && cause.name === "NotFoundError")
    return "No microphone was found.";
  if (cause instanceof TypeError)
    return "The voice service could not be reached. Check your connection and try again.";
  return "Could not start the Live session.";
}

export function safeLiveProviderError(event: LiveServerEvent): string {
  const code = event.error?.code ?? "";
  if (/rate_limit/i.test(code)) return "The voice service is busy. Please try again shortly.";
  if (/audio|microphone/i.test(code)) return "The voice service could not process microphone audio.";
  return "The Live session reported an error.";
}

const SAFE_PRECLAIM_FAILURE_CODES = new Set([
  "INVALID_VOICE_REQUEST",
  "INVALID_VOICE_FRAGMENT",
  "INVALID_VOICE_TEXT",
  "VOICE_USER_INPUT_REQUIRED",
  "VOICE_SESSION_NOT_FOUND",
  "USER_NOT_FOUND",
  "UNAUTHENTICATED",
  "AUTHENTICATION_REQUIRED",
  "AUTHORIZATION_REQUIRED",
]);

/** Errors known to occur before a delegate claim are safe for an explicit retry. */
export function isRetryablePreclaimFailure(cause: unknown): boolean {
  const record = cause && typeof cause === "object" ? cause as Record<string, unknown> : undefined;
  const data = record?.data;
  const dataCode = data && typeof data === "object"
    ? (data as Record<string, unknown>).code
    : undefined;
  const candidates = [
    typeof dataCode === "string" ? dataCode : "",
    typeof data === "string" ? data : "",
    typeof record?.message === "string" ? record.message : "",
  ];
  return candidates.some((value) =>
    [...SAFE_PRECLAIM_FAILURE_CODES].some((code) =>
      new RegExp(`(?:^|[^A-Z_])${code}(?:$|[^A-Z_])`).test(value.toUpperCase()),
    ),
  );
}
