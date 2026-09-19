import { Check, Clipboard, LoaderCircle, Sparkles } from "lucide-react";
import { useAction, useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useCopy } from "../../ui/copy";
import { ActionDialog } from "../ui/ActionDialog";

type EntityKind = "person" | "band" | "place" | "equipment" | "organization" | "project" | "other";
type FactCategory = "identity" | "music" | "location" | "mobility" | "schedule" | "equipment" | "goal" | "preference" | "constraint" | "relationship" | "collaboration" | "room_need" | "other";
type Sensitivity = "normal" | "personal" | "sensitive";

type ImportFact = {
  subject: string;
  subjectKind: EntityKind;
  predicate: string;
  value: string;
  objectName?: string;
  objectKind?: EntityKind;
  category: FactCategory;
  confidence: number;
  sensitivity: Sensitivity;
  relevance: string;
};

type ContextImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message.replace(/^.*?ConvexError:\s*/, "");
  return fallback;
}

export function ContextImportDialog({
  open,
  onOpenChange,
  onImported,
}: ContextImportDialogProps) {
  const { t, tp } = useCopy();
  const parseContext = useAction(api.memory.parseContextImport);
  const importFacts = useMutation(api.memory.importFacts);
  const [sourceText, setSourceText] = useState("");
  const [summary, setSummary] = useState("");
  const [facts, setFacts] = useState<ImportFact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<"analyzing" | "importing">();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const selectedCount = selected.size;
  const phase = facts.length > 0 ? "review" : "collect";

  const groupedCount = useMemo(
    () => new Set(facts.map((fact) => fact.subject)).size,
    [facts],
  );

  async function copyPrompt() {
    await navigator.clipboard.writeText(t("liveSettings.importPrompt"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function analyze() {
    if (sourceText.trim().length < 20) return;
    setBusy("analyzing");
    setError("");
    try {
      const result = await parseContext({ text: sourceText });
      setSummary(result.summary);
      setFacts(result.facts);
      setSelected(
        new Set(
          result.facts.flatMap((fact, index) =>
            fact.sensitivity === "sensitive" ? [] : [index],
          ),
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught, t("liveSettings.importError")));
    } finally {
      setBusy(undefined);
    }
  }

  async function confirmImport() {
    const chosenFacts = facts.filter((_, index) => selected.has(index));
    if (chosenFacts.length === 0) return;
    setBusy("importing");
    setError("");
    try {
      const result = await importFacts({
        batchId: crypto.randomUUID(),
        facts: chosenFacts,
      });
      onImported?.(result.imported);
      setSourceText("");
      setSummary("");
      setFacts([]);
      setSelected(new Set());
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, t("liveSettings.importError")));
    } finally {
      setBusy(undefined);
    }
  }

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function categoryLabel(category: FactCategory) {
    switch (category) {
      case "identity": return t("liveSettings.importCategoryIdentity");
      case "music": return t("liveSettings.importCategoryMusic");
      case "location": return t("liveSettings.importCategoryLocation");
      case "mobility": return t("liveSettings.importCategoryMobility");
      case "schedule": return t("liveSettings.importCategorySchedule");
      case "equipment": return t("liveSettings.importCategoryEquipment");
      case "goal": return t("liveSettings.importCategoryGoal");
      case "preference": return t("liveSettings.importCategoryPreference");
      case "constraint": return t("liveSettings.importCategoryConstraint");
      case "relationship": return t("liveSettings.importCategoryRelationship");
      case "collaboration": return t("liveSettings.importCategoryCollaboration");
      case "room_need": return t("liveSettings.importCategoryRoomNeed");
      case "other": return t("liveSettings.importCategoryOther");
    }
  }

  function sensitivityLabel(sensitivity: Exclude<Sensitivity, "normal">) {
    return t(sensitivity === "personal" ? "liveSettings.importSensitivityPersonal" : "liveSettings.importSensitivitySensitive");
  }

  return (
    <ActionDialog
      description={phase === "collect"
        ? t("liveSettings.importCollectDescription")
        : tp("liveSettings.importReviewDescription", selectedCount, { n: facts.length })}
      footer={
        phase === "collect" ? (
          <button className="btn btn-p" disabled={busy !== undefined || sourceText.trim().length < 20} onClick={analyze} type="button">
            {busy === "analyzing" ? <LoaderCircle aria-hidden="true" className="rs-spin" size={15} /> : <Sparkles aria-hidden="true" size={15} />}
            {t("liveSettings.importAnalyze")}
          </button>
        ) : (
          <>
            <button className="btn btn-g" disabled={busy !== undefined} onClick={() => { setFacts([]); setSelected(new Set()); }} type="button">{t("liveSettings.importBack")}</button>
            <button className="btn btn-p" disabled={busy !== undefined || selectedCount === 0} onClick={confirmImport} type="button">
              {busy === "importing" ? <LoaderCircle aria-hidden="true" className="rs-spin" size={15} /> : <Check aria-hidden="true" size={15} />}
              {tp("liveSettings.importRemember", selectedCount)}
            </button>
          </>
        )
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t("liveSettings.importDialogTitle")}
    >
      {phase === "collect" ? (
        <div className="rs-context-import">
          <div className="rs-import-step">
            <span className="mono">{t("liveSettings.importStepAsk")}</span>
            <p>{t("liveSettings.importAskBody")}</p>
            <textarea className="input rs-import-prompt" readOnly value={t("liveSettings.importPrompt")} />
            <button className="btn btn-s btn-sm" onClick={copyPrompt} type="button">
              {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
              {t(copied ? "liveSettings.importCopied" : "liveSettings.importCopyPrompt")}
            </button>
          </div>
          <div className="rs-import-step">
            <span className="mono">{t("liveSettings.importStepPaste")}</span>
            <p>{t("liveSettings.importPasteBody")}</p>
            <label className="sr-only" htmlFor="context-import-source">{t("liveSettings.importSourceLabel")}</label>
            <textarea
              className="input rs-import-source"
              id="context-import-source"
              onChange={(event) => setSourceText(event.target.value)}
              placeholder={t("liveSettings.importSourcePlaceholder")}
              value={sourceText}
            />
          </div>
          {error ? <p className="err" role="alert">{error}</p> : null}
        </div>
      ) : (
        <div className="rs-import-review">
          <div className="rs-import-summary">
            <span className="type t-scout">{t("liveSettings.importScoutReadout")}</span>
            <p>{summary}</p>
            <span className="mono">{tp("liveSettings.importReviewMeta", facts.length, { n: groupedCount })}</span>
          </div>
          <div className="rs-import-facts" role="list">
            {facts.map((fact, index) => (
              <label className={`rs-import-fact${selected.has(index) ? " on" : ""}`} key={`${fact.subject}-${fact.predicate}-${index}`}>
                <input checked={selected.has(index)} onChange={() => toggle(index)} type="checkbox" />
                <span>
                  <span className="rs-import-fact__head">
                    <b>{fact.subject}</b>
                    <span className="chip">{categoryLabel(fact.category)}</span>
                    {fact.sensitivity !== "normal" ? <span className="pill warn">{sensitivityLabel(fact.sensitivity)}</span> : null}
                  </span>
                  <span className="rs-import-fact__value">{fact.value}</span>
                  <small>{fact.relevance}</small>
                </span>
              </label>
            ))}
          </div>
          {error ? <p className="err" role="alert">{error}</p> : null}
        </div>
      )}
    </ActionDialog>
  );
}
