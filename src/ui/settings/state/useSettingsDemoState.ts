/**
 * Settings surface — LOCAL DEMO STATE. **Demo data only.**
 *
 * Every value in this file is the design prototype's sample data, kept in React
 * state so the ported screens behave exactly like the kit without a backend.
 * Nothing here talks to Convex; the Integrate step swaps this hook for the real
 * bindings (`docs/UI_PORT/DATA_BINDING_PLAN.md` §5).
 *
 * Source of truth for the shape and the mutations:
 * - `design-system/ui_kits/roomscout-app/App.jsx` — `SOURCES0`, `RULES0`,
 *   `KNOW0`, `FACT_CAT`, `settingsData` / `settingsActions`, `logChange`.
 * - `design-system/ui_kits/roomscout-app/Settings.jsx` — the consumers.
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §0–§7 (the state contract) and
 *   `docs/UI_PORT/DECISIONS.md` items 36–40 (the settled deltas applied here).
 *
 * Copy never lives in this file: an item stores the dictionary **key** of its
 * default text and only carries a literal `text` once the user has edited it,
 * so a locale switch still re-renders German/English correctly.
 */

import * as React from "react"

import type { StepperValue } from "@/components/ui/stepper"
import { formatTime, useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** The seven pages of the settings panel, in nav order. */
export type SettingsPageId =
  | "sources"
  | "autonomy"
  | "knowledge"
  | "profile"
  | "notifications"
  | "billing"
  | "privacy"

export type SourceId = "roomscout" | "musiker" | "bandnet"

/** `connected` / `expired` only ever occur on a `portal`; `public` on the rest. */
export type SourceAccess = "connected" | "expired" | "disconnected" | "public"

export interface DemoSource {
  id: SourceId
  kind: "portal" | "public"
  /** Included in this search (the two-state switch of DECISIONS item 40). */
  enabled: boolean
  access: SourceAccess
  /** „Letzter erfolgreicher Zugriff“; `null` renders the dictionary fallback. */
  lastAccess: string | null
  nameKey: StringCopyKey
  descKey: StringCopyKey
}

export type AutonomyMode = "autopilot" | "review"

export interface AutonomyRules {
  mode: AutonomyMode
  contact: boolean
  viewings: boolean
  publishAd: boolean
  shareProfile: boolean
  sharePrivate: boolean
  /** Raw stepper value — a half-typed string reaches the save bar's validation. */
  perDay: StepperValue
}

/** The three knowledge tabs of §7.3. */
export type KnowledgeCategory = "band" | "alltag" | "ausstattung"

export type KnowledgeStatus = "confirmed" | "assumed" | "retired"

/** Facts that are part of the Suchauftrag — DECISIONS item 39: never retired. */
export type FactId = "ort" | "budget" | "band" | "zeit" | "equip"

export interface KnowledgeItem {
  id: string
  cat: KnowledgeCategory
  status: KnowledgeStatus
  /** Set on rows that mirror the search order; those cannot be retired. */
  factId?: FactId
  /** Dictionary key of the default text. */
  textKey?: StringCopyKey
  /** User-entered text; wins over `textKey` once the row has been edited. */
  text?: string
  originKey: StringCopyKey
}

export interface KnowledgeLogEntry {
  id: string
  key: StringCopyKey
  /** `{text}` of the log line, already resolved. */
  text?: string
  /** `{n}` of the import line. */
  n?: number
  when: string
}

export interface NotificationPrefs {
  decision: boolean
  offer: boolean
  digest: boolean
  channel: "app" | "mail"
}

export interface SettingsFlags {
  voice: boolean
  /** Public sources only count as usable while this is on (§4.5). */
  publicSearch: boolean
}

export interface SettingsUsage {
  searches: number
  contacted: number
}

export interface SettingsData {
  name: string
  sources: DemoSource[]
  autoSources: boolean
  rules: AutonomyRules
  flags: SettingsFlags
  knowledge: KnowledgeItem[]
  knowledgeLog: KnowledgeLogEntry[]
  notif: NotificationPrefs
  /** False renders §4.2's "Lege zuerst einen Suchauftrag an." card instead. */
  hasOrder: boolean
  usage: SettingsUsage
}

export interface SettingsActions {
  setName: (name: string) => void
  toggleSource: (id: SourceId) => void
  setAutoSources: (on: boolean) => void
  setAccess: (id: SourceId, access: SourceAccess) => void
  saveRules: (rules: AutonomyRules) => void
  setNotif: (next: NotificationPrefs) => void
  setHasOrder: (has: boolean) => void
  /** Inline edit of a row's text (`knowledge.log.entry.corrected`). */
  updateKnowledge: (id: string, text: string) => void
  /** „Stimmt“ on an assumed row (`…entry.confirmed`). */
  confirmKnowledge: (id: string) => void
  /** „Nicht wichtig“ on an assumed row (`…entry.dismissed`). */
  dismissKnowledge: (id: string) => void
  /** Kebab › „Nicht mehr verwenden“ (`…entry.retired`). */
  retireKnowledge: (id: string) => void
  /** The undo bar (`…entry.undo`). */
  restoreKnowledge: (id: string) => void
  addKnowledge: (items: KnowledgeItem[]) => void
}

/** What every page receives from `SettingsPanel`. */
export interface SettingsPageContext {
  data: SettingsData
  actions: SettingsActions
  /** Cross-page link; runs through the unsaved-changes gate. */
  navigate: (page: SettingsPageId) => void
  /** „Zum Scout“ / „Suchauftrag bearbeiten“; runs through the same gate. */
  back: () => void
  /** The panel's single toast slot (2400 ms, §14). */
  toast: (message: string) => void
}

/* -------------------------------------------------------------------------- */
/* Demo data — App.jsx `SOURCES0` / `RULES0` / `KNOW0` / `FACT_CAT`            */
/* -------------------------------------------------------------------------- */

const DEMO_SOURCES: readonly DemoSource[] = [
  {
    id: "roomscout",
    kind: "portal",
    enabled: true,
    access: "connected",
    lastAccess: null,
    nameKey: "settings.sources.demo.roomscout.name",
    descKey: "settings.sources.demo.roomscout.desc",
  },
  {
    id: "musiker",
    kind: "public",
    enabled: true,
    access: "public",
    lastAccess: null,
    nameKey: "settings.sources.demo.musiker.name",
    descKey: "settings.sources.demo.musiker.desc",
  },
  {
    id: "bandnet",
    kind: "public",
    enabled: false,
    access: "public",
    lastAccess: null,
    nameKey: "settings.sources.demo.bandnet.name",
    descKey: "settings.sources.demo.bandnet.desc",
  },
]

const DEMO_RULES: AutonomyRules = {
  mode: "autopilot",
  contact: true,
  viewings: true,
  publishAd: false,
  shareProfile: true,
  sharePrivate: false,
  perDay: 5,
}

/**
 * The eight rows of §7: the five facts of the search order (`FACT_CAT` decides
 * the tab) followed by `KNOW0`. `privacy.stored.sub` counts exactly these.
 */
const DEMO_KNOWLEDGE: readonly KnowledgeItem[] = [
  {
    id: "f_ort",
    cat: "alltag",
    status: "confirmed",
    factId: "ort",
    textKey: "settings.knowledge.demo.f_ort.text",
    originKey: "settings.knowledge.demo.origin.fact",
  },
  {
    id: "f_budget",
    cat: "band",
    status: "confirmed",
    factId: "budget",
    textKey: "settings.knowledge.demo.f_budget.text",
    originKey: "settings.knowledge.demo.origin.fact",
  },
  {
    id: "f_band",
    cat: "band",
    status: "confirmed",
    factId: "band",
    textKey: "settings.knowledge.demo.f_band.text",
    originKey: "settings.knowledge.demo.origin.fact",
  },
  {
    id: "f_zeit",
    cat: "alltag",
    status: "confirmed",
    factId: "zeit",
    textKey: "settings.knowledge.demo.f_zeit.text",
    originKey: "settings.knowledge.demo.origin.fact",
  },
  {
    id: "f_equip",
    cat: "ausstattung",
    status: "confirmed",
    factId: "equip",
    textKey: "settings.knowledge.demo.f_equip.text",
    originKey: "settings.knowledge.demo.origin.fact",
  },
  {
    id: "k_genre",
    cat: "band",
    status: "confirmed",
    textKey: "settings.knowledge.demo.k_genre.text",
    originKey: "settings.knowledge.demo.origin.bandprofile",
  },
  {
    id: "k_mates",
    cat: "band",
    status: "assumed",
    textKey: "settings.knowledge.demo.k_mates.text",
    originKey: "settings.knowledge.demo.origin.assumption",
  },
  {
    id: "k_amps",
    cat: "ausstattung",
    status: "confirmed",
    textKey: "settings.knowledge.demo.k_amps.text",
    originKey: "settings.knowledge.demo.origin.conversation",
  },
]

const DEMO_NOTIF: NotificationPrefs = {
  decision: true,
  offer: true,
  digest: false,
  channel: "app",
}

const DEMO_FLAGS: SettingsFlags = { voice: true, publicSearch: false }

/** §10.3 — the prototype's own demo counts, not derived from a live mandate. */
const DEMO_USAGE: SettingsUsage = { searches: 1, contacted: 1 }

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

let logCounter = 0

/**
 * Everything the settings panel reads and writes, as plain React state.
 *
 * The change log is written by the actions themselves (App.jsx's `logChange`),
 * so „Änderungsverlauf ansehen“ fills up while the demo is used.
 */
export function useSettingsDemoState(): {
  data: SettingsData
  actions: SettingsActions
} {
  const { t, locale } = useCopy()

  const [name, setName] = React.useState<string>(() => "Herzbuben")
  const [sources, setSources] = React.useState<DemoSource[]>(() => [
    ...DEMO_SOURCES,
  ])
  const [autoSources, setAutoSources] = React.useState(true)
  const [rules, setRules] = React.useState<AutonomyRules>(DEMO_RULES)
  const [flags] = React.useState<SettingsFlags>(DEMO_FLAGS)
  const [knowledge, setKnowledge] = React.useState<KnowledgeItem[]>(() => [
    ...DEMO_KNOWLEDGE,
  ])
  const [knowledgeLog, setKnowledgeLog] = React.useState<KnowledgeLogEntry[]>(
    []
  )
  const [notif, setNotif] = React.useState<NotificationPrefs>(DEMO_NOTIF)
  const [hasOrder, setHasOrder] = React.useState(true)

  /** „Heute, 19:04“ — `knowledge.log.demoWhen` plus a 24-hour clock (item 44). */
  const stamp = React.useCallback(
    () =>
      `${t("settings.knowledge.log.demoWhen")}, ${formatTime(
        locale,
        new Date()
      )}`,
    [locale, t]
  )

  const log = React.useCallback(
    (key: StringCopyKey, vars?: { text?: string; n?: number }) => {
      const entry: KnowledgeLogEntry = {
        id: `log-${++logCounter}`,
        key,
        text: vars?.text,
        n: vars?.n,
        when: stamp(),
      }
      setKnowledgeLog((entries) => [entry, ...entries])
    },
    [stamp]
  )

  /** Resolves a row's visible text the way every consumer does. */
  const labelOf = React.useCallback(
    (item: KnowledgeItem | undefined): string => {
      if (!item) return ""
      return item.text ?? (item.textKey ? t(item.textKey) : "")
    },
    [t]
  )

  // The log line quotes the row's text, which the state updater must not read
  // (an updater has to stay pure — StrictMode runs it twice). A mirror ref,
  // written in an effect, gives the handlers a safe read of the current rows.
  const knowledgeRef = React.useRef(knowledge)
  React.useEffect(() => {
    knowledgeRef.current = knowledge
  }, [knowledge])

  const setStatus = React.useCallback(
    (id: string, status: KnowledgeStatus, key: StringCopyKey) => {
      const target = knowledgeRef.current.find((item) => item.id === id)
      setKnowledge((items) =>
        items.map((item) => (item.id === id ? { ...item, status } : item))
      )
      if (target) log(key, { text: labelOf(target) })
    },
    [labelOf, log]
  )

  const actions = React.useMemo<SettingsActions>(
    () => ({
      setName: (next) => setName(next),
      setAutoSources: (on) => setAutoSources(on),
      setHasOrder: (has) => setHasOrder(has),
      toggleSource: (id) =>
        setSources((list) =>
          list.map((source) =>
            source.id === id ? { ...source, enabled: !source.enabled } : source
          )
        ),
      setAccess: (id, access) =>
        setSources((list) =>
          list.map((source) =>
            source.id === id
              ? {
                  ...source,
                  access,
                  lastAccess:
                    access === "connected" ? stamp() : source.lastAccess,
                }
              : source
          )
        ),
      saveRules: (next) => {
        setRules(next)
        log("settings.knowledge.log.entry.rulesUpdated")
      },
      setNotif: (next) => setNotif(next),
      updateKnowledge: (id, text) => {
        setKnowledge((items) =>
          items.map((item) => (item.id === id ? { ...item, text } : item))
        )
        log("settings.knowledge.log.entry.corrected", { text })
      },
      confirmKnowledge: (id) =>
        setStatus(id, "confirmed", "settings.knowledge.log.entry.confirmed"),
      dismissKnowledge: (id) =>
        setStatus(id, "retired", "settings.knowledge.log.entry.dismissed"),
      retireKnowledge: (id) =>
        setStatus(id, "retired", "settings.knowledge.log.entry.retired"),
      restoreKnowledge: (id) =>
        setStatus(id, "confirmed", "settings.knowledge.log.entry.undo"),
      addKnowledge: (items) => {
        setKnowledge((current) => current.concat(items))
        log("settings.knowledge.log.entry.imported", { n: items.length })
      },
    }),
    [log, setStatus, stamp]
  )

  const data = React.useMemo<SettingsData>(
    () => ({
      name,
      sources,
      autoSources,
      rules,
      flags,
      knowledge,
      knowledgeLog,
      notif,
      hasOrder,
      usage: DEMO_USAGE,
    }),
    [
      autoSources,
      flags,
      hasOrder,
      knowledge,
      knowledgeLog,
      name,
      notif,
      rules,
      sources,
    ]
  )

  return { data, actions }
}

/** Visible text of a knowledge row — `text` once edited, else the dictionary. */
export function knowledgeText(
  item: KnowledgeItem,
  t: (key: StringCopyKey) => string
): string {
  return item.text ?? (item.textKey ? t(item.textKey) : "")
}

/** A source counts as usable when it is included and reachable (§4.5). */
export function isSourceUsable(
  source: DemoSource,
  flags: SettingsFlags
): boolean {
  if (!source.enabled) return false
  return source.kind === "portal" || flags.publicSearch
}
