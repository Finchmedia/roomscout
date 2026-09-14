/**
 * ChatTurn — one turn of a conversation, in the one bubble system.
 *
 * The app used to carry two: the DS-derived `ChatBubble` (asymmetric: rust
 * bubble right, bare text left) and the shadcn primitives `Message` /
 * `Bubble` that the live Scout chat (`ScoutChat.tsx`) and the Nachrichten
 * inbox (`ConversationThread.tsx`) render. `ChatTurn` is the second system,
 * given the ergonomics of the first, and `ChatBubble` is gone.
 *
 * It composes nothing of its own: `Message` owns the row and its direction,
 * `MessageContent` the column, `MessageHeader` the speaker label, and
 * `Bubble` / `BubbleContent` the box — user turns end-aligned in the rust
 * fill, Scout and Anbieter start-aligned on the quiet wash. Geometry
 * therefore lives in `src/components/ui/bubble.tsx` alone: 15px on 1.45,
 * `--space-6` / `--space-4` padding, the 18px radii with the 4px tail on the
 * speaker's side, `max-width: 88%`.
 *
 * Deliberate departures from the retired `ChatBubble` (where the two systems
 * disagreed, `Bubble` wins — that is the point of collapsing them):
 *  · the Scout now sits in a bubble everywhere, not only in the „Mitschrift“;
 *  · one width (88%) instead of 80% user / 85% Scout / 88% compact;
 *  · one type step (15px) instead of the `lg`/`md`/`sm` ladder — no `size`;
 *  · the label is `--text-micro-size` (12.5px), not a raw 12px;
 *  · no `rsFadeUp` enter animation (the primitives carry none); call sites
 *    that animate a turn pass their own transition through `className`, as
 *    `ClarifyBeat` does.
 *
 * `compact` survives as the transcript flag. Both densities are the same 88%
 * box now, so it only marks the turn (`data-compact`) for call sites and
 * tests; the run around it still owns the rhythm — a stage column is
 * `gap:var(--space-5)`, the „Mitschrift“ body `gap:var(--space-6)`.
 *
 * Accessibility: position and fill are the only speaker cues in the design.
 * A turn with a visible `label` is therefore a `role="group"` named by it;
 * an unlabelled turn stays unnamed unless the call site passes its own
 * `aria-label` (German copy belongs to the caller's `useCopy`, never here).
 */

import * as React from "react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import { cn } from "@/lib/utils"

type ChatTurnWho = "user" | "scout" | "provider"

interface ChatTurnProps extends React.ComponentProps<"div"> {
  /** Speaker. Only `user` is end-aligned; Scout and Anbieter start the row. */
  who?: ChatTurnWho
  /** Visible speaker label above the bubble; also names the turn for AT. */
  label?: string
  /** Transcript density marker („Mitschrift“). */
  compact?: boolean
  /** Merged onto the bubble body — the only way to reach a body-level property. */
  bodyClassName?: string
  children?: React.ReactNode
}

function ChatTurn({
  who = "scout",
  label,
  compact = false,
  className,
  bodyClassName,
  children,
  ...props
}: ChatTurnProps) {
  const align = who === "user" ? "end" : "start"

  return (
    <Message
      data-slot="chat-turn"
      data-who={who}
      data-compact={compact || undefined}
      align={align}
      // Both sit before the spread, so a call site can replace or extend them.
      {...(label ? { role: "group", "aria-label": label } : null)}
      className={cn("w-full", className)}
      {...props}
    >
      <MessageContent>
        {label ? <MessageHeader>{label}</MessageHeader> : null}
        <Bubble align={align}>
          <BubbleContent className={bodyClassName}>{children}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

export { ChatTurn }
export type { ChatTurnProps, ChatTurnWho }
