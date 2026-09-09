/**
 * Operator surface — local demo state. **DEMO DATA ONLY.**
 *
 * Every value in this file is illustrative prototype data, exactly as the kit
 * frames it („Interner Status · Darstellung mit Beispieldaten“). Nothing here
 * talks to Convex; the surface build is deliberately Convex-free and the
 * Integrate agent replaces this hook with real bindings.
 *
 * Ported from:
 * - `design-system/ui_kits/roomscout-app/App.jsx` — `SOURCES0`, `flags`,
 *   `incident` / `incidentResolved`, `opData` / `opActions`, `loadIncident()`,
 *   `setAccess()` (which flips `incidentResolved` and stamps `lastAccess`).
 * - `design-system/ui_kits/roomscout-app/Operator.jsx` — `mk()` task factory,
 *   the `ints` array, the `events` log and the `open` / `resolved` booleans.
 * - `docs/UI_PORT/OPERATOR_SCREENS.md` §12–§15 for the state model.
 *
 * DECISIONS.md item 4: the prototype's dead fields (`opData.stage`, the
 * per-user `source.enabled`) are dropped — the operator sees technical
 * connectivity only.
 *
 * Copy never lives here: the derivations return dictionary **key paths**
 * (`StringCopyKey`), and the components resolve them through `useCopy()`.
 */

import * as React from "react"

import type { StringCopyKey } from "@/ui/copy"

/* ------------------------------------------------------------------ pages -- */

/** Nav order of `Operator.jsx`'s `OPAGES`. */
export const OPERATOR_PAGE_IDS = [
  "overview",
  "sources",
  "tasks",
  "integrations",
  "flags",
  "diag",
] as const

export type OperatorPageId = (typeof OPERATOR_PAGE_IDS)[number]

/* ---------------------------------------------------------------- sources -- */

export const OPERATOR_SOURCE_IDS = ["roomscout", "musiker", "bandnet"] as const
export type OperatorSourceId = (typeof OPERATOR_SOURCE_IDS)[number]

/** `portal` = a logged-in demo portal, `public` = public listings. */
export type OperatorSourceKind = "portal" | "public"

/** Portal sources carry a login; public sources are always `"public"`. */
export type OperatorSourceAccess = "connected" | "expired" | "public"

export interface OperatorSource {
  id: OperatorSourceId
  kind: OperatorSourceKind
  access: OperatorSourceAccess
  /** Stamped by `setAccess(id, "connected")`; `null` = „Heute · Demo-Lauf“. */
  lastAccess: Date | null
}

/** `App.jsx` `SOURCES0`, minus the per-user `enabled` flag (DECISIONS item 4). */
const INITIAL_SOURCES: readonly OperatorSource[] = [
  { id: "roomscout", kind: "portal", access: "connected", lastAccess: null },
  { id: "musiker", kind: "public", access: "public", lastAccess: null },
  { id: "bandnet", kind: "public", access: "public", lastAccess: null },
]

/* ------------------------------------------------------------------ flags -- */

export const OPERATOR_FLAG_KEYS = ["voice", "publicSearch"] as const
export type OperatorFlagKey = (typeof OPERATOR_FLAG_KEYS)[number]

export type OperatorFlags = Record<OperatorFlagKey, boolean>

/** `App.jsx`: `{ voice: true, publicSearch: false }`. */
const INITIAL_FLAGS: OperatorFlags = { voice: true, publicSearch: false }

/**
 * Copy key paths per flag — `Operator.jsx`'s `FLAG_LABEL` / `FLAG_EFFECT` maps
 * and the two pre-save sentences of §13.2, as dictionary paths.
 */
export const OPERATOR_FLAG_COPY: Record<
  OperatorFlagKey,
  {
    labelKey: StringCopyKey
    effectKey: StringCopyKey
    previewOnKey: StringCopyKey
    previewOffKey: StringCopyKey
  }
