/**
 * Beat 4 — die Rückfrage (LANDING_SCREENS.md §8).
 *
 * „Nur echte Entscheidungen kommen zu euch." plus the one interactive moment on
 * the page: two answer chips. Picking one writes the branch (`wednesday` /
 * `thursday`) that also dims Beat 5's offer card (§9), and the „Donnerstag"
 * path offers the reset link that puts the demo back on the Mittwoch path.
 *
 * Scroll gates (§8: `p > 0.22 / 0.45 / 0.6`) become two latching reveals: the
 * card fades up, and further down the answer + reply appear on their own even
 * if the visitor never clicks — the source's auto-answer. The reply keeps the
 * source's 0.1 s delay behind the answer.
 */

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChatTurn } from "@/ui/chat/ChatTurn"
import { Overline } from "@/components/ui/overline"
import { ScoutBlob } from "@/components/ui/scout-blob"
import { useCopy } from "@/ui/copy"

import type { ClarifyChoice } from "./demoData"
import { useInView } from "./useLandingScroll"

interface ClarifyBeatProps {
  choice: ClarifyChoice
  onChoose: (choice: ClarifyChoice) => void
}

export function ClarifyBeat({ choice, onChoose }: ClarifyBeatProps) {
  const { t } = useCopy()
  const { ref: cardRef, inView: cardShown } = useInView<HTMLDivElement>({
    rootMargin: "0px 0px -25% 0px",
  })
  const { ref: threadRef, inView: threadShown } = useInView<HTMLDivElement>({
    rootMargin: "0px 0px -20% 0px",
  })

  const answered = choice !== null || threadShown
  const alternative = choice === "thursday"
  // The source's default story line is the Mittwoch path; the Donnerstag path
  // is only taken by an explicit click.
  const answerKey = alternative ? "landing.clarify.answer.thursday" : "landing.clarify.answer.wednesday"
  const replyKey = alternative ? "landing.clarify.reply.thursday" : "landing.clarify.reply.wednesday"
  const choicesOpen = choice === null && !threadShown

  return (
    <section className="relative z-2 flex min-h-screen flex-col items-center justify-center px-6 py-[100px] text-center">
      <ScoutBlob size={96} state="listening" className="mb-8" />

      <h3 className="text-[clamp(32px,4.6vw,58px)] leading-[1.05] font-light tracking-[-.025em] text-balance">
        {t("landing.clarify.headline")}
      </h3>

      <Card
        ref={cardRef}
        size="lg"
        tone="soft"
        className={cn(
          "mt-[34px] w-[min(680px,100%)] text-center",
          "transition-[opacity,transform] duration-[var(--duration-slower)] ease-out-soft",
          cardShown ? "translate-y-0 opacity-100" : "translate-y-[18px] opacity-0"
        )}
      >
        <Overline>{t("landing.clarify.card.kicker")}</Overline>
        <div className="mt-3 text-[clamp(21px,2.3vw,29px)] leading-[1.25] font-light text-balance">
          {t("landing.clarify.card.question")}
        </div>

        {choicesOpen ? (
          <div className="mt-[22px] flex flex-wrap justify-center gap-[10px]">
            <Button variant="tint" size="xs" onClick={() => onChoose("wednesday")}>
              {t("landing.clarify.choice.wednesday")}
            </Button>
            <Button variant="secondary" size="xs" onClick={() => onChoose("thursday")}>
              {t("landing.clarify.choice.thursday")}
            </Button>
          </div>
        ) : null}
      </Card>

      <div
        ref={threadRef}
        className="mt-4 flex min-h-[110px] w-[min(680px,100%)] flex-col gap-3 text-left"
      >
        <ChatTurn
          who="user"
          className={cn(
            "transition-[opacity,transform] duration-[var(--duration-slow)] ease-out-soft",
            answered ? "translate-y-0 opacity-100" : "translate-y-[10px] opacity-0"
          )}
        >
          {t(answerKey)}
        </ChatTurn>

        <ChatTurn
          who="scout"
          className={cn(
            "transition-opacity delay-[.1s] duration-[var(--duration-slow)]",
            answered ? "opacity-100" : "opacity-0"
          )}
        >
          {t(replyKey)}
        </ChatTurn>

        {alternative ? (
          <Button
            variant="link"
            size="sm"
            className="self-start"
            onClick={() => onChoose("wednesday")}
          >
            {t("landing.clarify.resume")}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
