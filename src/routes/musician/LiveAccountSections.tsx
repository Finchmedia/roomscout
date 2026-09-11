import { Button } from "../../components/ui/button";
import { Icon, type IconName } from "../../components/ui/icon";
import { Overline } from "../../components/ui/overline";
import { PageLead, PageTitle, SettingsRow } from "../../ui/settings/primitives";

export interface BillingActivity {
  activeSearches?: number;
  providersContacted?: number;
  scoutConversations?: number;
}

export interface LiveBillingSectionProps {
  activity?: BillingActivity;
}

function DisabledLine({ icon, title, detail, action }: { icon: IconName; title: string; detail: string; action: string }) {
  return <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[var(--space-9)] border-b border-rs-border-divider py-[var(--space-9)] max-[959px]:grid-cols-[auto_minmax(0,1fr)] max-[959px]:[&>button]:col-start-2 max-[959px]:[&>button]:justify-self-start">
    <Icon name={icon} size={26} strokeWidth={1.5} className="text-rs-ink-2" />
    <div><div className="text-[length:var(--text-body-lg-size)]">{title}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{detail}</div></div>
    <Button variant="secondary" size="xs" disabled>{action}</Button>
  </div>;
}

function ActivityValue({ value, label, divided }: { value?: number; label: string; divided?: boolean }) {
  return <div className={`${divided ? "border-l border-rs-border-divider ps-[var(--space-13)]" : ""} py-[var(--space-2)]`}>
    <div className={value === undefined ? "pt-[var(--space-5)] text-[22px] text-rs-ink-2" : "text-[40px] font-medium tracking-[-0.02em]"}>{value ?? "Noch nicht erfasst"}</div>
    <div className="mt-[2px] text-[length:var(--text-body-size)] text-rs-ink-4">{label}</div>
  </div>;
}

export function LiveBillingSection({ activity }: LiveBillingSectionProps) {
  return <>
    <PageTitle>Tarif &amp; Nutzung</PageTitle>
    <PageLead>Dein Zugang, deine Aktivität und deine Abrechnung.</PageLead>
    <Overline className="mt-[var(--space-12)] border-t border-rs-border-divider pt-[var(--space-10)]">Dein Zugang</Overline>
    <div className="mt-[var(--space-4)] flex items-center justify-between gap-[var(--space-9)] border-b border-rs-border-divider pb-[var(--space-10)]">
      <div><div className="text-[22px]">Demo-Zugang</div><div className="mt-[var(--space-1)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">Kein kostenpflichtiges Abonnement aktiv.</div></div>
      <Button variant="secondary" size="sm" disabled>Tarife ansehen</Button>
    </div>
    <Overline className="mt-[var(--space-11)]">Aktivität</Overline>
    <div className="mt-[var(--space-6)] grid grid-cols-[repeat(3,minmax(0,1fr))] max-[959px]:grid-cols-1 max-[959px]:[&>div]:border-l-0 max-[959px]:[&>div]:border-b max-[959px]:[&>div]:border-rs-border-divider max-[959px]:[&>div]:ps-0">
      <ActivityValue value={activity?.activeSearches} label="Aktive Suchen" />
      <ActivityValue value={activity?.providersContacted} label="Anbieter kontaktiert" divided />
      <ActivityValue value={activity?.scoutConversations} label="Gespräche mit Scout" divided />
    </div>
    <div className="mt-[var(--space-4)] border-b border-rs-border-divider pb-[var(--space-10)] text-[length:var(--text-caption-size)] text-rs-ink-6">Aktivitätsübersicht, keine Abrechnungseinheiten.</div>
    <DisabledLine icon="card" title="Zahlungsdaten" detail="Keine Zahlungsmethode hinterlegt" action="Verwalten" />
    <DisabledLine icon="home" title="Rechnungsadresse" detail="Noch nicht hinterlegt" action="Hinzufügen" />
    <Overline className="mt-[var(--space-11)]">Rechnungen</Overline>
    <div className="mt-[var(--space-6)] grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[var(--space-9)]"><Icon name="doc" size={26} strokeWidth={1.5} className="text-rs-ink-2" /><div><div className="text-[length:var(--text-body-lg-size)]">Noch keine Rechnungen</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">Hier findest du später deine Belege.</div></div></div>
    <div className="mt-[var(--space-13)] text-end text-[length:var(--text-caption-size)] text-rs-ink-6">Noch keine Zahlungsintegration</div>
  </>;
}

export interface LivePrivacySectionProps {
  storedFactCount?: number;
  portalConnectionCount?: number;
  onKnowledge: () => void;
  onSources: () => void;
  onScout: () => void;
}

const countText = (count: number | undefined, singular: string, plural: string, fallback: string) => count === undefined ? fallback : `${count} ${count === 1 ? singular : plural}`;

export function LivePrivacySection({ storedFactCount, portalConnectionCount, onKnowledge, onSources, onScout }: LivePrivacySectionProps) {
  return <>
    <PageTitle>Deine Daten, deine Kontrolle</PageTitle>
    <PageLead>Hier siehst du, welche Informationen RoomScout für deine Suche in der Cloud speichert und wo du sie verwalten kannst.</PageLead>
    <div className="mt-[var(--space-12)]">
      <SettingsRow className="border-t border-t-rs-border-divider py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">Gespeicherte Angaben</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{countText(storedFactCount, "Angabe über euch und eure Suche", "Angaben über euch und eure Suche", "Angaben über eure Band und Suche")}</div></div><Button variant="secondary" size="xs" onClick={onKnowledge}>Gespeicherte Angaben ansehen</Button></SettingsRow>
      <SettingsRow className="py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">Gesprächsverlauf</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">Eure Gespräche mit dem Scout sind in der App einsehbar.</div></div><Button variant="secondary" size="xs" onClick={onScout}>Gespräche ansehen</Button></SettingsRow>
      <SettingsRow className="py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">Portalzugänge</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{countText(portalConnectionCount, "verbundener Portalzugang", "verbundene Portalzugänge", "Verbindungen zu euren Portalen")}</div></div><Button variant="secondary" size="xs" onClick={onSources}>Portalzugänge verwalten</Button></SettingsRow>
      <SettingsRow className="py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">Export</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">Ein sicherer Self-Service-Datenexport ist noch nicht verfügbar.</div></div><Button variant="secondary" size="xs" disabled>Daten exportieren</Button></SettingsRow>
      <SettingsRow className="py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">Konto löschen</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">Die endgültige Löschung aller Kontodaten ist noch nicht als sichere Self-Service-Aktion verfügbar.</div></div><Button variant="secondary" size="xs" disabled>Konto löschen</Button></SettingsRow>
      <div className="py-[var(--space-8)]"><div className="text-[length:var(--text-body-lg-size)]">Beteiligte Dienstleister</div><div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">RoomScout nutzt je nach Funktion Convex, OpenAI, Firecrawl, AgentMail und Browserbase für Datenspeicherung, KI-Verarbeitung, Webrecherche, Scout-Postfächer und Portalzugänge.</div></div>
    </div>
  </>;
}
