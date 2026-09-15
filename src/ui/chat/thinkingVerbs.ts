import type { StringCopyKey } from "@/ui/copy/types"

/**
 * The rotation the Scout chat shows while a reply is on its way and no word of
 * it has arrived yet — Claude Code's status verbs, in German and in the
 * musician's world.
 *
 * The strings live in the dictionary (`liveScout.thinkingVerbs.*`); this is the
 * order they rotate in, kept next to the chat because the chat is what rotates
 * them. A host resolves it once per render:
 *
 * ```ts
 * thinkingVerbs: THINKING_VERB_KEYS.map((key) => t(key))
 * ```
 *
 * `ScoutChat` ships the same list as its default label, so a host that passes
 * no `thinkingVerbs` still rotates.
 */
export const THINKING_VERB_KEYS = [
  "liveScout.thinkingVerbs.sorting",
  "liveScout.thinkingVerbs.brief",
  "liveScout.thinkingVerbs.weighing",
  "liveScout.thinkingVerbs.writing",
  "liveScout.thinkingVerbs.listening",
  "liveScout.thinkingVerbs.checking",
] as const satisfies readonly StringCopyKey[]
