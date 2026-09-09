import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * ChatBubble — one turn of the conversation between the user and the Scout.
 *
 * DS reference: `design-system/components/feedback/chat-bubble/`
 * (`ChatBubble.jsx`, `ChatBubble.d.ts`, `ChatBubble.prompt.md`,
 * `chat-bubble.card.html`). Prototype catalogue: `docs/UI_PORT/SCOUT_SCREENS.md`
 * §2.8 (clarification card), §2.9 (transcript sheet),
 * `docs/UI_PORT/COMPONENT_MAP.md` §E8 and `docs/UI_PORT/TOKENS.md` §B6.
 *
 * The asymmetry *is* the component (`ChatBubble.prompt.md`): the user speaks in
 * a rust bubble on the right, the Scout answers as bare text on the left — in
 * the main flow the Scout has **no** bubble at all. Only `compact` (the
 * „Mitschrift“ transcript) boxes both sides.
 *
 * **Container gaps — two, not one.** The atom only sets its own `align-self`
 * and `max-width`; the run around it owns the rhythm, and the two bubble
 * systems do not share it: the stage column is `gap:12px`
 * (`--space-5`, `ui_kits/roomscout-app/ScreensB.jsx:92`, and the toy snippet in
 * `ChatBubble.prompt.md`), the „Mitschrift“ body is `gap:14px`
 * (`--space-6`, `SCOUT_SCREENS.md` §2.9 `padding:4px 24px 24px;…;gap:14px`,
 * `App.jsx:104`). Wrap a stage run in `flex flex-col gap-[var(--space-5)]` and
 * a transcript run in `flex flex-col gap-[var(--space-6)]`.
 *
 * Geometry verbatim from `ChatBubble.jsx` + `COMPONENT_MAP.md` §E8:
 *   root      `--font-sans` · `--rs-ink` · `text-align:left` ·
 *             `animation:rsFadeUp .35s ease both` · user `align-self:flex-end`
 *             · scout `align-self:flex-start` · max-width `80%` (user) /
 *             `85%` (scout), and **`88%` for both when `compact`** — the
 *             transcript geometry is one shared box (`TOKENS.md` §B6,
 *             `SCOUT_SCREENS.md` §2.9), which is why the DS's own kit has to
 *             patch `style={{maxWidth:'88%'}}` onto every call site
 *             (`App.jsx:106`). Here `compact` carries it.
 *   label     12px in `--rs-ink-6`, `margin-bottom:4px` (`--space-1`),
 *             right-aligned for the user („Du“ / „Dein Scout“ —
 *             `SCOUT_SCREENS.md` §2.9 `m.who`)
 *   user      radius `18 18 4 18` (`--radius-bubble` ×3 + `--radius-bubble-tail`)
 *             · `--rs-rust` fill · 1px `--rs-border-accent-soft` hairline
 *             · `line-height:1.45`
 *   scout     `compact`: radius `18 18 18 4` on the quiet white wash ·
 *             otherwise no bubble at all
 *
 * **`size` — the three stage steps (`COMPONENT_MAP.md` §E8, `TOKENS.md` §B6).**
 * Padding and type step are per speaker, so the ladder is a `who × size` table:
 *
 * | `size` | user (bubble) | scout (bare) | call site |
 * |---|---|---|---|
 * | `lg` | `14px 20px` @ 17px | `6px 4px` @ 18px/1.5 | R clarification (default) |
 * | `md` | `12px 18px` @ 16px | `4px 4px` @ 16px/1.5 | R offer-review Q&A |
 * | `sm` | `10px 14px` @ 15px | `10px 14px` @ 15px/1.45 | „Mitschrift“ transcript |
 *
 * `compact` implies `sm`, so the transcript keeps its one-prop call; pass
 * `size` explicitly to override either way. The DS kit reaches for the 16px
 * step with `style={{fontSize:16}}` (`ScreensB.jsx:154`) — a no-op in the DS
 * itself, because the body always declares its own `font-size` and an
 * inherited value never beats a declaration. `size="md"` is that step.
 * The one remaining stage pair, the Landing v2 answer (user `13px 18px` @ 16px
 * with **no** `max-width`, scout `4px` @ 17px — `TOKENS.md` §B6), is a one-off:
 * build it with `size="md"` plus `className="max-w-none"` and
 * `bodyClassName="px-[var(--space-8)] py-[13px]"`.
 *
 * **Escape hatches.** `className`/`style`/`...props` land on the root, and the
 * two inner slots take `labelClassName` / `bodyClassName`, both merged through
 * `cn()` so a call site can beat a variant declaration (a body-level `style`
 * or `className` on the root cannot — that was the trap `ScreensB.jsx:154`
 * fell into). `as` swaps the root element so a transcript can be a real
 * `<ul>`/`<li>` or a `role="log"` item instead of div soup.
 *
 * **Accessibility.** Speaker identity is otherwise encoded only in
 * `align-self` and fill colour, which is invisible to assistive tech. The root
 * is therefore a `role="group"` named by its label, and when no visible
 * `label` is passed the German default („Du“ / „Dein Scout“, `SCOUT_SCREENS.md`
 * §2.9 `m.who`) is rendered `sr-only` so the name still exists. Both are
 * overridable through `...props` (`role`, `aria-label`, `aria-labelledby`).
 *
 * Token notes (nothing here is a raw colour):
 *  · The Scout's compact fill is `rgba(255,255,255,.05)` in `ChatBubble.jsx`,
 *    which has no token. **The exception of record is `.06`**:
 *    `--rs-surface-subtle-2` is the step the prototype itself uses for that
 *    bubble (`SCOUT_SCREENS.md` §2.9 `m.bg`, `TOKENS.md` §2046
 *    `--rs-bubble-scout`), so the DS JSX is the outlier, not this file.
 *  · Sanctioned raw type literals, alongside `capsule.tsx`'s 13px: **12px**
 *    (speaker label) and **18px** (the Scout's `lg` line). `tokens.css` has no
 *    matching step — the caption ladder is 14 / 13.5 / 12.5 and the body ladder
 *    19 / 17 / 16 — and `--space-8` (18px) is spacing, not type. The port's own
 *    proposal names the first (`docs/UI_PORT/tokens.proposed.css:327`
 *    `--rs-text-micro: 12px`); promoting it plus an 18px body step retires both.
 *  · **`line-height:1.45`** is likewise sanctioned and literal (`--text-body-leading`
 *    is 1.5). It is the shared bubble leading across both speakers and both
 *    bubble systems, so it is a token candidate (`--text-body-leading-tight`),
 *    not a per-component value.
 *  · The enter animation is the DS's own `rsFadeUp .35s ease both`. `.35s` is
 *    off the `--duration-*` ladder (`.3s` / `.5s`), so it is declared as a
 *    named local custom property, the pattern `accordion.tsx` uses for the
 *    DS's `.26s` / `.32s` panels. `prefers-reduced-motion` still collapses it —
 *    `tokens.css` does that globally, on `*`.
 *
 * The 18px radii come from the DS component, not from the prototype's
 * transcript, which boxes both sides at the tighter 14px set
 * (`TOKENS.md` §B6) — see the task note in the port log.
 */

/** One default, one place — the cva tables and the call signature share it. */
const DEFAULT_WHO = "user" as const

/** `SCOUT_SCREENS.md` §2.9 `m.who` — the transcript's own speaker names. */
const SPEAKER_LABEL = { user: "Du", scout: "Dein Scout" } as const

const chatBubbleVariants = cva(
  [
    "font-sans text-rs-ink text-left",
    // DS: `animation: rsFadeUp .35s ease both`.
    "[--rs-bubble-enter:.35s] animate-[rsFadeUp_var(--rs-bubble-enter)_ease_both]",
  ].join(" "),
  {
    variants: {
      who: {
        /** Right-aligned; the user's bubble hugs the end of the column. */
        user: "self-end",
        /** Left-aligned; the Scout's bare text starts the column. */
        scout: "self-start",
      },
      /**
       * Transcript density. Empty on its own: every value it changes is also
       * `who`-dependent, so the whole table lives in `compoundVariants` —
       * the two bubble systems of `TOKENS.md` §B6 side by side.
       */
      compact: { true: "", false: "" },
    },
    compoundVariants: [
      /** Stage: the user never gets more than 80% of the column … */
      { who: "user", compact: false, class: "max-w-[80%]" },
      /** … while the Scout's bare text may run to 85%. */
      { who: "scout", compact: false, class: "max-w-[85%]" },
      /** Transcript: one shared box, 88% for both speakers. */
      { compact: true, class: "max-w-[88%]" },
    ],
    defaultVariants: {
      who: DEFAULT_WHO,
      compact: false,
    },
  }
)

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
      who: DEFAULT_WHO,
    },
  }
)

