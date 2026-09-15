import * as React from "react"
import type { VariantProps } from "class-variance-authority"
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * TEMPORARY STAND-IN — to be overwritten by the shadcn CLI, not maintained here.
 *
 * RoomScout Questionnaire — the styled layer over the headless
 * `@shadcn/react/questionnaire` primitive (shadcn, August 2026). The primitive
 * import and every part name are the upstream ones; only this styling file is
 * not the CLI's output yet.
 *
 * `npx shadcn@latest add questionnaire` could not write this file: the registry
 * (`https://ui.shadcn.com/r/styles/new-york-v4/questionnaire.json`) answers 404
 * for `questionnaire` while it serves `message-scroller`, so the styled layer is
 * composed here by hand — the same port the DS asked for, tokenised on the way
 * in. Re-run the CLI once the registry carries the item and diff against this
 * file; the primitive import and the part names are already the upstream ones.
 *
 * What the port changes against upstream shadcn defaults:
 *  · no neutral greys and no `ring-*` — every colour is a `rs-*` token, the
 *    focus treatment is the DS ring (2px solid `--rs-orange`, 2px offset,
 *    TOKENS.md §F17) that `button.tsx` and `card.tsx` already use;
 *  · the choice is the DS answer chip: `secondary` at rest, `tint` when picked
 *    (the two `Button` variants, spelled out here because a `<label>` must own
 *    the `:has()` focus state of the radio it wraps);
 *  · sizes come from `--text-*-size` / `--space-*` / `--radius-*`, never from
 *    Tailwind's rem ladder.
 *
 * Anatomy, as the primitive defines it:
 *
 * ```tsx
 * <Questionnaire onSubmit={…} shortcuts="letters">
 *   <QuestionnaireItem name={id} required>
 *     <QuestionnaireTitle>Die Frage</QuestionnaireTitle>
 *     <QuestionnaireDescription>Kontext</QuestionnaireDescription>
 *     <QuestionnaireChoices>
 *       <QuestionnaireChoice value="yes">Ja</QuestionnaireChoice>
 *     </QuestionnaireChoices>
 *     <QuestionnaireInput value={text} onChange={…} />
 *     <QuestionnaireError>…</QuestionnaireError>
 *     <QuestionnaireActions><QuestionnaireSubmit>Antworten</QuestionnaireSubmit></QuestionnaireActions>
 *   </QuestionnaireItem>
 * </Questionnaire>
 * ```
 *
 * Two behaviours of the primitive that the call site must know about, because
 * they are load-bearing in `DecisionCard`:
 *  · **one answer per item.** Choices and the free-text field share the item's
 *    selection, so typing clears the picked chip and picking a chip is the
 *    moment to clear the text (the field is controlled for exactly that);
 *  · **the text field only carries a `name` while it is filled**, so an empty
 *    free-text answer never reaches the form data.
 *
 * `QuestionnaireActions` is the one part with no headless counterpart — it is a
 * plain row, added here so the submit button is not the only thing that decides
 * the footer's spacing.
 */

