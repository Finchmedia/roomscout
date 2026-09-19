import * as React from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Icon, type IconName } from "../../components/ui/icon";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Overline } from "../../components/ui/overline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { de, en, interpolate, useCopy, type Dict, type Locale } from "../../ui/copy";
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

type KnowledgeLabels = {
  savedNeedSubject: string;
  noSharing: string;
  sharingOpen: string;
  people: (count: string | number) => string;
  genreJoiner: string;
  radius: (count: string | number) => string;
  budget: (value: string) => string;
  compactLoudPaRequirement?: string;
};

function knowledgeLabelsFromCatalog(catalog: Dict["liveSettings"], compactStoredRequirement = false): KnowledgeLabels {
  return {
    savedNeedSubject: catalog.knowledgeSavedNeedSubject,
    noSharing: catalog.knowledgeNoSharing,
    sharingOpen: catalog.knowledgeSharingOpen,
    people: (count) => interpolate(catalog.knowledgePeople, { count }),
    genreJoiner: catalog.knowledgeGenreJoiner,
    radius: (count) => interpolate(catalog.knowledgeRadius, { count }),
    budget: (value) => interpolate(catalog.knowledgeBudget, { value }),
    compactLoudPaRequirement: compactStoredRequirement ? catalog.knowledgeLoudPaRequirement : undefined,
  };
}

function resolveKnowledgeLabels(localization: Locale | KnowledgeLabels): KnowledgeLabels {
  if (typeof localization !== "string") return localization;
  return knowledgeLabelsFromCatalog(
    localization === "de" ? de.liveSettings : en.liveSettings,
    localization === "de",
  );
}

const structuredPredicates = new Set(["budget", "monthly_budget", "open_to_room_sharing", "preferred_genres", "genre", "city", "location", "preferred_rehearsal_schedule"]);

