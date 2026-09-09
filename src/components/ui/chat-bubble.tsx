import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * ChatBubble — one turn of the conversation between the user and the Scout.
 *
 * DS reference: `design-system/components/feedback/chat-bubble/`
 * (`ChatBubble.jsx`, `ChatBubble.d.ts`, `ChatBubble.prompt.md`,
 * `chat-bubble.card.html`). Prototype catalogue: `docs/UI_PORT/SCOUT_SCREENS.md`
 * §2.8 (clarification card), §2.9 (transcript sheet) and
 * `docs/UI_PORT/COMPONENT_MAP.md` §D „Stage (user only, 3 sizes)“.
 *
 * The asymmetry *is* the component (`ChatBubble.prompt.md`): the user speaks in
 * a rust bubble on the right, the Scout answers as bare text on the left — in
 * the main flow the Scout has **no** bubble at all. Only `compact` (the
 * „Mitschrift“ transcript) boxes both sides. Wrap a run of them in a
 * `flex flex-col gap-[var(--space-5)]` column; the atom only sets its own
 * `align-self` and `max-width`.
 *
 * Geometry verbatim from `ChatBubble.jsx`:
 *   root      `--font-sans` · `--rs-ink` · `text-align:left` ·
 *             `animation:rsFadeUp …` · user `align-self:flex-end;max-width:80%`
 *             · scout `align-self:flex-start;max-width:85%`
 *   label     12px in `--rs-ink-6`, `margin-bottom:4px` (`--space-1`),
 *             right-aligned for the user („Du“ / „Dein Scout“ —
 *             `SCOUT_SCREENS.md` §2.9 `m.who`)
 *   user      radius `18 18 4 18` (`--radius-bubble` ×3 + `--radius-bubble-tail`)
 *             · `--rs-rust` fill · 1px `--rs-border-accent-soft` hairline
 *             · `line-height:1.45` · default `14px 20px` (`--space-6` /
 *             `--space-9`) at 17px (`--text-body-lg-size`) · compact
 *             `10px 14px` (`--space-4` / `--space-6`) at 15px
 *             (`--text-body-sm-size`)
 *   scout     compact: radius `18 18 18 4`, `10px 14px`, 15px, `line-height:1.45`
 *             on the quiet white wash · default: no bubble, `6px 4px`
 *             (`--space-2` / `--space-1`) at 18px, `line-height:1.5`
 *             (`--text-body-leading`)
 *
 * Token notes (nothing here is a raw colour):
 *  · The Scout's compact fill is `rgba(255,255,255,.05)` in the JSX, which has
 *    no token; `--rs-surface-subtle-2` (.06) is the step the prototype itself
 *    uses for that bubble (`SCOUT_SCREENS.md` §2.9 `m.bg`, `TOKENS.md` §2046
 *    `--rs-bubble-scout`), so the two sources are reconciled on .06.
 *  · 12px (label) and 18px (Scout's default line) have no token — the caption
 *    ladder is 14 / 13.5 / 12.5 and the body ladder 19 / 17 / 16 — so both stay
 *    literal, as `capsule.tsx` keeps its 13px.
 *  · `line-height:1.45` likewise has no token (`--text-body-leading` is 1.5).
 *  · The DS enter is `rsFadeUp .35s ease both`; `animate-rs-fade-up` runs it at
 *    `--duration-base` (.3s), the nearest token, so every fading atom in the
 *    port shares one duration. `prefers-reduced-motion` collapses it globally
 *    in `src/styles/tokens.css`.
 *
 * The 18px radii come from the DS component, not from the prototype's
 * transcript, which boxes both sides at the tighter 14px set
 * (`TOKENS.md` §B6) — see the task note in the port log.
 */
const chatBubbleVariants = cva("font-sans text-rs-ink text-left animate-rs-fade-up", {
  variants: {
    who: {
      /** Right-aligned; the user never gets more than 80% of the column. */
      user: "self-end max-w-[80%]",
      /** Left-aligned; the Scout's bare text may run to 85%. */
      scout: "self-start max-w-[85%]",
    },
  },
  defaultVariants: {
    who: "user",
  },
})

const chatBubbleLabelVariants = cva(
  "mb-[var(--space-1)] text-[12px] text-rs-ink-6",
  {
    variants: {
      who: {
        user: "text-right",
        scout: "",
      },
    },
    defaultVariants: {
      who: "user",
    },
  }
)

const chatBubbleBodyVariants = cva("", {
  variants: {
    who: {
      /** Rust bubble with the tail on the bottom right. */
      user: [
        "rounded-[var(--radius-bubble)_var(--radius-bubble)_var(--radius-bubble-tail)_var(--radius-bubble)]",
        "border border-rs-border-accent-soft bg-rs-rust",
        "leading-[1.45]",
      ].join(" "),
      /** No bubble by default — the box only exists in the transcript. */
      scout: "",
    },
    compact: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    {
      who: "user",
      compact: false,
      class:
        "px-[var(--space-9)] py-[var(--space-6)] text-[length:var(--text-body-lg-size)]",
    },
    {
      who: "user",
      compact: true,
      class:
        "px-[var(--space-6)] py-[var(--space-4)] text-[length:var(--text-body-sm-size)]",
    },
    {
      who: "scout",
      compact: false,
      class:
        "px-[var(--space-1)] py-[var(--space-2)] text-[18px] leading-[var(--text-body-leading)]",
    },
    {
      who: "scout",
      compact: true,
      class: [
        "rounded-[var(--radius-bubble)_var(--radius-bubble)_var(--radius-bubble)_var(--radius-bubble-tail)]",
        "bg-rs-surface-subtle-2",
        "px-[var(--space-6)] py-[var(--space-4)]",
        "text-[length:var(--text-body-sm-size)] leading-[1.45]",
      ].join(" "),
    },
  ],
  defaultVariants: {
    who: "user",
    compact: false,
  },
})

interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  who?: "user" | "scout"
  /** Small label above ("Du", "Dein Scout"). */
  label?: string
  /** Transcript density. */
  compact?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
}

function ChatBubble({
  className,
  who = "user",
  label,
  compact = false,
  children,
  ...props
}: ChatBubbleProps) {
  return (
    <div
      data-slot="chat-bubble"
      data-who={who}
      data-compact={compact || undefined}
      className={cn(chatBubbleVariants({ who }), className)}
      {...props}
    >
      {label ? (
        <div
          data-slot="chat-bubble-label"
          className={chatBubbleLabelVariants({ who })}
        >
          {label}
        </div>
      ) : null}
      <div
        data-slot="chat-bubble-body"
        className={chatBubbleBodyVariants({ who, compact })}
      >
        {children}
      </div>
    </div>
  )
}

export { ChatBubble }
export type { ChatBubbleProps }
