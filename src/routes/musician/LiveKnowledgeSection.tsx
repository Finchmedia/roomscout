import * as React from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Icon, type IconName } from "../../components/ui/icon";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Overline } from "../../components/ui/overline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { PageLead, PageTitle } from "../../ui/settings/primitives";

export type MemoryFact = {
  _id: Id<"memoryFacts">; subject: string; predicate: string; value: string;
  category: "identity" | "music" | "location" | "mobility" | "schedule" | "equipment" | "goal" | "preference" | "constraint" | "relationship" | "collaboration" | "room_need" | "other";
  source: "conversation" | "context_import" | "user_edit" | "agentmail" | "observed";
  verification: "user_stated" | "user_confirmed" | "inferred" | "external";
};
export type SavedNeed = {
  _id: Id<"savedNeeds">; locationLabel?: string; locationQuery?: string; maxBudgetEur?: number;
  arrangement: Array<"permanent" | "shared" | "hourly">; schedule: string[]; requirements: string[];
  openToSharing?: boolean; radiusKm?: number; genres?: string[]; instruments?: string[];
};
export type StructuredField = "maxBudgetEur" | "sharing" | "genres" | "location" | "radiusKm" | "schedule" | "requirements" | "instruments";
export type KnowledgeFact = Omit<MemoryFact, "_id" | "source" | "verification"> & {
  _id: string; memoryId?: Id<"memoryFacts">; structuredField?: StructuredField; structuredIndex?: number;
  detail?: string;
  source: MemoryFact["source"] | "saved_need"; verification: MemoryFact["verification"] | "structured";
};
type Fact = KnowledgeFact;
type Event = { _id: Id<"memoryEvents">; summary: string; occurredAt: number };
type Category = "band" | "alltag" | "ausstattung";

const categories: Category[] = ["band", "alltag", "ausstattung"];
const categoryLabels = { band: "Eure Band", alltag: "Alltag & Wege", ausstattung: "Ausstattung" };
const sourceLabels = {
  conversation: "Aus dem Gespräch", context_import: "Aus importiertem Kontext",
  user_edit: "Von euch bearbeitet", agentmail: "Aus einer Scout-Nachricht", observed: "Vom Scout beobachtet",
  saved_need: "Teil eures aktuellen Suchauftrags",
};

const structuredPredicates = new Set(["budget", "monthly_budget", "open_to_room_sharing", "preferred_genres", "genre", "city", "location", "preferred_rehearsal_schedule"]);

// Exported for focused contract tests alongside this small view model.
// eslint-disable-next-line react-refresh/only-export-components
export function combineKnowledgeFacts(need: SavedNeed | undefined, memoryFacts: MemoryFact[]): Fact[] {
  const structured: Fact[] = [];
  const add = (field: StructuredField, predicate: string, value: string, category: Fact["category"], index?: number) => structured.push({
    _id: `need:${field}:${index ?? 0}`, subject: "Euer Suchauftrag", predicate, value, category,
    source: "saved_need", verification: "structured", structuredField: field, structuredIndex: index,
  });
  if (need?.maxBudgetEur !== undefined) add("maxBudgetEur", "monthly_budget", String(need.maxBudgetEur), "constraint");
  if (need?.openToSharing !== undefined || need?.arrangement.includes("shared")) {
    const memberCount = memoryFacts.find((fact) => fact.predicate === "member_count")?.value;
    const sharing = need.openToSharing === false ? "Keine Raumteilung" : "Raumteilung möglich";
    add("sharing", "open_to_room_sharing", memberCount ? `${sharing} · ${/^\d+$/.test(memberCount) ? `${memberCount} Personen` : memberCount}` : sharing, "collaboration");
    const remembered = memoryFacts.find((fact) => fact.predicate === "open_to_room_sharing");
    if (remembered) structured.at(-1)!.detail = remembered.value;
  }
  if (need?.genres?.length) add("genres", "preferred_genres", need.genres.join(" und "), "music");
  const location = need?.locationLabel ?? need?.locationQuery;
  if (location) add("location", "location", location, "location");
  if (need?.radiusKm !== undefined) add("radiusKm", "radius", `${need.radiusKm} km Umkreis`, "mobility");
  if (need?.schedule.length) add("schedule", "preferred_rehearsal_schedule", need.schedule.join(" · "), "schedule");
  need?.requirements.forEach((value, index) => add("requirements", "requirement", value, /drum|amp|instrument|schlagzeug|verst.rker/i.test(value) ? "equipment" : "constraint", index));
  need?.instruments?.forEach((value, index) => add("instruments", "instrument", value, "equipment", index));
  const memory = memoryFacts.filter((fact) => {
    if (fact.predicate === "member_count" && structured.some((item) => item.structuredField === "sharing")) return false;
    return !structuredPredicates.has(fact.predicate) || !structured.some((item) => item.predicate === fact.predicate || predicateLabels[item.predicate] === predicateLabels[fact.predicate]);
  });
  return [...structured, ...memory.map((fact) => ({ ...fact, _id: String(fact._id), memoryId: fact._id }))];
}

