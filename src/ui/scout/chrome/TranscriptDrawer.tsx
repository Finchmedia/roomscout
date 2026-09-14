/**
 * „Mitschrift“ — the transcript drawer (App.jsx, SCOUT_SCREENS §2.9).
 *
 * The DS `Sheet` on its `right` edge is exactly this drawer: 420px, warm left
 * hairline, drawer surface, the 40px subtle close in the header row. Turns are
 * `ChatTurn compact`, both speakers boxed at 88 %.
 */

import { ChatTurn } from "@/ui/chat/ChatTurn";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCopy } from "@/ui/copy";
import type { TranscriptTurn } from "../state/useScoutDemoMachine";

interface TranscriptDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: readonly TranscriptTurn[];
}

export function TranscriptDrawer({ open, onOpenChange, transcript }: TranscriptDrawerProps) {
  const { t } = useCopy();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("scout.transcript.close.aria")}
        aria-describedby={undefined}
      >
        <SheetHeader>
          <SheetTitle>{t("scout.transcript.title")}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {transcript.length === 0 ? (
            <div className="text-[length:var(--text-caption-size)] text-rs-ink-6">
              {t("scout.transcript.empty")}
            </div>
          ) : null}
          {transcript.map((turn) => (
            <ChatTurn
              key={turn.id}
              who={turn.who}
              compact
              label={
                turn.who === "scout"
                  ? t("scout.transcript.who.scout")
                  : t("scout.transcript.who.user")
              }
            >
              {turn.text ?? (turn.key ? t(turn.key) : "")}
            </ChatTurn>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
