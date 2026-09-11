/**
 * Beat 1 + 2 — „Gespräch → Suchauftrag" (LANDING_SCREENS.md §6).
 *
 * Three columns: the listening Scout, the scripted conversation, and the live
 * „Euer Suchauftrag" panel that fills up as the lines land. Below 880 px the
 * panel is hidden (§6.4) and the grid collapses to one column.
 *
 * The source drives all of this from a sticky 320 vh section and a fractional
 * scroll progress; this port reveals one line per `IntersectionObserver` step
 * (`useRevealSequence`) and keeps the two semantics §6.4 calls load-bearing:
 *  · the fact accumulator is rebuilt from scratch on every render, walking the
 *    revealed lines in order — so `changed` stays *derived* („an entry already
 *    existed under this id"), never stored;
 *  · a later line under a known id replaces the value in place instead of
 *    appending a second row (budget: 400 € → 350 €).
 * `FactList` owns no timer for the correction wash, so this component clears
 * it after `--duration-morph`-ish 1.2 s, the timing `fact-list.tsx` documents.
 *
 * Simplified: the capsule does not fly from the line into the list (§6.3's
 * `translate(40px,-10px) scale(.9)`), and the panel does not morph into the
 * summary card (§6.5). The chips fade in with their line, the card fades up as
 * its own block underneath.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Capsule } from "@/components/ui/capsule"
import { FactList, type Fact, type FactId } from "@/components/ui/fact-list"
import { ScoutBlob } from "@/components/ui/scout-blob"
import { StatusDot } from "@/components/ui/status-dot"
import { useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"

import { BRIEF_ROWS, CONVERSATION_LINES, FACT_ORDER, SECTION_IDS } from "./demoData"
import { useInView, useRevealSequence } from "./useLandingScroll"

/** How long the orange correction wash stays on a replaced row. */
const CHANGED_FLASH_MS = 1200

interface LiveFact {
  id: FactId
  labelKey: StringCopyKey
  changed: boolean
}

/** §6.4's accumulator: replay the revealed lines, last write per id wins. */
function accumulateFacts(revealed: number): LiveFact[] {
  const state = new Map<FactId, LiveFact>()

  for (let index = 0; index < revealed; index += 1) {
    const line = CONVERSATION_LINES[index]
    if (!line) continue
    for (const chip of line.chips) {
      state.set(chip.id, {
        id: chip.id,
        labelKey: chip.labelKey,
        changed: state.has(chip.id),
      })
    }
  }

  return FACT_ORDER.map((id) => state.get(id)).filter(
    (fact): fact is LiveFact => fact !== undefined
  )
}

export function ConversationBeat() {
  const { t } = useCopy()
  const { revealed, itemProps } = useRevealSequence(CONVERSATION_LINES.length)

  const liveFacts = React.useMemo(() => accumulateFacts(revealed), [revealed])
  const correctedIds = liveFacts
    .filter((fact) => fact.changed)
    .map((fact) => fact.id)
    .join(",")

  // The wash is derived: it burns for `CHANGED_FLASH_MS` after a correction
  // lands, and the timeout — not the effect body — records that it is spent.
  const [spentIds, setSpentIds] = React.useState("")
  React.useEffect(() => {
    if (correctedIds === "") return
    const timer = window.setTimeout(() => setSpentIds(correctedIds), CHANGED_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [correctedIds])
  const flash = correctedIds !== "" && spentIds !== correctedIds

  const facts: Fact[] = liveFacts.map((fact) => ({
    id: fact.id,
    label: t(fact.labelKey),
    changed: fact.changed && flash,
  }))

  return (
    <>
      <section className="relative z-2 mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-[clamp(24px,4vw,60px)] px-[clamp(20px,5vw,80px)] pt-[70px] min-[880px]:grid-cols-[minmax(140px,.7fr)_minmax(0,1.6fr)_minmax(220px,.9fr)]">
        <div className="flex flex-col items-start gap-[22px] min-[880px]:items-center">
          <ScoutBlob size={140} state="listening" />
          <StatusDot pulse className="text-[14px] text-rs-ink-6">
            {t("landing.convo.status.listening")}
          </StatusDot>
        </div>

        <div className="flex min-w-0 flex-col gap-[22px]">
          {CONVERSATION_LINES.map((line, index) => {
            const shown = index < revealed
            return (
              <div
                key={line.id}
                {...itemProps(index)}
                className={cn(
                  "transition-[opacity,transform] duration-[var(--duration-slow)] ease-out-soft",
                  shown ? "translate-y-0 opacity-100" : "translate-y-[18px] opacity-0"
                )}
              >
                <div className="mb-1 text-[12.5px] text-rs-ink-6">
                  {t("landing.convo.speaker.user")}
                </div>
                <div className="text-[clamp(17px,2.2vw,30px)] leading-[1.2] font-light tracking-[-.015em] text-balance">
                  {t(line.textKey)}
                </div>
                <div className="mt-2 flex min-h-[34px] flex-wrap items-center gap-2">
                  {shown
                    ? line.chips.map((chip) => (
                        <Capsule key={`${line.id}-${chip.id}`} size="sm">
                          {t(chip.labelKey)}
                        </Capsule>
                      ))
                    : null}
                </div>
              </div>
            )
          })}
        </div>

        <div className="hidden min-[880px]:block">
          <FactList facts={facts} title={t("landing.brief.panel.title")} />
          <p className="mt-[14px] max-w-[300px] text-[14px] leading-[1.5] text-rs-ink-6">
            {t("landing.brief.panel.caption")}
          </p>
        </div>
      </section>

      <BriefCard />
    </>
  )
}

/** §6.5 — the „So suche ich für euch." summary card. */
function BriefCard() {
  const { t } = useCopy()
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "0px 0px -25% 0px" })

  const facts: Fact[] = BRIEF_ROWS.map((row) => ({ id: row.id, label: t(row.labelKey) }))

  return (
    <section className="relative z-2 flex flex-col items-center px-6 pt-[120px] text-center">
      <div
        ref={ref}
        className={cn(
          "flex w-[min(520px,100%)] flex-col items-center transition-[opacity,transform] duration-[var(--duration-slower)] ease-out-soft",
          inView ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[.96] opacity-0"
        )}
      >
        <div className="mb-[22px] text-[clamp(26px,3.6vw,46px)] leading-[1.1] font-light tracking-[-.02em] text-balance">
          {t("landing.brief.card.title")}
        </div>

        <FactList
          variant="card"
          className="w-full"
          title={t("landing.brief.card.heading")}
          facts={facts}
        >
          <Button asChild block size="md" className="mt-[18px] text-rs-white! hover:text-rs-white!">
            <a href={`#${SECTION_IDS.work}`}>{t("landing.brief.card.cta")}</a>
          </Button>
          <div className="mt-3 text-center text-[14px] leading-[1.5] text-rs-ink-4">
            {t("landing.brief.card.note.line1")}
            <br />
            {t("landing.brief.card.note.line2")}
          </div>
        </FactList>
      </div>
    </section>
  )
}