/** The form. One `QuestionnaireItem` per question; `shortcuts="letters"` arms A/B/C. */
function Questionnaire({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Root>) {
  return (
    <QuestionnairePrimitive.Root
      data-slot="questionnaire"
      className={cn("flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  )
}

/**
 * One question. Renders a `<fieldset>`, which browsers give a default border,
 * margin and padding — all three are reset here, as upstream shadcn does.
 */
function QuestionnaireItem({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Item>) {
  return (
    <QuestionnairePrimitive.Item
      data-slot="questionnaire-item"
      className={cn(
        "m-0 flex min-w-0 flex-col gap-[var(--space-6)] border-0 p-0",
        className,
      )}
      {...props}
    />
  )
}

/** The question itself — a `<legend>`, so it names the fieldset. */
function QuestionnaireTitle({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Title>) {
  return (
    <QuestionnairePrimitive.Title
      data-slot="questionnaire-title"
      className={cn(
        "float-none m-0 w-full p-0 text-[length:var(--text-body-lg-size)] leading-[1.35] font-light tracking-[-.01em] text-rs-ink [text-wrap:balance]",
        className,
      )}
      {...props}
    />
  )
}

/** Context under the question; registered as the item's `aria-describedby`. */
function QuestionnaireDescription({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Description>) {
  return (
    <QuestionnairePrimitive.Description
      data-slot="questionnaire-description"
      className={cn(
        "m-0 text-[length:var(--text-caption-size)] leading-[1.45] text-rs-ink-6",
        className,
      )}
      {...props}
    />
  )
}

/** The row of answer chips. */
function QuestionnaireChoices({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Choices>) {
  return (
    <QuestionnairePrimitive.Choices
      data-slot="questionnaire-choices"
      className={cn("flex flex-wrap gap-[var(--space-4)]", className)}
      {...props}
    />
  )
}

/**
 * One answer chip: the DS pill, `secondary` at rest and `tint` once picked.
 * The radio itself is visually hidden but focusable, so the label carries the
 * focus ring through `:has()`.
 */
function QuestionnaireChoice({
  children,
  className,
  shortcut = true,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Choice> & {
  /** Show the A/B/C hint when the root armed shortcuts. Default `true`. */
  shortcut?: boolean
}) {
  return (
    <QuestionnairePrimitive.Choice
      data-slot="questionnaire-choice"
      className={cn(
        "inline-flex cursor-pointer items-center gap-[var(--space-4)]",
        "h-[var(--size-button-sm)] rounded-pill px-[var(--space-10)]",
        "text-[length:var(--text-body-sm-size)] font-medium whitespace-nowrap",
        "border border-rs-border-control-strong bg-rs-surface-subtle-2 text-rs-ink",
        "transition-[background-color,color] duration-[var(--duration-quick)] ease-[ease]",
        "hover:bg-rs-surface-hover",
        "data-checked:border-rs-border-accent data-checked:bg-rs-surface-accent-tint data-checked:text-rs-orange-tint-2",
        "data-disabled:cursor-default data-disabled:opacity-50",
        "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rs-orange",
        className,
      )}
      {...props}
    >
      <QuestionnaireChoiceInput className="sr-only" />
      <QuestionnaireChoiceLabel>{children}</QuestionnaireChoiceLabel>
      {shortcut ? <QuestionnaireChoiceShortcut /> : null}
    </QuestionnairePrimitive.Choice>
  )
}

/** The radio/checkbox behind a choice. `QuestionnaireChoice` renders one already. */
function QuestionnaireChoiceInput({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.ChoiceInput>) {
  return (
    <QuestionnairePrimitive.ChoiceInput
      data-slot="questionnaire-choice-input"
      className={className}
      {...props}
    />
  )
}

/** The chip's visible text. */
function QuestionnaireChoiceLabel({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.ChoiceLabel>) {
  return (
    <QuestionnairePrimitive.ChoiceLabel
      data-slot="questionnaire-choice-label"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

/** The A/B/C hint; the primitive hides it when the root armed no shortcuts. */
function QuestionnaireChoiceShortcut({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.ChoiceShortcut>) {
  return (
    <QuestionnairePrimitive.ChoiceShortcut
      data-slot="questionnaire-choice-shortcut"
      className={cn(
        "inline-flex size-[var(--space-9)] shrink-0 items-center justify-center rounded-chip",
        "bg-rs-surface-subtle-2 text-[length:var(--text-caption-sm-size)] text-rs-ink-6",
        className,
      )}
      {...props}
    />
  )
}

/** The free-text answer. Carries a `name` only while it is filled. */
function QuestionnaireInput({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Input>) {
  return (
    <QuestionnairePrimitive.Input
      data-slot="questionnaire-input"
      className={cn(
        "flex h-[var(--size-button-sm)] w-full min-w-0 rounded-control-lg px-[var(--space-7)]",
        "border border-rs-border-panel bg-rs-surface-inset",
        "font-sans! text-[length:var(--text-body-sm-size)]! text-rs-ink placeholder:text-rs-ink-7",
        "outline-none focus-visible:outline-solid! focus-visible:outline-2!",
        "focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
        "data-invalid:border-rs-red-text/60",
        "disabled:cursor-not-allowed disabled:text-rs-ink-6",
        className,
      )}
      {...props}
    />
  )
}

/** The item's validation line; hidden until the item is invalid. */
function QuestionnaireError({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Error>) {
  return (
    <QuestionnairePrimitive.Error
      data-slot="questionnaire-error"
      className={cn(
        "m-0 text-[length:var(--text-caption-size)] text-rs-red-text",
        className,
      )}
      {...props}
    />
  )
}

/** The footer row of an item. No headless counterpart — layout only. */
function QuestionnaireActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="questionnaire-actions"
      className={cn(
        "mt-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-4)]",
        className,
      )}
      {...props}
    />
  )
}

type QuestionnaireButtonProps = {
  /** DS button variant; `tint` is the answer-chip look the DS asks for here. */
  variant?: VariantProps<typeof buttonVariants>["variant"]
  size?: VariantProps<typeof buttonVariants>["size"]
}

/** Submits the questionnaire. Visible on the last item, which is the only one here. */
function QuestionnaireSubmit({
  className,
  variant = "tint",
  size = "sm",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Submit> & QuestionnaireButtonProps) {
  return (
    <QuestionnairePrimitive.Submit
      data-slot="questionnaire-submit"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/** Skips the current item. Visible only while the item is optional. */
function QuestionnaireSkip({
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Skip> & QuestionnaireButtonProps) {
  return (
    <QuestionnairePrimitive.Skip
      data-slot="questionnaire-skip"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/** Steps to the previous item — only meaningful with more than one item. */
function QuestionnairePrevious({
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Previous> & QuestionnaireButtonProps) {
  return (
    <QuestionnairePrimitive.Previous
      data-slot="questionnaire-previous"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/** Steps to the next item — only meaningful with more than one item. */
function QuestionnaireNext({
  className,
  variant = "tint",
  size = "sm",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Next> & QuestionnaireButtonProps) {
  return (
    <QuestionnairePrimitive.Next
      data-slot="questionnaire-next"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/** Progress across items — „Question 2 of 5“ unless children override it. */
function QuestionnaireProgress({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Progress>) {
  return (
    <QuestionnairePrimitive.Progress
      data-slot="questionnaire-progress"
      className={cn(
        "text-[length:var(--text-caption-sm-size)] text-rs-ink-6",
        className,
      )}
      {...props}
    />
  )
}

export {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceInput,
  QuestionnaireChoiceLabel,
  QuestionnaireChoiceShortcut,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
}