const predicateLabels: Record<string, string> = {
  member_count: "Besetzung", preferred_genres: "Musikrichtung", genre: "Musikrichtung",
  open_to_room_sharing: "Raumteilung", rehearsal_volume_requirement: "Lautstärke",
  drum_kit_room_preference: "Schlagzeug", preferred_rehearsal_schedule: "Probenzeit",
  city: "Ort", location: "Ort", radius: "Umkreis", requirement: "Anforderung", instrument: "Instrument", budget: "Budget", monthly_budget: "Budget",
};

function classify(fact: Fact): Category {
  if (["equipment"].includes(fact.category) || /drum|amp|equipment|instrument|schlagzeug|verst.rker/i.test(fact.predicate)) return "ausstattung";
  if (["location", "mobility", "schedule"].includes(fact.category) || /city|location|schedule|time|day|distance|travel|ort|weg/i.test(fact.predicate)) return "alltag";
  return "band";
}

function glyph(fact: Fact): IconName {
  if (classify(fact) === "ausstattung") return "drum";
  if (fact.category === "location") return "pin";
  if (fact.category === "schedule") return "clock";
  if (/budget|price|cost/i.test(fact.predicate)) return "card";
  if (/member|sharing|collaboration/i.test(fact.predicate)) return "users";
  return "music";
}

// eslint-disable-next-line react-refresh/only-export-components
export function displayText(fact: Fact) {
  const label = predicateLabels[fact.predicate];
  if (!label) return `${fact.predicate.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}: ${fact.value}`;
  if (label === "Budget" && /^\d+(?:[.,]\d+)?$/.test(fact.value.trim())) return `Bis ${fact.value} € / Monat`;
  if (label === "Besetzung" && /^\d+$/.test(fact.value.trim())) return `${fact.value} Personen`;
  if (fact.predicate === "requirement" && /volle?r? lautst.rke|\bpa\b/i.test(fact.value)) return "Laute Proben mit PA erforderlich";
  return fact.value;
}

function FactRow({ fact, busy, onUpdate, onConfirm, onDelete }: {
  fact: Fact; busy: boolean; onUpdate: (value: string) => void; onConfirm: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(fact.value);
  const inferred = fact.verification === "inferred";
  return <div data-slot="live-knowledge-row" className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-[var(--space-6)] border-b border-rs-border-divider px-[var(--space-3)] py-[var(--space-6)]">
    <span aria-hidden="true" className="flex size-[26px] items-center justify-center text-rs-ink-2"><Icon name={glyph(fact)} size={22} strokeWidth={1.5} /></span>
    <div className="min-w-0">{editing ? <form className="flex items-start gap-[var(--space-3)]" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { onUpdate(draft.trim()); setEditing(false); } }}>
      <Input autoFocus label="Angabe bearbeiten" value={draft} onChange={(event) => setDraft(event.target.value)} wrapperClassName="min-w-[220px] flex-1" />
      <Button size="xs" disabled={busy}>Speichern</Button><Button type="button" variant="secondary" size="xs" onClick={() => { setDraft(fact.value); setEditing(false); }}>Abbrechen</Button>
    </form> : <><div title={fact.detail ?? fact.value} className="text-[length:var(--text-body-lg-size)]">{displayText(fact)}</div><div className="mt-[2px] text-[length:var(--text-caption-sm-size)] text-rs-ink-6">{sourceLabels[fact.source]}</div></>}</div>
    {inferred ? <div className="flex items-center gap-[var(--space-2)]"><Button variant="link" size="2xs" disabled={busy} onClick={onConfirm}>Stimmt</Button><Button variant="ghost" size="2xs" disabled={busy} onClick={onDelete}>Nicht wichtig</Button></div> : editing ? <span /> : <div className="flex items-center gap-[var(--space-1)]">
      <IconButton variant="bare" size={40} label="Bearbeiten" onClick={() => setEditing(true)}><Icon name="edit" size={18} /></IconButton>
      {fact.memoryId ? <DropdownMenu><DropdownMenuTrigger asChild><IconButton variant="bare" size={40} label="Mehr"><span className="text-xl tracking-[3px]">•••</span></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onDelete}>Nicht mehr verwenden</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}
    </div>}
  </div>;
}