// Exported for focused contract tests alongside this small view model.
// eslint-disable-next-line react-refresh/only-export-components
export function combineKnowledgeFacts(need: SavedNeed | undefined, memoryFacts: MemoryFact[], localization: Locale | KnowledgeLabels = "de"): Fact[] {
  const labels = resolveKnowledgeLabels(localization);
  const structured: Fact[] = [];
  const add = (field: StructuredField, predicate: string, value: string, category: Fact["category"], index?: number) => structured.push({
    _id: `need:${field}:${index ?? 0}`, subject: labels.savedNeedSubject, predicate, value, category,
    source: "saved_need", verification: "structured", structuredField: field, structuredIndex: index,
  });
  if (need?.maxBudgetEur !== undefined) add("maxBudgetEur", "monthly_budget", String(need.maxBudgetEur), "constraint");
  if (need?.openToSharing !== undefined || need?.arrangement.includes("shared")) {
    const memberCount = memoryFacts.find((fact) => fact.predicate === "member_count")?.value;
    const sharing = need.openToSharing === false ? labels.noSharing : labels.sharingOpen;
    const members = /^\d+$/.test(memberCount ?? "") ? labels.people(memberCount!) : memberCount;
    add("sharing", "open_to_room_sharing", memberCount ? `${sharing} · ${members}` : sharing, "collaboration");
    const remembered = memoryFacts.find((fact) => fact.predicate === "open_to_room_sharing");
    if (remembered) structured.at(-1)!.detail = remembered.value;
  }
  if (need?.genres?.length) add("genres", "preferred_genres", need.genres.join(labels.genreJoiner), "music");
  const location = need?.locationLabel ?? need?.locationQuery;
  if (location) add("location", "location", location, "location");
  if (need?.radiusKm !== undefined) add("radiusKm", "radius", labels.radius(need.radiusKm), "mobility");
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
export function displayText(fact: Fact, localization: Locale | KnowledgeLabels = "de") {
  const labels = resolveKnowledgeLabels(localization);
  const label = predicateLabels[fact.predicate];
  if (!label) return `${fact.predicate.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}: ${fact.value}`;
  if (label === "Budget" && /^\d+(?:[.,]\d+)?$/.test(fact.value.trim())) return labels.budget(fact.value);
  if (label === "Besetzung" && /^\d+$/.test(fact.value.trim())) return labels.people(fact.value);
  if (labels.compactLoudPaRequirement && fact.predicate === "requirement" && /volle?r? lautst.rke|\bpa\b/i.test(fact.value)) return labels.compactLoudPaRequirement;
  return fact.value;
}

function FactRow({ fact, labels, busy, onUpdate, onConfirm, onDelete }: {
  fact: Fact; labels: KnowledgeLabels; busy: boolean; onUpdate: (value: string) => void; onConfirm: () => void; onDelete: () => void;
}) {
  const { t } = useCopy();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(fact.value);
  const inferred = fact.verification === "inferred";
  return <div data-slot="live-knowledge-row" className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-[var(--space-6)] border-b border-rs-border-divider px-[var(--space-3)] py-[var(--space-6)]">
    <span aria-hidden="true" className="flex size-[26px] items-center justify-center text-rs-ink-2"><Icon name={glyph(fact)} size={22} strokeWidth={1.5} /></span>
    <div className="min-w-0">{editing ? <form className="flex items-start gap-[var(--space-3)]" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { onUpdate(draft.trim()); setEditing(false); } }}>
      <Input autoFocus label={t("settings.knowledge.edit.inputAria")} value={draft} onChange={(event) => setDraft(event.target.value)} wrapperClassName="min-w-[220px] flex-1" />
      <Button size="xs" disabled={busy}>{t("settings.knowledge.edit.save")}</Button><Button type="button" variant="secondary" size="xs" onClick={() => { setDraft(fact.value); setEditing(false); }}>{t("settings.knowledge.edit.cancel")}</Button>
    </form> : <><div title={fact.detail ?? fact.value} className="text-[length:var(--text-body-lg-size)]">{displayText(fact, labels)}</div><div className="mt-[2px] text-[length:var(--text-caption-sm-size)] text-rs-ink-6">{sourceLabel(fact.source, t)}</div></>}</div>
    {inferred ? <div className="flex items-center gap-[var(--space-2)]"><Button variant="link" size="2xs" disabled={busy} onClick={onConfirm}>{t("settings.knowledge.action.confirm")}</Button><Button variant="ghost" size="2xs" disabled={busy} onClick={onDelete}>{t("settings.knowledge.action.dismiss")}</Button></div> : editing ? <span /> : <div className="flex items-center gap-[var(--space-1)]">
      <IconButton variant="bare" size={40} label={t("settings.knowledge.action.editAria")} onClick={() => setEditing(true)}><Icon name="edit" size={18} /></IconButton>
      {fact.memoryId ? <DropdownMenu><DropdownMenuTrigger asChild><IconButton variant="bare" size={40} label={t("settings.knowledge.action.menuAria")}><span className="text-xl tracking-[3px]">•••</span></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onDelete}>{t("settings.knowledge.menu.retire")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}
    </div>}
  </div>;
}

function sourceLabel(source: Fact["source"], t: ReturnType<typeof useCopy>["t"]) {
  switch (source) {
    case "conversation": return t("liveSettings.knowledgeSourceConversation");
    case "context_import": return t("liveSettings.knowledgeSourceImport");
    case "user_edit": return t("liveSettings.knowledgeSourceUserEdit");
    case "agentmail": return t("liveSettings.knowledgeSourceAgentMail");
    case "observed": return t("liveSettings.knowledgeSourceObserved");
    case "saved_need": return t("liveSettings.knowledgeSourceSavedNeed");
  }
}

