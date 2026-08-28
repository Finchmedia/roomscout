import { Check, Clipboard, LoaderCircle, Sparkles } from "lucide-react";
import { useAction, useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { MUSIC_CONTEXT_IMPORT_PROMPT } from "../../features/memory/contextImportPrompt";
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/^.*?ConvexError:\s*/, "");
  return "The context could not be processed. Please try again.";
}

export function ContextImportDialog({
  open,
  onOpenChange,
  onImported,
}: ContextImportDialogProps) {
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
    await navigator.clipboard.writeText(MUSIC_CONTEXT_IMPORT_PROMPT);
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
      setError(errorMessage(caught));
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
      setError(errorMessage(caught));
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

  return (
    <ActionDialog
      description={phase === "collect" ? "Bring useful context. Keep control." : `${selectedCount} of ${facts.length} facts selected`}
      footer={
        phase === "collect" ? (
          <button className="btn btn-p" disabled={busy !== undefined || sourceText.trim().length < 20} onClick={analyze} type="button">
            {busy === "analyzing" ? <LoaderCircle aria-hidden="true" className="rs-spin" size={15} /> : <Sparkles aria-hidden="true" size={15} />}
            Analyze for review
          </button>
        ) : (
          <>
            <button className="btn btn-g" disabled={busy !== undefined} onClick={() => { setFacts([]); setSelected(new Set()); }} type="button">Back</button>
            <button className="btn btn-p" disabled={busy !== undefined || selectedCount === 0} onClick={confirmImport} type="button">
              {busy === "importing" ? <LoaderCircle aria-hidden="true" className="rs-spin" size={15} /> : <Check aria-hidden="true" size={15} />}
              Remember {selectedCount} {selectedCount === 1 ? "fact" : "facts"}
            </button>
          </>
        )
      }
      onOpenChange={onOpenChange}
      open={open}
      title="Import your music context"
    >
      {phase === "collect" ? (
        <div className="rs-context-import">
          <div className="rs-import-step">
            <span className="mono">01 · Ask your current assistant</span>
            <p>Copy this prompt into ChatGPT, Claude, or another assistant that already knows your music life.</p>
            <textarea className="input rs-import-prompt" readOnly value={MUSIC_CONTEXT_IMPORT_PROMPT} />
            <button className="btn btn-s btn-sm" onClick={copyPrompt} type="button">
              {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <div className="rs-import-step">
            <span className="mono">02 · Paste the result here</span>
            <p>RoomScout extracts candidates with the AI Gateway. Nothing is stored until you review and confirm it.</p>
            <label className="sr-only" htmlFor="context-import-source">External assistant context</label>
            <textarea
              className="input rs-import-source"
              id="context-import-source"
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Paste your music context export…"
              value={sourceText}
            />
          </div>
          {error ? <p className="err" role="alert">{error}</p> : null}
        </div>
      ) : (
        <div className="rs-import-review">
          <div className="rs-import-summary">
            <span className="type t-scout">Scout readout</span>
            <p>{summary}</p>
            <span className="mono">{facts.length} candidates across {groupedCount} entities · no raw export stored</span>
          </div>
          <div className="rs-import-facts" role="list">
            {facts.map((fact, index) => (
              <label className={`rs-import-fact${selected.has(index) ? " on" : ""}`} key={`${fact.subject}-${fact.predicate}-${index}`}>
                <input checked={selected.has(index)} onChange={() => toggle(index)} type="checkbox" />
                <span>
                  <span className="rs-import-fact__head">
                    <b>{fact.subject}</b>
                    <span className="chip">{fact.category}</span>
                    {fact.sensitivity !== "normal" ? <span className="pill warn">{fact.sensitivity}</span> : null}
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