const chatBubbleBodyVariants = cva(
  // The prototype's script is fixed German prose; this port renders
  // backend-fed content, where one unbroken token — a URL, an address, a long
  // German compound — would otherwise shoot past `max-width` and stretch the
  // flex column, and newlines in a stored transcript entry would collapse.
  "break-words whitespace-pre-wrap",
  {
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
      /** Type step; padding and size are per speaker, hence the compounds. */
      size: { lg: "", md: "", sm: "" },
      /** Boxes the Scout's reply; the user is already in a bubble. */
      compact: { true: "", false: "" },
    },
    compoundVariants: [
      /* — user, the three stage steps — */
      {
        who: "user",
        size: "lg",
        class:
          "px-[var(--space-9)] py-[var(--space-6)] text-[length:var(--text-body-lg-size)]",
      },
      {
        who: "user",
        size: "md",
        class:
          "px-[var(--space-8)] py-[var(--space-5)] text-[length:var(--text-body-size)]",
      },
      {
        who: "user",
        size: "sm",
        class:
          "px-[var(--space-6)] py-[var(--space-4)] text-[length:var(--text-body-sm-size)]",
      },
      /* — scout, the three stage steps — */
      {
        who: "scout",
        size: "lg",
        class:
          "px-[var(--space-1)] py-[var(--space-2)] text-[18px] leading-[var(--text-body-leading)]",
      },
      {
        who: "scout",
        size: "md",
        class:
          "p-[var(--space-1)] text-[length:var(--text-body-size)] leading-[var(--text-body-leading)]",
      },
      {
        who: "scout",
        size: "sm",
        class:
          "px-[var(--space-6)] py-[var(--space-4)] text-[length:var(--text-body-sm-size)] leading-[1.45]",
      },
      /* — the transcript box, Scout side only — */
      {
        who: "scout",
        compact: true,
        class: [
          "rounded-[var(--radius-bubble)_var(--radius-bubble)_var(--radius-bubble)_var(--radius-bubble-tail)]",
          "bg-rs-surface-subtle-2",
        ].join(" "),
      },
    ],
    defaultVariants: {
      who: DEFAULT_WHO,
      size: "lg",
      compact: false,
    },
  }
)