> = {
  voice: {
    labelKey: "operator.flags.voice.label",
    effectKey: "operator.flags.voice.effect",
    previewOnKey: "operator.flags.preview.voice.on",
    previewOffKey: "operator.flags.preview.voice.off",
  },
  publicSearch: {
    labelKey: "operator.flags.publicSearch.label",
    effectKey: "operator.flags.publicSearch.effect",
    previewOnKey: "operator.flags.preview.publicSearch.on",
    previewOffKey: "operator.flags.preview.publicSearch.off",
  },
}

/* ------------------------------------------------------------------ state -- */

export interface OperatorDemoState {
  page: OperatorPageId
  sources: readonly OperatorSource[]
  flags: OperatorFlags
  /** „Beispielstörung laden“ has been used. */
  incident: boolean
  /** The portal login was renewed while an incident was open. */
  incidentResolved: boolean
  /** `App.jsx`: the autopilot already contacted a provider. */
  contacted: boolean
}

const INITIAL_STATE: OperatorDemoState = {
  page: "overview",
  sources: INITIAL_SOURCES,
  flags: INITIAL_FLAGS,
  incident: false,
  incidentResolved: false,
  contacted: false,
}

type OperatorDemoAction =
  | { type: "setPage"; page: OperatorPageId }
  | { type: "setFlags"; flags: OperatorFlags }
  | { type: "setAccess"; id: OperatorSourceId; access: OperatorSourceAccess }
  | { type: "loadIncident" }
  | { type: "reset" }

/**
 * `App.jsx` `setAccess`: stamps `lastAccess` on connect and resolves an open
 * incident. `loadIncident` expires the roomscout portal and jumps to the
 * overview page, exactly like the host's demo control.
 */
function reducer(
  state: OperatorDemoState,
  action: OperatorDemoAction
): OperatorDemoState {
  switch (action.type) {
    case "setPage":
      return state.page === action.page ? state : { ...state, page: action.page }

    case "setFlags":
      return { ...state, flags: action.flags }

    case "setAccess": {
      const now = new Date()
      return {
        ...state,
        sources: state.sources.map((source) =>
          source.id === action.id
            ? {
                ...source,
                access: action.access,
                lastAccess:
                  action.access === "connected" ? now : source.lastAccess,
              }
            : source
        ),
        incidentResolved:
          state.incident && action.access === "connected"
            ? true
            : state.incidentResolved,
      }
    }

    case "loadIncident":
      return {
        ...state,
        page: "overview",
        incident: true,
        incidentResolved: false,
        sources: state.sources.map((source) =>
          source.id === "roomscout" ? { ...source, access: "expired" } : source
        ),
      }

    case "reset":
      return INITIAL_STATE
  }
}

export interface OperatorDemoActions {
  setPage: (page: OperatorPageId) => void
  setFlags: (flags: OperatorFlags) => void
  setAccess: (id: OperatorSourceId, access: OperatorSourceAccess) => void
  /** Diagnose sheet → „Anmeldung als erneuert simulieren“ (guarded upstream). */
  renewLogin: () => void
  /** Demo control → „Beispielstörung laden“. */
  loadIncident: () => void
  /** Demo control → back to the clean start. */
  reset: () => void
}

export interface OperatorDemo {
  state: OperatorDemoState
  actions: OperatorDemoActions
}

export function useOperatorDemoState(
  initial?: Partial<OperatorDemoState>
): OperatorDemo {
  const [state, dispatch] = React.useReducer(reducer, {
    ...INITIAL_STATE,
    ...initial,
  })

  const actions = React.useMemo<OperatorDemoActions>(
    () => ({
      setPage: (page) => dispatch({ type: "setPage", page }),
      setFlags: (flags) => dispatch({ type: "setFlags", flags }),
      setAccess: (id, access) => dispatch({ type: "setAccess", id, access }),
      renewLogin: () =>
        dispatch({ type: "setAccess", id: "roomscout", access: "connected" }),
      loadIncident: () => dispatch({ type: "loadIncident" }),
      reset: () => dispatch({ type: "reset" }),
    }),
    []
  )

  return { state, actions }
}