export function LiveKnowledgeSection({ summary, need, facts: memoryFacts, events, busy, onImport, onUpdate, onConfirm, onDelete, onManage }: {
  summary?: string; need?: SavedNeed; facts: MemoryFact[]; events: Event[]; busy: boolean; onImport: () => void;
  onUpdate: (fact: Fact, value: string) => void; onConfirm: (factId: Id<"memoryFacts">) => void;
  onDelete: (factId: Id<"memoryFacts">) => void; onManage: () => void;
}) {
  const [tab, setTab] = React.useState<Category>("band");
  const [history, setHistory] = React.useState(false);
  const facts = combineKnowledgeFacts(need, memoryFacts);
  return <><PageTitle>Was ich über euch weiß</PageTitle><PageLead>Korrigiert mich jederzeit. Ihr bestimmt, was ich mir merke.</PageLead>
    <div className="mt-[var(--space-12)] flex items-center justify-between gap-[var(--space-9)] rounded-card border border-rs-border-panel bg-rs-surface-subtle px-[var(--space-11)] py-[var(--space-9)]"><p className="m-0 text-[length:var(--text-body-lg-size)] leading-[1.45]">{summary || "Noch kein zusammengefasster Kontext."}</p><IconButton variant="bare" size={40} label="Angaben bearbeiten" onClick={() => setTab("band")}><Icon name="edit" size={20} /></IconButton></div>
    <Tabs value={tab} onValueChange={(value) => setTab(value as Category)} className="mt-[var(--space-10)]"><TabsList aria-label="Wissenskategorien">{categories.map((category) => <TabsTrigger key={category} value={category}>{categoryLabels[category]}</TabsTrigger>)}</TabsList>{categories.map((category) => { const rows = facts.filter((fact) => classify(fact) === category); return <TabsContent key={category} value={category} className="pt-[var(--space-10)]"><Overline>{categoryLabels[category]}</Overline><div className="mt-[var(--space-2)]">{rows.map((fact) => <FactRow key={fact._id} fact={fact} busy={busy} onUpdate={(value) => onUpdate(fact, value)} onConfirm={() => fact.memoryId && onConfirm(fact.memoryId)} onDelete={() => fact.memoryId && onDelete(fact.memoryId)} />)}{rows.length === 0 ? <p className="py-[var(--space-8)] text-rs-ink-4">Hier habe ich noch nichts gespeichert.</p> : null}</div></TabsContent>; })}</Tabs>
    <Button variant="link" size="2xs" aria-expanded={history} className="mt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink" onClick={() => setHistory((value) => !value)}>{history ? "Änderungsverlauf ausblenden" : "Änderungsverlauf ansehen"}</Button>
    {history ? <div className="mt-[var(--space-4)] rounded-card border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-9)] py-[var(--space-6)]">{events.length ? events.map((event) => <div key={event._id} className="flex justify-between gap-6 border-b border-rs-border-divider-soft py-2 text-sm"><span>{event.summary}</span><span className="whitespace-nowrap text-rs-ink-6">{new Date(event.occurredAt).toLocaleDateString("de-DE")}</span></div>) : <p className="text-sm text-rs-ink-6">Noch keine Änderungen.</p>}</div> : null}
    <div className="mt-[var(--space-12)] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[var(--space-9)] border-t border-rs-border-divider pt-[var(--space-11)]"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/></svg><div><div className="text-[length:var(--text-body-lg-size)]">Dein bisheriger Kontext kann mitkommen</div><div className="mt-1 text-[length:var(--text-caption-size)] text-rs-ink-4">Musik-Kontext aus ChatGPT oder Claude übernehmen.</div></div><Button variant="secondary" size="sm" onClick={onImport}>Kontext importieren</Button></div>
    <Button variant="link" size="2xs" className="mt-[var(--space-10)] text-[length:var(--text-body-sm-size)] text-rs-ink" onClick={onManage}>Gespeicherte Informationen verwalten</Button>
  </>;
}