type ChatBubbleSize = NonNullable<
  VariantProps<typeof chatBubbleBodyVariants>["size"]
>

interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Speaker. Derived from {@link chatBubbleVariants} so prop and cva cannot drift. */
  who?: NonNullable<VariantProps<typeof chatBubbleVariants>["who"]>
  /**
   * Small label above („Du“, „Dein Scout“). Omitted, the speaker name is still
   * rendered for assistive tech only — it is never silently dropped.
   */
  label?: string
  /** Transcript density: boxes both speakers at 88% and implies `size="sm"`. */
  compact?: boolean
  /** Type step; defaults to `sm` under `compact`, otherwise `lg`. */
  size?: ChatBubbleSize
  /** Root element — `"li"` for a real transcript list, `"article"` for a log entry. */
  as?: "div" | "li" | "article" | "section"
  /** Merged onto the speaker label (`cn`, so it beats the variant classes). */
  labelClassName?: string
  /** Merged onto the message body — the only way to reach a body-level property. */
  bodyClassName?: string
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop: the transcript scrolls its latest turn into view. */
  ref?: React.Ref<HTMLDivElement>
}

function ChatBubble({
  className,
  who = DEFAULT_WHO,
  label,
  compact = false,
  size,
  as = "div",
  labelClassName,
  bodyClassName,
  children,
  ref,
  ...props
}: ChatBubbleProps) {
  // Typed as the default tag on purpose: all four take the same HTML
  // attributes, and a `React.ElementType` in JSX position would demand the
  // *intersection* of every tag's props — including a ref that is an
  // `HTMLDivElement` and an `HTMLLIElement` at once. Only the ref's element
  // type differs; cast it at the call site if you hold an `HTMLLIElement`.
  const Comp = as as "div"
  const labelId = React.useId()
  // `compact` is the transcript, and the transcript is the 15px step; an
  // explicit `size` always wins.
  const resolvedSize = size ?? (compact ? "sm" : "lg")

  return (
    <Comp
      data-slot="chat-bubble"
      data-who={who}
      data-size={resolvedSize}
      data-compact={compact || undefined}
      // Position and fill are the only speaker cues in the design; give the
      // turn a name so it survives into the accessibility tree. Both attributes
      // sit before the spread, so a call site can replace them (`role="listitem"`).
      role="group"
      aria-labelledby={labelId}
      className={cn(chatBubbleVariants({ who, compact }), className)}
      ref={ref}
      {...props}
    >
      <div
        id={labelId}
        data-slot="chat-bubble-label"
        className={cn(
          chatBubbleLabelVariants({ who }),
          // No visible label (absent or empty): keep the name, drop the ink.
          !label && "sr-only",
          labelClassName
        )}
      >
        {label || SPEAKER_LABEL[who]}
      </div>
      <div
        data-slot="chat-bubble-body"
        className={cn(
          chatBubbleBodyVariants({ who, size: resolvedSize, compact }),
          bodyClassName
        )}
      >
        {children}
      </div>
    </Comp>
  )
}

// The variant functions are part of the public API (a call site may need the
// bubble geometry on a node this component does not render — the Landing v2
// answer, which carries no `max-width`), exactly as `badgeVariants` and
// friends are. The cva() calls are not plain constants, so the react-refresh
// rule cannot see them as such.
// eslint-disable-next-line react-refresh/only-export-components
export { ChatBubble, chatBubbleVariants, chatBubbleLabelVariants, chatBubbleBodyVariants }
export type { ChatBubbleProps, ChatBubbleSize }
