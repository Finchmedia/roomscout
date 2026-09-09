/**
 * 3 · Suchauftrag (ScreensA.jsx `Brief`).
 *
 * The brief read back as one card, with inline editing: the pencil (or „Noch
 * etwas ändern“) turns every row into a field, „Übernehmen“ writes them back.
 * On a narrow stage the card becomes the bottom sheet.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FactList } from "@/components/ui/fact-list";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import { StageSheet } from "../chrome/StageSheet";
import { toFactRows } from "../state/stages";
import { STAGE_SHELL, type StageProps } from "./stageProps";

export function BriefStage({ m, narrow }: StageProps) {
  const { t } = useCopy();
  const [editing, setEditing] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  const save = () => {
    m.saveBriefEdits(drafts);
    setEditing(false);
    setDrafts({});
  };

  const cancel = () => {
    setEditing(false);
    setDrafts({});
  };

  const rows = toFactRows(t, m.s.facts);
  const onDraftChange = (id: string, value: string) =>
    setDrafts((current) => ({ ...current, [id]: value }));

  const actions = editing ? (
    <div className="mt-[var(--space-6)] flex animate-rs-fade-up justify-center gap-[var(--space-4)]">
      <Button size="sm" onClick={save}>
        {t("common.apply")}
      </Button>
      <Button variant="secondary" size="sm" onClick={cancel}>
        {t("common.cancel")}
      </Button>
    </div>
  ) : (
    <div className="mt-[var(--space-6)] flex animate-rs-fade-up flex-col items-center gap-[var(--space-6)]">
      <Button size="md" block onClick={() => m.go("scouting")}>
        {t("scout.brief.cta")}
      </Button>
      <div className="text-center text-[14.5px] leading-[1.55] text-rs-ink-4">
        {t("scout.brief.caption.line1")}
        <br />
        {t("scout.brief.caption.line2")}
      </div>
      <div className="flex gap-[var(--space-8)]">
        <Button
          variant="link"
          size="2xs"
          className="text-[length:var(--text-body-sm-size)] text-rs-ink-2"
          onClick={() => setEditing(true)}
        >
          {t("scout.brief.changeMore")}
        </Button>
        <Button
          variant="ghost"
          size="2xs"
          className="text-[length:var(--text-body-sm-size)] text-rs-ink-6"
          onClick={() => m.go("discovery")}
        >
          {t("scout.brief.backToConvo")}
        </Button>
      </div>
    </div>
  );

  const headline = (
    <h1
      className={cn(
        "mt-[var(--space-10)] font-light tracking-[var(--text-display-tracking)]",
        "leading-[var(--text-headline-leading)]",
        narrow ? "mb-0 text-[34px]" : "mb-[var(--space-12)] text-[length:var(--text-headline-size)]",
      )}
    >
      {t("scout.brief.headline")}
    </h1>
  );

  if (narrow) {
    return (
      <div className={cn(STAGE_SHELL, "relative justify-start pt-[var(--space-14)]")}>
        <ScoutBlob size={96} />
        {headline}
        <StageSheet variant="card" title={t("scout.brief.title")}>
          <FactList
            variant="compact"
            title=""
            facts={rows}
            editing={editing}
            drafts={drafts}
            onDraftChange={onDraftChange}
            className="w-full border-0 bg-transparent p-0"
          />
          {actions}
        </StageSheet>
      </div>
    );
  }

  return (
    <div className={cn(STAGE_SHELL, "animate-rs-fade-up justify-start pt-[var(--space-14)]")}>
      <ScoutBlob size={96} />
      {headline}
      <FactList
        variant="card"
        title={t("scout.brief.title")}
        facts={rows}
        onEdit={() => setEditing(true)}
        editing={editing}
        drafts={drafts}
        onDraftChange={onDraftChange}
      >
        {actions}
      </FactList>
    </div>
  );
}
