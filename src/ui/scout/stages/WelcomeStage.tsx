/**
 * 1 · Willkommen (ScreensA.jsx `Welcome`).
 *
 * One blob, one greeting, one headline, one primary way in — plus the written
 * alternative. With the voice flag off the primary button still reads „Mit
 * Scout sprechen“ and explains itself through the hint, exactly as the kit does.
 */

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import { STAGE_SHELL, type StageProps } from "./stageProps";

export function WelcomeStage({ m, narrow }: StageProps) {
  const { t } = useCopy();
  const voiceOff = !m.s.flags.voice;

  const start = () => {
    if (voiceOff) {
      m.go("discovery", { mode: "text" });
      m.showHint(t("scout.hint.voiceDisabled"));
      return;
    }
    m.go("discovery", { mode: "voice" });
  };

  return (
    <div className={cn(STAGE_SHELL, "pb-[var(--space-17)]")}>
      <ScoutBlob
        size={narrow ? 128 : 168}
        className={narrow ? "mb-[var(--space-16)]" : "mb-[56px]"}
      />
      <div className="text-[length:var(--text-lead-size)] text-rs-ink-2">
        {t("scout.welcome.greeting", { name: t(m.s.nameKey) })}
      </div>
      <h1
        className={cn(
          "mt-[var(--space-6)] mb-0 max-w-[640px] font-light [text-wrap:balance]",
          "leading-[var(--text-display-leading)] tracking-[var(--text-display-tracking)]",
          narrow ? "text-[38px]" : "text-[length:var(--text-display-size)]",
        )}
      >
        {t("scout.welcome.headline")}
      </h1>
      <Button
        size="lg"
        icon={<Icon name="mic" size={20} />}
        className="mt-[var(--space-19)]"
        onClick={start}
      >
        {t("scout.welcome.cta.voice")}
      </Button>
      <Button
        variant="ghost"
        icon={<Icon name="keyboard" size={20} />}
        className="mt-[var(--space-10)] text-[length:var(--text-body-size)]"
        onClick={() => m.go("discovery", { mode: "text" })}
      >
        {t("scout.welcome.cta.text")}
      </Button>
      <div className="mt-[min(12vh,110px)] text-[length:var(--text-body-sm-size)] text-rs-ink-5">
        {t("scout.welcome.footnote")}
      </div>
    </div>
  );
}