export function LiveKnowledgeSection({ summary, need, facts: memoryFacts, events, busy, onImport, onUpdate, onConfirm, onDelete, onManage }: {
  summary?: string; need?: SavedNeed; facts: MemoryFact[]; events: Event[]; busy: boolean; onImport: () => void;
  onUpdate: (fact: Fact, value: string) => void; onConfirm: (factId: Id<"memoryFacts">) => void;
  onDelete: (factId: Id<"memoryFacts">) => void; onManage: () => void;
}) {
  const { t, locale, dict } = useCopy();
  const [tab, setTab] = React.useState<Category>("band");
  const [history, setHistory] = React.useState(false);
  const labels = knowledgeLabelsFromCatalog(dict.liveSettings, locale === "de");
  const facts = combineKnowledgeFacts(need, memoryFacts, labels);
  const categoryLabel = (category: Category) => t(category === "band" ? "settings.knowledge.tab.band" : category === "alltag" ? "settings.knowledge.tab.alltag" : "settings.knowledge.tab.ausstattung");
  return <><PageTitle>{t("settings.knowledge.title")}</PageTitle><PageLead>{t("settings.knowledge.subtitle")}</PageLead>
    <div className="mt-[var(--space-12)] flex items-center justify-between gap-[var(--space-9)] rounded-card border border-rs-border-panel bg-rs-surface-subtle px-[var(--space-11)] py-[var(--space-9)]"><p className="m-0 text-[length:var(--text-body-lg-size)] leading-[1.45]">{summary || t("liveSettings.noContext")}</p><IconButton variant="bare" size={40} label={t("settings.knowledge.summary.editAria")} onClick={() => setTab("band")}><Icon name="edit" size={20} /></IconButton></div>
    <Tabs value={tab} onValueChange={(value) => setTab(value as Category)} className="mt-[var(--space-10)]"><TabsList aria-label={t("liveSettings.knowledgeCategoriesAria")}>{categories.map((category) => <TabsTrigger key={category} value={category}>{categoryLabel(category)}</TabsTrigger>)}</TabsList>{categories.map((category) => { const rows = facts.filter((fact) => classify(fact) === category); return <TabsContent key={category} value={category} className="pt-[var(--space-10)]"><Overline>{categoryLabel(category)}</Overline><div className="mt-[var(--space-2)]">{rows.map((fact) => <FactRow key={fact._id} fact={fact} labels={labels} busy={busy} onUpdate={(value) => onUpdate(fact, value)} onConfirm={() => fact.memoryId && onConfirm(fact.memoryId)} onDelete={() => fact.memoryId && onDelete(fact.memoryId)} />)}{rows.length === 0 ? <p className="py-[var(--space-8)] text-rs-ink-4">{t("liveSettings.knowledgeEmpty")}</p> : null}</div></TabsContent>; })}</Tabs>
    <Button variant="link" size="2xs" aria-expanded={history} className="mt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink" onClick={() => setHistory((value) => !value)}>{t(history ? "settings.knowledge.log.hide" : "settings.knowledge.log.show")}</Button>
    {history ? <div className="mt-[var(--space-4)] rounded-card border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-9)] py-[var(--space-6)]">{events.length ? events.map((event) => <div key={event._id} className="flex justify-between gap-6 border-b border-rs-border-divider-soft py-2 text-sm"><span>{event.summary}</span><span className="whitespace-nowrap text-rs-ink-6">{new Date(event.occurredAt).toLocaleDateString(locale === "de" ? "de-DE" : "en-US")}</span></div>) : <p className="text-sm text-rs-ink-6">{t("liveSettings.knowledgeNoChanges")}</p>}</div> : null}
    <div className="mt-[var(--space-12)] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[var(--space-9)] border-t border-rs-border-divider pt-[var(--space-11)]"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/></svg><div><div className="text-[length:var(--text-body-lg-size)]">{t("settings.knowledge.import.title")}</div><div className="mt-1 text-[length:var(--text-caption-size)] text-rs-ink-4">{t("settings.knowledge.import.sub")}</div></div><Button variant="secondary" size="sm" onClick={onImport}>{t("settings.knowledge.import.cta")}</Button></div>
    <Button variant="link" size="2xs" className="mt-[var(--space-10)] text-[length:var(--text-body-sm-size)] text-rs-ink" onClick={onManage}>{t("settings.knowledge.managePrivacy")}</Button>
  </>;
}