/* ------------------------------------------------------- derived booleans -- */

/** `Operator.jsx`: `open = incident && !incidentResolved`. */
export function isIncidentOpen(state: OperatorDemoState): boolean {
  return state.incident && !state.incidentResolved
}

/** `Operator.jsx`: `resolved = incident && incidentResolved`. */
export function isIncidentResolved(state: OperatorDemoState): boolean {
  return state.incident && state.incidentResolved
}

/* ------------------------------------------------------------------ tasks -- */

export const OPERATOR_TASK_IDS = ["t1", "t2", "t3"] as const
export type OperatorTaskId = (typeof OPERATOR_TASK_IDS)[number]

export type OperatorTaskStatus =
  | "done"
  | "expired"
  | "blocked"
  | "planned"
  | "resumed"

export interface OperatorTask {
  id: OperatorTaskId
  status: OperatorTaskStatus
  nameKey: StringCopyKey
  detailKey: StringCopyKey
  /** `t.attention` — the row that offers the Diagnose action. */
  attention: boolean
}

/** `Operator.jsx` `mk()` + the three `tasks` entries. */
export function deriveTasks(state: OperatorDemoState): OperatorTask[] {
  const open = isIncidentOpen(state)
  const resolved = isIncidentResolved(state)
  const seen = state.incident || state.contacted

  const t2Status: OperatorTaskStatus = open
    ? "expired"
    : seen
      ? "done"
      : "planned"

  const t3Status: OperatorTaskStatus = open
    ? "blocked"
    : resolved
      ? "resumed"
      : state.contacted
        ? "done"
        : "planned"

  return [
    {
      id: "t1",
      status: "done",
      nameKey: "operator.tasks.t1.name",
      detailKey: "operator.tasks.t1.detail",
      attention: false,
    },
    {
      id: "t2",
      status: t2Status,
      nameKey: "operator.tasks.t2.name",
      // DECISIONS.md item 42 / 73 / 84: the expired state has real copy now.
      detailKey:
        t2Status === "expired"
          ? "operator.tasks.t2.detail.expired"
          : "operator.tasks.t2.detail.default",
      attention: t2Status === "expired",
    },
    {
      id: "t3",
      status: t3Status,
      nameKey: "operator.tasks.t3.name",
      detailKey:
        t3Status === "blocked"
          ? "operator.tasks.t3.detail.blocked"
          : t3Status === "resumed"
            ? "operator.tasks.t3.detail.resumed"
            : "operator.tasks.t3.detail.default",
      // `attention` is `status === "expired"`, which t3 never reaches.
      attention: false,
    },
  ]
}

/* ----------------------------------------------------------- integrations -- */

export const OPERATOR_INTEGRATION_IDS = [
  "convex",
  "firecrawl",
  "agentmail",
  "browserbase",
  "openai",
] as const
export type OperatorIntegrationId = (typeof OPERATOR_INTEGRATION_IDS)[number]

/** `StatusDot` tones used by this surface: green / amber / grey. */
export type OperatorTone = "success" | "warning" | "idle"

export interface OperatorIntegration {
  id: OperatorIntegrationId
  nameKey: StringCopyKey
  roleKey: StringCopyKey
  statusKey: StringCopyKey
  configKey: StringCopyKey
  testKey: StringCopyKey
  noteKey: StringCopyKey
  tone: OperatorTone
  /** Public URL of the partner mark — `public/design/partners/…`. */
  logo: string
}

const PARTNER_LOGOS: Record<OperatorIntegrationId, string> = {
  convex: "/design/partners/logo-convex.svg",
  firecrawl: "/design/partners/logo-firecrawl.svg",
  agentmail: "/design/partners/logo-agentmail.png",
  browserbase: "/design/partners/logo-browserbase.png",
  openai: "/design/partners/logo-openai.svg",
}

/**
 * `Operator.jsx` `ints` — five providers, in order. Browserbase is the only one
 * with an incident variant; Firecrawl is deliberately grey/„Konfiguriert“.
 */
