import * as React from "react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Capsule } from "@/components/ui/capsule"
import { Card } from "@/components/ui/card"
import { ChatBubble } from "@/components/ui/chat-bubble"
import { Composer } from "@/components/ui/composer"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FactList, type Fact } from "@/components/ui/fact-list"
import { Hint } from "@/components/ui/hint"
import { Icon, ICON_NAMES } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Notice } from "@/components/ui/notice"
import { Overline } from "@/components/ui/overline"
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card"
import { ScoutBlob, type ScoutBlobState } from "@/components/ui/scout-blob"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { showToast } from "@/components/ui/sonner"
import { StatusDot } from "@/components/ui/status-dot"
import { Stepper } from "@/components/ui/stepper"
import { SummaryPill } from "@/components/ui/summary-pill"
import { Switch } from "@/components/ui/switch"
import {
  DataTable,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { VoiceControl } from "@/components/ui/voice-control"
import { Wordmark } from "@/components/ui/wordmark"

import { AppHeader } from "@/ui/chrome/AppHeader"
import { PanelDialog } from "@/ui/chrome/PanelDialog"
import { StageBackground } from "@/ui/chrome/StageBackground"

/**
 * DesignGalleryPage — the visual check sheet for the ported design system.
 *
 * Route: `/design` (public, dev-facing). It renders every primitive built in
 * this workflow in all of its variants, sizes and states so a screen can be
 * compared against `design-system/` without opening a product flow.
 *
 * The page is a *specimen sheet*, not a product screen: it is the only surface
 * allowed to place many components of the same family next to each other. The
 * DS rules it deliberately breaks (one primary button per screen, one blob per
 * screen, one voice entry per screen) are broken on purpose and only here.
 *
 * Copy is the DS demo data, verbatim: band `Herzbuben`, `Stuttgart · bis 350 €`,
 * `Geteilter Raum · 4 Personen`, `Mittwochs, 19–22 Uhr`,
 * `Schlagzeug muss bleiben` (`design-system/readme.md` § Content fundamentals,
 * `design-system/ui_kits/roomscout-app/ScreensA.jsx`, `Settings.jsx`). Nothing
 * on this page is invented product copy.
 *
 * The stage itself is the `StageBackground` specimen — the DS has exactly one
 * continuous grain stage and it never repeats inside a screen, so it is shown
 * by *being* the page rather than as a swatch.
 */

/* -------------------------------------------------------------------------- */
/* Demo data                                                                  */
/* -------------------------------------------------------------------------- */

/** The Herzbuben search brief — `readme.md` § intro, `ScreensA.jsx` SCRIPT. */
const DEMO_FACTS: Fact[] = [
  { id: "ort", label: "Stuttgart" },
  { id: "budget", label: "Bis 350 € / Monat" },
  { id: "band", label: "Geteilter Raum · 4 Personen" },
  { id: "zeit", label: "Mittwochs, 19–22 Uhr" },
  { id: "equip", label: "Schlagzeug muss bleiben" },
]

/** Same brief with the budget row in its post-correction flash. */
const DEMO_FACTS_CHANGED: Fact[] = DEMO_FACTS.map((fact) =>
  fact.id === "budget" ? { ...fact, changed: true } : fact
)

/** Settings shell navigation — `Settings.jsx:251-252`. */
/** The ported surfaces, mounted as public demo routes in `src/app/router.tsx`. */
const DEMO_ROUTES = [
  { to: "/design/scout", label: "Scout" },
  { to: "/design/settings", label: "Einstellungen" },
  { to: "/design/operator", label: "Betreiberansicht" },
  { to: "/design/landing", label: "Startseite" },
] as const

const PANEL_GROUPS = [
  {
    id: "scout",
    label: "Dein Scout",
    items: [
      { id: "sources", label: "Quellen & Zugänge", icon: <Icon name="globe" size={20} /> },
      { id: "autonomy", label: "Handlungsspielraum", icon: <Icon name="sliders" size={20} /> },
      { id: "knowledge", label: "Was dein Scout weiß", icon: <Icon name="doc" size={20} /> },
    ],
  },
  {
    id: "account",
    label: "Dein Konto",
    items: [
      { id: "profile", label: "Profil", icon: <Icon name="user" size={20} /> },
      { id: "notifications", label: "Benachrichtigungen", icon: <Icon name="bell" size={20} /> },
      { id: "billing", label: "Tarif & Nutzung", icon: <Icon name="card" size={20} /> },
      { id: "privacy", label: "Datenschutz", icon: <Icon name="shield" size={20} /> },
    ],
  },
]

/** Operator task table — `Operator.jsx:57`, `DataTable.prompt.md`. */
const TABLE_COLUMNS = [
  { key: "name", label: "Vorgang", width: "1.3fr" },
  { key: "src", label: "Quelle", muted: true },
  { key: "status", label: "Status", width: "1.2fr" },
  { key: "next", label: "Nächster Schritt" },
]

const TABLE_ROWS = [
  {
    _key: "t1",
    name: "Neue Anzeigen prüfen",
    src: "roomscout.dev",
    status: <StatusDot tone="success">Erledigt</StatusDot>,
    next: "Kein Schritt offen",
  },
  {
    _key: "t2",
    name: "Portal-Nachrichten lesen",
    src: "roomscout.dev",
    status: <StatusDot tone="warning">Anmeldung abgelaufen</StatusDot>,
    next: "Zugang erneuern",
    _highlight: true,
  },
  {
    _key: "t3",
    name: "Anfrage vorbereiten",
    src: "roomscout.dev",
    status: <StatusDot pulse>Läuft</StatusDot>,
    next: "Anbieter anschreiben",
  },
]

const BUTTON_VARIANTS = ["primary", "secondary", "tint", "ghost", "link", "danger"] as const
const BUTTON_SIZES = ["lg", "md", "base", "sm", "xs", "2xs"] as const
const ICON_BUTTON_VARIANTS = ["outline", "subtle", "accent", "bare", "danger"] as const
const CARD_SIZES = ["sm", "md", "lg", "xl", "2xl"] as const
const CARD_TONES = ["default", "soft", "faint", "accent", "warning", "inset", "panel", "rust"] as const
const NOTICE_TONES = ["warning", "success", "neutral", "accent"] as const
const STATUS_TONES = ["accent", "success", "warning", "muted", "neutral", "idle", "past", "danger"] as const
const BLOB_SIZES = [168, 160, 96, 58, 44] as const
const BLOB_STATES: ScoutBlobState[] = ["idle", "speaking", "listening", "thinking", "still"]

/* -------------------------------------------------------------------------- */
/* Gallery scaffolding (local, deliberately plain)                            */
/* -------------------------------------------------------------------------- */

/** One labelled band of the sheet. The heading is an `Overline`, per the DS. */
function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-[var(--space-9)]">
      <div className="flex flex-col gap-[var(--space-2)]">
        <Overline tone="accent">{title}</Overline>
        {note ? (
          <p className="max-w-[var(--width-card-wide)] text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading)] text-rs-ink-5">
            {note}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-[var(--space-11)]">{children}</div>
    </section>
  )
}

/** One row inside a section: a quiet German caption plus its specimens. */
function Specimen({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      <div className="text-[length:var(--text-caption-sm-size)] text-rs-ink-6">{label}</div>
      <div className={cn("flex flex-wrap items-center gap-[var(--space-7)]", className)}>
        {children}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

function DesignGalleryPage() {
  const [switchOn, setSwitchOn] = React.useState(true)
  const [switchOff, setSwitchOff] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("Herzbuben")
  const [searchValue, setSearchValue] = React.useState("")
  const [textareaValue, setTextareaValue] = React.useState(
    "Wir sind zu viert und suchen einen geteilten Raum in Stuttgart."
  )
  const [perDay, setPerDay] = React.useState<number | string>(5)
  const [draft, setDraft] = React.useState("")
  const [mode, setMode] = React.useState("autopilot")
  const [micOn, setMicOn] = React.useState(true)
  const [pillOpen, setPillOpen] = React.useState(false)
  const [factDrafts, setFactDrafts] = React.useState<Record<string, string>>({})
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [panelPage, setPanelPage] = React.useState("sources")

  const panelLabel =
    PANEL_GROUPS.flatMap((group) => group.items).find((item) => item.id === panelPage)?.label ??
    "Quellen & Zugänge"

  return (
    <StageBackground position="fixed" contentClassName="overflow-hidden">
      <AppHeader
        className="shrink-0"
        right={
          <>
            <StatusDot pulse>Scout ist unterwegs</StatusDot>
            <IconButton label="Suche pausieren">
              <Icon name="pause" size={16} />
            </IconButton>
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        <div className="mx-auto flex w-full max-w-[var(--width-content)] flex-col gap-[var(--space-19)] px-[var(--space-16)] pt-[var(--space-11)] pb-[var(--space-19)]">
          {/* Ported surfaces ---------------------------------------------- */}
          <nav aria-label="Portierte Oberflächen" className="flex flex-wrap gap-[var(--space-4)]">
            {DEMO_ROUTES.map((route) => (
              <Button key={route.to} asChild variant="secondary" size="sm">
                <Link to={route.to}>{route.label}</Link>
              </Button>
            ))}
          </nav>

          {/* Sheet title ------------------------------------------------- */}
          <header className="flex flex-col gap-[var(--space-5)]">
            <Overline>Design-Galerie · Beispieldaten</Overline>
            <h1 className="max-w-[var(--width-card-wide)] text-[length:var(--text-page-title-size)] leading-[var(--text-headline-leading)] font-light tracking-[var(--text-display-tracking)]">
              Jeder Baustein, einmal in echt.
            </h1>
            <p className="max-w-[var(--width-card-wide)] text-[length:var(--text-body-size)] leading-[var(--text-body-leading)] text-rs-ink-4">
              Diese Seite ist die Prüffläche gegen das Design-System. Sie zeigt bewusst mehrere
              Varianten nebeneinander — im Produkt gilt weiterhin: ein Blob, eine primäre Aktion,
              ein Spracheinstieg pro Bildschirm.
            </p>
          </header>

          {/* Stage --------------------------------------------------------- */}
          <Section
            title="Bühne"
            note="Die Seite selbst ist das Muster: eine durchgehende dunkle Körnungsbühne, identisch auf jedem Bildschirm."
          >
            <Specimen label="StageBackground · Kopfzeile und Wortmarke">
              <Wordmark size="xl" />
              <Wordmark size="md" />
              <Wordmark size="default" />
              <Wordmark size="sm" />
              <Wordmark href="#top" size="sm" />
            </Specimen>
          </Section>

          {/* Buttons ------------------------------------------------------- */}
          <Section
            title="Schaltflächen"
            note="Eine orange Primäraktion pro Bildschirm, alles andere leiser."
          >
            {BUTTON_VARIANTS.map((variant) => (
              <Specimen key={variant} label={`Variante „${variant}“ · Größen lg → 2xs`}>
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    Mit Scout sprechen
                  </Button>
                ))}
              </Specimen>
            ))}
            <Specimen label="Mit Glyph">
              <Button size="lg" icon={<Icon name="mic" size={20} />}>
                Mit Scout sprechen
              </Button>
              <Button variant="ghost" icon={<Icon name="keyboard" size={20} />}>
                Lieber schreiben
              </Button>
              <Button variant="tint" size="sm">
                Ja, Mittwoch passt
              </Button>
              <Button variant="link">Noch etwas ändern</Button>
            </Specimen>
            <Specimen label="Icon-Größen · icon-lg, icon, icon-sm, icon-xs">
              <Button size="icon-lg" aria-label="Suche fortsetzen">
                <Icon name="play" />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Suche pausieren">
                <Icon name="pause" />
              </Button>
              <Button size="icon-sm" variant="tint" aria-label="Senden">
                <Icon name="send" />
              </Button>
              <Button size="icon-xs" variant="ghost" aria-label="Schließen">
                <Icon name="close" />
              </Button>
            </Specimen>
            <Specimen label="Zustände · deaktiviert und volle Breite" className="flex-col items-stretch">
              <div className="flex flex-wrap items-center gap-[var(--space-7)]">
                <Button disabled>Scout losschicken</Button>
                <Button variant="secondary" disabled>
                  Noch etwas ändern
                </Button>
                <Button variant="danger" disabled>
                  Gespräch beenden
                </Button>
              </div>
              <Button block size="md">
                Scout losschicken
              </Button>
            </Specimen>
          </Section>

          {/* Icon buttons -------------------------------------------------- */}
          <Section title="Icon-Schaltflächen" note="Runde Bedienelemente, 42px im Kopfbereich.">
            <Specimen label="Varianten">
              {ICON_BUTTON_VARIANTS.map((variant) => (
                <IconButton key={variant} variant={variant} label={`Variante ${variant}`}>
                  <Icon name="pause" size={16} />
                </IconButton>
              ))}
            </Specimen>
            <Specimen label="Größen · 46, 44, 42 (Standard), 40, 36">
              <IconButton variant="accent" size={46} label="Mit Scout sprechen">
                <Icon name="mic" size={18} />
              </IconButton>
              <IconButton variant="subtle" size={44} label="Senden">
                <Icon name="send" size={18} />
              </IconButton>
              <IconButton label="Suche pausieren">
                <Icon name="pause" size={16} />
              </IconButton>
              <IconButton variant="bare" size={40} label="Bearbeiten">
                <Icon name="edit" size={18} />
              </IconButton>
              <IconButton variant="bare" size={36} label="Suchauftrag bearbeiten">
                <Icon name="edit" size={16} />
              </IconButton>
            </Specimen>
            <Specimen label="Deaktiviert">
              <IconButton disabled label="Suche pausieren">
                <Icon name="pause" size={16} />
              </IconButton>
            </Specimen>
          </Section>

          {/* Icons --------------------------------------------------------- */}
          <Section
            title="Glyphen"
            note="Alle Glyphen aus dem Prototyp, 24×24, currentColor. Kein Icon-Font, kein CDN-Set."
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-[var(--space-5)]">
              {ICON_NAMES.map((name) => (
                <div
                  key={name}
                  className="flex flex-col items-center gap-[var(--space-3)] rounded-card border border-rs-border-card-soft bg-rs-surface-card-faint px-[var(--space-4)] py-[var(--space-7)] text-center"
                >
                  <Icon name={name} size={22} className="text-rs-ink-2" />
                  <span className="text-[length:var(--text-micro-size)] break-all text-rs-ink-6">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Overline / status dot / badge -------------------------------- */}
          <Section title="Auszeichnungen" note="Overline, Statuspunkt, Badge.">
            <Specimen label="Overline · muted, accent, accent wide">
              <Overline>Raum in Stuttgart-West</Overline>
              <Overline tone="accent">Angebot eingegangen</Overline>
              <Overline tone="accent" wide>
                So funktioniert RoomScout
              </Overline>
            </Specimen>
            <Specimen label="StatusDot · alle Tönungen">
              {STATUS_TONES.map((tone) => (
                <StatusDot key={tone} tone={tone}>
                  {tone}
                </StatusDot>
              ))}
            </Specimen>
            <Specimen label="StatusDot · pulsierend und ohne Text">
              <StatusDot pulse>Scout ist unterwegs</StatusDot>
              <StatusDot tone="success">Verbunden</StatusDot>
              <StatusDot tone="warning">Anmeldung nötig</StatusDot>
              <StatusDot tone="accent" size={10} aria-label="Aktiv" />
            </Specimen>
            <Specimen label="Badge · solid, outline, muted, pill">
              <Badge>Mein Vorschlag</Badge>
              <Badge variant="outline">Intern</Badge>
              <Badge variant="muted">In dieser Demo nicht aktiv</Badge>
              <Badge variant="pill">Euer persönlicher Proberaum-Scout</Badge>
            </Specimen>
          </Section>

          {/* Avatar / separator / skeleton -------------------------------- */}
          <Section title="Profil, Trenner, Platzhalter">
            <Specimen label="Avatar · lg, default, sm — Varianten default, source, provider">
              <Avatar size="lg">
                <AvatarFallback>HB</AvatarFallback>
              </Avatar>
              <Avatar label="Profilmenü">
                <AvatarFallback>HB</AvatarFallback>
              </Avatar>
              <Avatar size="sm">
                <AvatarFallback>HB</AvatarFallback>
              </Avatar>
              <Avatar variant="source" label="roomscout.dev">
                <AvatarFallback>RS</AvatarFallback>
              </Avatar>
              <Avatar variant="provider" label="Anbieter">
                <AvatarFallback>AN</AvatarFallback>
              </Avatar>
              <Avatar interactive label="Profilmenü">
                <AvatarFallback>HB</AvatarFallback>
              </Avatar>
            </Specimen>
            <Specimen label="Separator · default, soft, panel, control" className="flex-col items-stretch">
              <Separator />
              <Separator tone="soft" />
              <Separator tone="panel" />
              <Separator tone="control" />
              <div className="flex h-[var(--space-15)] items-center gap-[var(--space-7)]">
                <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">Stuttgart</span>
                <Separator orientation="vertical" />
                <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">bis 350 €</span>
              </div>
            </Specimen>
            <Specimen label="Skeleton · default, bar, circle" className="flex-col items-stretch">
              <Skeleton className="h-[var(--space-15)] w-[var(--width-card-narrow)]" label="Lädt" />
              <Skeleton variant="bar" className="w-[var(--width-card-narrow)]" />
              <Skeleton variant="circle" />
              <Skeleton className="h-[var(--space-15)] w-[var(--width-card-narrow)]" pulse={false} />
            </Specimen>
          </Section>

          {/* Cards --------------------------------------------------------- */}
          <Section
            title="Karten"
            note="Dunkel-transluzent, warme Haarlinie, kein Blur und kein Leuchten."
          >
            <Specimen label="Größen · sm, md, lg, xl, 2xl" className="items-stretch">
              {CARD_SIZES.map((size) => (
                <Card key={size} size={size} className="min-w-[var(--width-card-narrow)] flex-1">
                  <Overline>Raum in Stuttgart-West</Overline>
                  <div className="mt-[var(--space-4)] text-[length:var(--text-body-size)]">
                    280 € / Monat
                  </div>
                  <div className="mt-[var(--space-2)] text-[length:var(--text-caption-size)] text-rs-ink-6">
                    size={size}
                  </div>
                </Card>
              ))}
            </Specimen>
            <Specimen label="Tönungen" className="items-stretch">
              {CARD_TONES.map((tone) => (
                <Card key={tone} tone={tone} className="min-w-[var(--width-card-narrow)] flex-1">
                  <div className="text-[length:var(--text-body-size)]">
                    Verbindliche Entscheidungen bleiben bei dir.
                  </div>
                  <div className="mt-[var(--space-2)] text-[length:var(--text-caption-size)] text-rs-ink-6">
                    tone={tone}
                  </div>
                </Card>
              ))}
            </Specimen>
            <Specimen label="Hover-Lift">
              <Card hoverLift className="min-w-[var(--width-card-narrow)]">
                <div className="text-[length:var(--text-body-size)]">Geteilter Raum · 4 Personen</div>
              </Card>
            </Specimen>
          </Section>

          {/* Capsule / summary pill / hint / notice ----------------------- */}
          <Section title="Rückmeldungen">
            <Specimen label="Capsule · md und sm">
              <Capsule>Stuttgart</Capsule>
              <Capsule size="sm">Mittwochs, 19–22 Uhr</Capsule>
            </Specimen>
            <Specimen label="SummaryPill · lg, md, sm — mit Chevron und aufklappbar">
              <SummaryPill
                size="lg"
                icon={<Icon name="search" size={18} />}
                chevron
                open={pillOpen}
                onClick={() => setPillOpen((open) => !open)}
              >
                Stuttgart · bis 350 €
              </SummaryPill>
              <SummaryPill>5 Wünsche gemerkt</SummaryPill>
              <SummaryPill size="sm">Geteilter Raum · 4 Personen</SummaryPill>
            </Specimen>
            <Specimen label="Hint">
              <Hint>Im Prototyp sind vorbereitete Antworten hinterlegt.</Hint>
            </Specimen>
            <Specimen label="Notice · warning, success, neutral, accent" className="flex-col items-stretch">
              {NOTICE_TONES.map((tone) => (
                <Notice key={tone} tone={tone}>
                  Nach deiner Änderung muss das Angebot erneut geprüft werden.
                </Notice>
              ))}
              <Notice
                tone="accent"
                action={
                  <Button variant="link" size="2xs">
                    Handlungsspielraum ändern
                  </Button>
                }
              >
                Anschreiben ist in deinem Handlungsspielraum deaktiviert.
              </Notice>
            </Specimen>
            <Specimen label="Toast · sonner">
              <Button
                variant="secondary"
                onClick={() =>
                  showToast("Dein Scout wartet auf deine Freigabe", {
                    onAction: () => undefined,
                  })
                }
              >
                Hinweis einblenden
              </Button>
              <Button variant="ghost" onClick={() => showToast("Handlungsspielraum aktualisiert")}>
                Kurzer Hinweis
              </Button>
            </Specimen>
          </Section>

          {/* Chat ---------------------------------------------------------- */}
          <Section
            title="Gespräch"
            note="Im Hauptfluss hat die Scout-Antwort keine Blase; nur die Mitschrift rahmt beide Seiten."
          >
            <Specimen label="ChatBubble · Scout und Du, Größen lg/md/sm" className="flex-col items-stretch">
              <div className="flex w-full max-w-[var(--width-card)] flex-col gap-[var(--space-5)]">
                <ChatBubble who="scout">
                  Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?
                </ChatBubble>
                <ChatBubble who="user">Ja, Mittwoch passt auch.</ChatBubble>
                <ChatBubble who="scout" size="md">
                  Alles klar, Mittwoch geht also auch. Ich kläre den Rest.
                </ChatBubble>
                <ChatBubble who="user" size="md">
                  Nein, Donnerstag ist wichtig.
                </ChatBubble>
              </div>
            </Specimen>
            <Specimen label="ChatBubble · compact (Mitschrift)" className="flex-col items-stretch">
              <div className="flex w-full max-w-[var(--width-card-narrow)] flex-col gap-[var(--space-4)]">
                <ChatBubble who="scout" compact>
                  Welche Tage passen euch zum Proben?
                </ChatBubble>
                <ChatBubble who="user" compact>
                  Mittwochs, 19–22 Uhr.
                </ChatBubble>
              </div>
            </Specimen>
          </Section>

          {/* Scout blob ---------------------------------------------------- */}
          <Section
            title="Scout-Blob"
            note="Frei auf der Bühne, nie in einer Karte. Er schrumpft, je wichtiger die Entscheidung wird: 168 → 160 → 96 → 58 → 44."
          >
            <Specimen label="Größen · idle" className="items-end">
              {BLOB_SIZES.map((size) => (
                <div key={size} className="flex flex-col items-center gap-[var(--space-4)]">
                  <ScoutBlob size={size} />
                  <span className="text-[length:var(--text-micro-size)] text-rs-ink-6">{size}</span>
                </div>
              ))}
            </Specimen>
            <Specimen label="Zustände · idle, speaking, listening, thinking, still" className="items-end">
              {BLOB_STATES.map((state) => (
                <div key={state} className="flex flex-col items-center gap-[var(--space-4)]">
                  <ScoutBlob size={96} state={state} />
                  <span className="text-[length:var(--text-micro-size)] text-rs-ink-6">{state}</span>
                </div>
              ))}
            </Specimen>
            <Specimen label="Ohne Leuchten" className="items-end">
              <ScoutBlob size={58} glow={false} />
              <ScoutBlob size={44} glow={false} />
            </Specimen>
          </Section>

          {/* Voice --------------------------------------------------------- */}
          <Section
            title="Sprachsteuerung"
            note="Mikro an/aus · Mitschrift · Gespräch beenden. 76px auf dem Desktop, 60px schmal."
          >
            <Specimen label="Zustände · wide (76px)" className="gap-[var(--space-15)]">
              <VoiceControl
                tone="accent"
                size={76}
                active={micOn}
                label={micOn ? "Mikro an" : "Mikro aus"}
                onClick={() => setMicOn((on) => !on)}
              >
                <Icon name={micOn ? "mic" : "mic-off"} size={26} />
              </VoiceControl>
              <VoiceControl size={76} label="Mitschrift">
                <Icon name="transcript" size={24} />
              </VoiceControl>
              <VoiceControl size={76} tone="danger" label="Gespräch beenden">
                <Icon name="close" size={24} />
              </VoiceControl>
            </Specimen>
            <Specimen label="Zustände · narrow (60px)" className="gap-[var(--space-15)]">
              <VoiceControl tone="accent" density="narrow" active label="Mikro an">
                <Icon name="mic" size={22} />
              </VoiceControl>
              <VoiceControl tone="accent" density="narrow" active={false} label="Mikro aus">
                <Icon name="mic-off" size={22} />
              </VoiceControl>
              <VoiceControl density="narrow" label="Mitschrift">
                <Icon name="transcript" size={20} />
              </VoiceControl>
              <VoiceControl density="narrow" tone="danger" label="Gespräch beenden">
                <Icon name="close" size={20} />
              </VoiceControl>
              <VoiceControl density="narrow" disabled label="Deaktiviert">
                <Icon name="mic-off" size={20} />
              </VoiceControl>
            </Specimen>
          </Section>

          {/* Forms --------------------------------------------------------- */}
          <Section title="Eingaben">
            <Specimen label="Input · default, lg, inline" className="flex-col items-stretch">
              <div className="max-w-[var(--width-card-narrow)]">
                <Input
                  label="Quelle oder Region suchen"
                  placeholder="Quelle oder Region suchen …"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
              </div>
              <div className="max-w-[var(--width-card-narrow)]">
                <Input
                  variant="lg"
                  label="Anzeigename"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                />
              </div>
              <div className="max-w-[var(--width-card-narrow)]">
                <Input variant="inline" label="Angabe bearbeiten" defaultValue="Bis 350 € / Monat" />
              </div>
              <div className="max-w-[var(--width-card-narrow)]">
                <Input
                  label="Neue Anbieter pro Tag"
                  defaultValue="0"
                  invalid
                  helper="Bitte eine ganze Zahl größer als 0 eingeben."
                />
              </div>
              <div className="max-w-[var(--width-card-narrow)]">
                <Input label="Deaktiviert" defaultValue="Stuttgart" disabled />
              </div>
            </Specimen>
            <Specimen label="Textarea · default, subtle, ghost" className="flex-col items-stretch">
              <div className="max-w-[var(--width-card)]">
                <Textarea
                  label="Nachricht an den Anbieter"
                  rows={3}
                  value={textareaValue}
                  onChange={(event) => setTextareaValue(event.target.value)}
                />
              </div>
              <div className="max-w-[var(--width-card)]">
                <Textarea
                  variant="subtle"
                  label="Vorbereitete Anfrage"
                  rows={3}
                  readOnly
                  value="Guten Tag, wir sind zu viert und suchen einen geteilten Proberaum in Stuttgart. Unser Schlagzeug müsste im Raum bleiben können."
                />
              </div>
              <div className="max-w-[var(--width-card)]">
                <Textarea variant="ghost" label="Notiz" rows={2} placeholder="Möchtest du mir noch etwas sagen?" />
              </div>
            </Specimen>
            <Specimen label="Switch · an, aus, deaktiviert">
              <div className="flex items-center gap-[var(--space-5)]">
                <Switch
                  checked={switchOn}
                  onCheckedChange={setSwitchOn}
                  label="Anbieter kontaktieren"
                />
                <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">
                  Anbieter kontaktieren
                </span>
              </div>
              <div className="flex items-center gap-[var(--space-5)]">
                <Switch
                  checked={switchOff}
                  onCheckedChange={setSwitchOff}
                  label="Öffentliche Quellensuche"
                />
                <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">
                  Öffentliche Quellensuche
                </span>
              </div>
              <div className="flex items-center gap-[var(--space-5)]">
                <Switch checked disabled label="Demo-Zugang (gesperrt)" />
                <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">
                  Demo-Zugang (gesperrt)
                </span>
              </div>
            </Specimen>
            <Specimen label="Stepper">
              <Stepper value={perDay} onChange={setPerDay} label="Neue Anbieter pro Tag" />
              <Stepper value={5} label="Deaktiviert" disabled />
            </Specimen>
            <Specimen label="RadioCard · Arbeitsmodus" className="items-stretch">
              <RadioCardGroup aria-label="Arbeitsmodus" className="w-full">
                <RadioCard
                  checked={mode === "autopilot"}
                  onSelect={() => setMode("autopilot")}
                  title="Autopilot"
                  description="Suchen, anfragen und Details klären."
                />
                <RadioCard
                  checked={mode === "review"}
                  onSelect={() => setMode("review")}
                  title="Mit Rücksprache"
                  description="Nachrichten vor dem Versand prüfen."
                />
              </RadioCardGroup>
            </Specimen>
            <Specimen label="Composer" className="flex-col items-stretch">
              <div className="max-w-[var(--width-card)]">
                <Composer
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => setDraft("")}
                  onVoice={() => undefined}
                  placeholder="Möchtest du mir noch etwas sagen?"
                />
              </div>
              <div className="max-w-[var(--width-card)]">
                <Composer
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => setDraft("")}
                  divider
                  placeholder="Antwort an deinen Scout …"
                />
              </div>
            </Specimen>
          </Section>

          {/* Fact list ----------------------------------------------------- */}
          <Section
            title="Suchauftrag"
            note="Dieselbe Liste wandelt sich von der schwebenden Fassung zur zentralen Karte. Eine korrigierte Angabe bleibt an ihrem Platz und blitzt orange auf."
          >
            <Specimen label="Varianten · floating und compact (rechts mit korrigierter Angabe)" className="items-start">
              <FactList facts={DEMO_FACTS} />
              <FactList variant="compact" facts={DEMO_FACTS_CHANGED} />
            </Specimen>
            <Specimen label="Variante card · mit Bearbeiten-Aktion" className="items-start">
              <FactList variant="card" facts={DEMO_FACTS} onEdit={() => undefined}>
                <Button size="md" block className="mt-[var(--space-8)]">
                  Scout losschicken
                </Button>
              </FactList>
            </Specimen>
            <Specimen label="Variante card · im Bearbeitungsmodus" className="items-start">
              <FactList
                variant="card"
                facts={DEMO_FACTS}
                editing
                drafts={factDrafts}
                onDraftChange={(id, value) =>
                  setFactDrafts((drafts) => ({ ...drafts, [id]: value }))
                }
              />
            </Specimen>
          </Section>

          {/* Tabs / accordion --------------------------------------------- */}
          <Section title="Gliederung">
            <Specimen label="Tabs · Was dein Scout weiß" className="flex-col items-stretch">
              <Tabs defaultValue="band" className="w-full max-w-[var(--width-card-wide)]">
                <TabsList>
                  <TabsTrigger value="band">Eure Band</TabsTrigger>
                  <TabsTrigger value="alltag">Alltag &amp; Wege</TabsTrigger>
                  <TabsTrigger value="ausstattung">Ausstattung</TabsTrigger>
                </TabsList>
                <TabsContent value="band" className="pt-[var(--space-9)]">
                  <Overline>Eure Band</Overline>
                  <p className="mt-[var(--space-5)] text-[length:var(--text-body-size)] text-rs-ink-2">
                    Geteilter Raum · 4 Personen
                  </p>
                </TabsContent>
                <TabsContent value="alltag" className="pt-[var(--space-9)]">
                  <Overline>Alltag &amp; Wege</Overline>
                  <p className="mt-[var(--space-5)] text-[length:var(--text-body-size)] text-rs-ink-2">
                    Mittwochs, 19–22 Uhr
                  </p>
                </TabsContent>
                <TabsContent value="ausstattung" className="pt-[var(--space-9)]">
                  <Overline>Ausstattung</Overline>
                  <p className="mt-[var(--space-5)] text-[length:var(--text-body-size)] text-rs-ink-2">
                    Schlagzeug muss bleiben
                  </p>
                </TabsContent>
              </Tabs>
            </Specimen>
            <Specimen label="Tabs · Varianten line und default" className="flex-col items-stretch">
              <Tabs defaultValue="band" variant="line" className="w-full max-w-[var(--width-card-wide)]">
                <TabsList>
                  <TabsTrigger value="band">Eure Band</TabsTrigger>
                  <TabsTrigger value="alltag">Alltag &amp; Wege</TabsTrigger>
                  <TabsTrigger value="ausstattung">Ausstattung</TabsTrigger>
                </TabsList>
                <TabsContent value="band" className="pt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
                  Variante „line“.
                </TabsContent>
                <TabsContent value="alltag" className="pt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
                  Mittwochs, 19–22 Uhr
                </TabsContent>
                <TabsContent value="ausstattung" className="pt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
                  Schlagzeug muss bleiben
                </TabsContent>
              </Tabs>
              <Tabs defaultValue="band" variant="default" className="w-full max-w-[var(--width-card-wide)]">
                <TabsList>
                  <TabsTrigger value="band">Eure Band</TabsTrigger>
                  <TabsTrigger value="alltag">Alltag &amp; Wege</TabsTrigger>
                  <TabsTrigger value="ausstattung">Ausstattung</TabsTrigger>
                </TabsList>
                <TabsContent value="band" className="pt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
                  Variante „default“.
                </TabsContent>
                <TabsContent value="alltag" className="pt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
                  Mittwochs, 19–22 Uhr
                </TabsContent>
                <TabsContent value="ausstattung" className="pt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
                  Schlagzeug muss bleiben
                </TabsContent>
              </Tabs>
            </Specimen>
            <Specimen label="Accordion · Variante faq" className="flex-col items-stretch">
              <Accordion
                type="single"
                collapsible
                variant="faq"
                className="w-full max-w-[var(--width-card-wide)]"
              >
                <AccordionItem value="q1">
                  <AccordionTrigger>Was darf der Scout selbstständig tun?</AccordionTrigger>
                  <AccordionContent>
                    Er recherchiert und fragt unverbindlich an. Eine verbindliche Zusage gibst nur du.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q2">
                  <AccordionTrigger>Wird in dieser Demo etwas versendet?</AccordionTrigger>
                  <AccordionContent>In dieser Demo wird nichts versendet.</AccordionContent>
                </AccordionItem>
              </Accordion>
            </Specimen>
            <Specimen label="Accordion · Variante integration" className="flex-col items-stretch">
              <Accordion
                type="single"
                collapsible
                variant="integration"
                className="w-full max-w-[var(--width-card-wide)]"
              >
                <AccordionItem value="firecrawl">
                  <AccordionTrigger>
                    <span>Firecrawl</span>
                    <span className="text-rs-ink-4">Quellen beobachten</span>
                    <StatusDot tone="muted">Konfiguriert</StatusDot>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div>
                      <span className="text-rs-ink-6">Konfiguration: </span>Konfiguriert
                    </div>
                    <div>
                      <span className="text-rs-ink-6">Letzter Demo-Test: </span>Noch kein Demo-Test
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Specimen>
            <Specimen label="Accordion · Variante source" className="flex-col items-stretch">
              <Accordion
                type="single"
                collapsible
                variant="source"
                className="w-full max-w-[var(--width-card-wide)]"
              >
                <AccordionItem value="roomscout">
                  <div className="flex items-center justify-between gap-[var(--space-7)] px-[var(--space-7)] py-[var(--space-6)]">
                    <div className="min-w-0">
                      <div className="text-[length:var(--text-body-size)]">
                        Portalprofil: Herzbuben
                      </div>
                      <div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-6">
                        Anzeigen lesen und Nachrichten austauschen
                      </div>
                    </div>
                    <AccordionTrigger heading={false} aria-label="Quelle aufklappen" />
                  </div>
                  <AccordionContent>
                    <div>
                      <span className="text-rs-ink-6">Letzter Demo-Check: </span>Heute · Demo-Lauf
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Specimen>
            <Specimen label="Accordion · Variante default" className="flex-col items-stretch">
              <Accordion
                type="single"
                collapsible
                variant="default"
                className="w-full max-w-[var(--width-card-wide)]"
              >
                <AccordionItem value="a">
                  <AccordionTrigger>Stuttgart · bis 350 €</AccordionTrigger>
                  <AccordionContent>Geteilter Raum · 4 Personen</AccordionContent>
                </AccordionItem>
              </Accordion>
            </Specimen>
          </Section>

          {/* Navigation ---------------------------------------------------- */}
          <Section title="Navigation">
            <Specimen label="Breadcrumb" className="flex-col items-stretch">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>Einstellungen</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#top">Dein Scout</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Quellen &amp; Zugänge</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <Breadcrumb>
                <BreadcrumbList size="sm">
                  <BreadcrumbItem>Betreiberansicht</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Aufträge</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </Specimen>
            <Specimen label="Profilmenü · Dropdown">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar asChild interactive>
                    <button type="button" aria-label="Profilmenü">
                      <AvatarFallback>HB</AvatarFallback>
                    </button>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel description="Persönlicher Bereich">Herzbuben</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Icon name="sliders" size={17} />
                    Einstellungen
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Icon name="arrow-left" size={17} />
                    Zurück zum Scout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">
                Avatar antippen
              </span>
            </Specimen>
            <Specimen label="Tooltip">
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconButton label="Suche pausieren">
                    <Icon name="pause" size={16} />
                  </IconButton>
                </TooltipTrigger>
                <TooltipContent>Suche pausieren</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Mit Pfeil
                  </Button>
                </TooltipTrigger>
                <TooltipContent showArrow side="bottom">
                  In dieser Demo wird nichts versendet.
                </TooltipContent>
              </Tooltip>
            </Specimen>
          </Section>

          {/* Overlays ------------------------------------------------------ */}
          <Section title="Überlagerungen">
            <Specimen label="Dialog · sm (Bestätigung) und md (Standard)">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Bestätigung öffnen</Button>
                </DialogTrigger>
                <DialogContent tone="dialog" size="sm">
                  <DialogHeader>
                    <DialogTitle>Änderungen verwerfen?</DialogTitle>
                    <DialogDescription>
                      Deine Änderungen am Handlungsspielraum sind noch nicht gespeichert.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="secondary" size="sm">
                        Weiter bearbeiten
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="danger" size="sm">
                        Verwerfen
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Standarddialog öffnen</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Gespeicherte Angaben ansehen</DialogTitle>
                    <DialogDescription>
                      Korrigiere mich jederzeit. Ihr bestimmt, was ich mir merke.
                    </DialogDescription>
                  </DialogHeader>
                  <FactList variant="compact" facts={DEMO_FACTS} />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button size="sm">Schließen</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Specimen>
            <Specimen label="Sheet · unten (Suchauftrag als mobile Schublade)">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary">Suchauftrag einblenden</Button>
                </SheetTrigger>
                <SheetContent side="bottom" showCloseButton>
                  <SheetHeader>
                    <SheetTitle>Euer Suchauftrag</SheetTitle>
                  </SheetHeader>
                  <SheetBody>
                    <FactList variant="compact" facts={DEMO_FACTS} className="w-full" />
                  </SheetBody>
                  <SheetFooter>
                    <Button size="md" block>
                      Scout losschicken
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost">Als Pille</Button>
                </SheetTrigger>
                <SheetContent side="bottom" variant="pill">
                  <SheetHeader>
                    <SheetTitle>Stuttgart · bis 350 €</SheetTitle>
                  </SheetHeader>
                  <SheetBody>
                    <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">
                      Geteilter Raum · 4 Personen
                    </span>
                  </SheetBody>
                </SheetContent>
              </Sheet>
            </Specimen>
            <Specimen label="PanelDialog · Sidebar im Panel (Einstellungen)">
              <Button variant="secondary" onClick={() => setPanelOpen(true)}>
                Einstellungen öffnen
              </Button>
              <PanelDialog
                open={panelOpen}
                onOpenChange={setPanelOpen}
                title="Einstellungen"
                description="Quellen, Handlungsspielraum und Konto."
                rootLabel="Einstellungen"
                navLabel="Bereiche"
                groups={PANEL_GROUPS}
                currentId={panelPage}
                onSelect={setPanelPage}
                back={{ label: "Zurück zum Scout", onSelect: () => setPanelOpen(false) }}
                footer={
                  <div className="px-[var(--space-4)]">
                    <div className="text-[length:var(--text-body-sm-size)] font-medium">Herzbuben</div>
                    <div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-6">
                      Persönlicher Bereich
                    </div>
                  </div>
                }
              >
                <h2 className="text-[length:var(--text-headline-size)] leading-[var(--text-headline-leading)] font-light tracking-[var(--text-display-tracking)]">
                  {panelLabel}
                </h2>
                <p className="mt-[var(--space-5)] max-w-[var(--width-card-wide)] text-[length:var(--text-body-size)] leading-[var(--text-body-leading)] text-rs-ink-4">
                  Die Bereiche wechseln über die Seitenleiste. Der Inhalt ist hier nur
                  Beispieldaten.
                </p>
                <div className="mt-[var(--space-11)]">
                  <FactList variant="compact" facts={DEMO_FACTS} />
                </div>
              </PanelDialog>
            </Specimen>
          </Section>

          {/* Tables -------------------------------------------------------- */}
          <Section
            title="Tabellen"
            note="Nur in der Betreiberansicht — nie im Fluss der Band."
          >
            <Specimen label="DataTable · Aufträge" className="flex-col items-stretch">
              <DataTable
                columns={TABLE_COLUMNS}
                rows={TABLE_ROWS}
                caption="Vorgänge des laufenden Demo-Auftrags."
                aria-label="Aufträge"
              />
            </Specimen>
            <Specimen label="DataTable · leer" className="flex-col items-stretch">
              <DataTable
                columns={TABLE_COLUMNS}
                rows={[]}
                empty="Keine Aufgabe braucht Aufmerksamkeit."
                aria-label="Aufträge, leer"
              />
            </Specimen>
            <Specimen label="Table · Grundbausteine" className="flex-col items-stretch">
              <Table>
                <TableCaption>Angebundene Quellen im Demo-Lauf.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Zustand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>roomscout.dev</TableCell>
                    <TableCell muted>Anzeigen lesen</TableCell>
                    <TableCell>
                      <StatusDot tone="success">Verbunden</StatusDot>
                    </TableCell>
                  </TableRow>
                  <TableRow highlight>
                    <TableCell>Bandnet</TableCell>
                    <TableCell muted>Nachrichten austauschen</TableCell>
                    <TableCell>
                      <StatusDot tone="warning">Anmeldung abgelaufen</StatusDot>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Specimen>
          </Section>

          <footer className="pt-[var(--space-11)] text-center text-[length:var(--text-caption-size)] text-rs-ink-6">
            Designprototyp · Beispieldaten
          </footer>
        </div>
      </main>
    </StageBackground>
  )
}

export { DesignGalleryPage }