export function deriveIntegrations(
  state: OperatorDemoState
): OperatorIntegration[] {
  const open = isIncidentOpen(state)

  return [
    {
      id: "convex",
      nameKey: "operator.integrations.convex.name",
      roleKey: "operator.integrations.convex.role",
      statusKey: "operator.integrations.status.ready",
      configKey: "operator.integrations.config.configured",
      testKey: "operator.integrations.test.success",
      noteKey: "operator.integrations.convex.note",
      tone: "success",
      logo: PARTNER_LOGOS.convex,
    },
    {
      id: "firecrawl",
      nameKey: "operator.integrations.firecrawl.name",
      roleKey: "operator.integrations.firecrawl.role",
      statusKey: "operator.integrations.status.configured",
      configKey: "operator.integrations.config.configured",
      testKey: "operator.integrations.test.none",
      noteKey: "operator.integrations.firecrawl.note",
      tone: "idle",
      logo: PARTNER_LOGOS.firecrawl,
    },
    {
      id: "agentmail",
      nameKey: "operator.integrations.agentmail.name",
      roleKey: "operator.integrations.agentmail.role",
      statusKey: "operator.integrations.status.ready",
      configKey: "operator.integrations.config.configured",
      testKey: "operator.integrations.test.success",
      noteKey: "operator.integrations.agentmail.note",
      tone: "success",
      logo: PARTNER_LOGOS.agentmail,
    },
    {
      id: "browserbase",
      nameKey: "operator.integrations.browserbase.name",
      roleKey: "operator.integrations.browserbase.role",
      statusKey: open
        ? "operator.integrations.status.check"
        : "operator.integrations.status.ready",
      configKey: "operator.integrations.config.configured",
      testKey: open
        ? "operator.integrations.browserbase.test.incident"
        : "operator.integrations.test.success",
      noteKey: open
        ? "operator.integrations.browserbase.note.incident"
        : "operator.integrations.browserbase.note.ok",
      tone: open ? "warning" : "success",
      logo: PARTNER_LOGOS.browserbase,
    },
    {
      id: "openai",
      nameKey: "operator.integrations.openai.name",
      roleKey: "operator.integrations.openai.role",
      statusKey: "operator.integrations.status.ready",
      configKey: "operator.integrations.config.configured",
      testKey: "operator.integrations.test.success",
      noteKey: "operator.integrations.openai.note",
      tone: "success",
      logo: PARTNER_LOGOS.openai,
    },
  ]
}

/* ----------------------------------------------------------------- events -- */

export interface OperatorEvent {
  id: string
  timeKey: StringCopyKey
  textKey: StringCopyKey
}

/**
 * `Operator.jsx` `events` — five illustrative rows while an incident exists,
 * plus the „Jetzt“ row once it is resolved. Timestamps are literals, not clocks.
 */
export function deriveEvents(state: OperatorDemoState): OperatorEvent[] {
  if (!state.incident) return []

  const events: OperatorEvent[] = [
    {
      id: "notificationReceived",
      timeKey: "operator.events.time.0941",
      textKey: "operator.events.notificationReceived",
    },
    {
      id: "openFailed",
      timeKey: "operator.events.time.0941",
      textKey: "operator.events.openFailed",
    },
    {
      id: "taskMarkedExpired",
      timeKey: "operator.events.time.0942",
      textKey: "operator.events.taskMarkedExpired",
    },
    {
      id: "taskWaitingAccess",
      timeKey: "operator.events.time.0942",
      textKey: "operator.events.taskWaitingAccess",
    },
    {
      id: "userHintShown",
      timeKey: "operator.events.time.0942",
      textKey: "operator.events.userHintShown",
    },
  ]

  if (isIncidentResolved(state)) {
    events.push({
      id: "loginRenewed",
      timeKey: "operator.events.time.now",
      textKey: "operator.events.loginRenewed",
    })
  }

  return events
}
