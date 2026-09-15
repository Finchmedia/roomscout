import type { DeepWiden } from "../types";
import type { operatorDe } from "../de/operator";

export const operatorEn = {
  brand: "roomscout",
  badge: { internal: "INTERNAL" },
  env: { development: "Development" },
  avatar: { initials: "OP", aria: "Operator" },
  footer: { note: "Internal status · Sample data view" },
  nav: {
    aria: "Operations",
    back: "Back to app",
    groupLabel: "Operations",
    overview: "Overview",
    sources: "Sources",
    tasks: "Tasks",
    integrations: "Integrations",
    flags: "Feature flags",
    diag: "Diagnostics",
    footerNote: "Operators only",
  },
  overview: {
    title: "Operations at a glance",
    subtitle: "Providers, sources, and waiting tasks.",
    attention: { icon: "!", text: "1 task needs attention", cta: "View" },
    calm: { text: "No task needs attention. Load a sample incident using the demo controls." },
    section: { integrations: "Integrations", tasks: "Tasks" },
    openai: { name: "OpenAI direct", separator: "·", role: "Voice & embeddings", status: "Ready" },
    rules: {
      label: "Operating rules",
      sessions: { label: "Concurrent browser sessions", value: "2" },
      retries: { label: "Retries", value: "Increasing intervals" },
      note: "Illustrative operating rules, not real worker pools.",
    },
    flags: {
      label: "Feature flags",
      edit: "Edit flags",
      publicSearch: { sub: "Demo limited to roomscout.dev" },
    },
  },
  tasks: {
    column: { process: "Process", source: "Source", status: "Status", next: "Next step" },
    action: { diagnose: "Diagnose", details: "Details" },
    source: { roomscout: "roomscout.dev" },
    status: {
      done: "Complete",
      expired: "Sign-in expired",
      blocked: "Waiting for access",
      planned: "Planned",
      resumed: "Resumed once",
    },
    t1: {
      name: "Check new listings",
      detail: "Public listings on roomscout.dev were checked in the demo run. A suitable room in Stuttgart-West was marked.",
    },
    t2: {
      name: "Read portal messages",
      detail: {
        default: "Portal replies are read through the connected demo access.",
        expired: "The saved sign-in has expired. Private portal messages cannot be read right now. Listing search continues.",
      },
    },
    t3: {
      name: "Prepare inquiry",
      detail: {
        blocked: "Waiting for portal access to be reconnected. No inquiry will be sent twice.",
        resumed: "Resumed once after sign-in was renewed.",
        default: "Inquiry to the provider within the band’s autonomy settings.",
      },
    },
  },
  sources: {
    title: "Sources",
    subtitle: "Technical connections for demo sources, independent of user preferences.",
    column: { source: "Source", region: "Region", connection: "Connection", lastCheck: "Last demo check" },
    tech: {
      portal: { connected: "Connected · Demo access", expired: "Connected · Sign-in required" },
      public: { active: "Public listings · Demo data", inactive: "Inactive (flag off)" },
    },
    check: { demoRun: "Today · Demo run", renewed: "Today, {time}", none: "—" },
    footnote: "The demo run is limited to roomscout.dev. Personal source preferences, such as excluding Bandnet from a search, do not change this status.",
    item: {
      roomscout: { name: "roomscout.dev", region: "Stuttgart" },
      musiker: { name: "Musicians in your city", region: "Stuttgart" },
      bandnet: { name: "Bandnet Hamburg", region: "Hamburg" },
    },
  },
  orders: {
    title: "Tasks",
    subtitle: "Processes in the current demo task.",
    filter: { all: "All", attention: "Needs attention" },
    empty: "No task needs attention.",
  },
  integrations: {
    title: "Integrations",
    subtitle: "Role and local demo status for each provider. No keys or secrets.",
    field: { config: "Configuration:", lastTest: "Last demo test:" },
    status: { ready: "Ready", configured: "Configured", check: "Check" },
    test: { success: "Successful (demo)", none: "No demo test yet" },
    config: { configured: "Configured" },
    convex: {
      name: "Convex AI Gateway",
      role: "Text & evaluation",
      note: "Processes conversation text and fact extraction during the demo run.",
    },
    firecrawl: {
      name: "Firecrawl",
      role: "Source monitoring",
      note: "A configured integration does not prove a successful live test.",
    },
    agentmail: {
      name: "AgentMail",
      role: "Scout mailboxes",
      note: "Provides the Scout addresses that receive portal notifications.",
    },
    browserbase: {
      name: "Browserbase",
      role: "Portal access",
      note: {
        ok: "Keeps portal sessions for reading and sending messages.",
        incident: "An expired portal sign-in does not mean Browserbase itself is down.",
      },
      test: { incident: "1 portal connection needs a new sign-in" },
    },
    openai: {
      name: "OpenAI direct",
      role: "Voice & embeddings",
      note: "Voice input and output plus embeddings for assessing listings.",
    },
  },
  flags: {
    title: "Feature flags",
    subtitle: "Local demo changes, no deployments.",
    voice: {
      label: "Voice Scout",
      effect: "Off: no new demo voice sessions. Active conversations continue and text remains available.",
    },
    publicSearch: {
      label: "Public source search",
      effect: "On: existing fictional demo data only. Off: public sources remain saved as preferences but are marked inactive in this demo.",
    },
    scopeNote: "Demo limited to roomscout.dev. No real crawl is started.",
    preview: {
      label: "Effect before saving",
      arrow: "→",
      on: "on",
      off: "off",
      voice: {
        on: "New demo voice sessions are available again.",
        off: "No new demo voice sessions; search knowledge and active conversations are preserved.",
      },
      publicSearch: {
        on: "Public demo sources become active for users. No access to real portals.",
        off: "Public sources are marked inactive in user settings.",
      },
    },
    action: { cancel: "Cancel", save: "Save locally" },
    saved: "Flags saved locally.",
    state: { on: "On", off: "Off" },
  },
  diag: {
    title: "Diagnostics",
    subtitle: "Readable events from local demo data.",
    empty: "No open incidents. Load a sample incident using the demo controls.",
    openSheet: "Open diagnostics sheet",
  },
  diagSheet: {
    title: "Diagnostics",
    close: { aria: "Close" },
    field: { process: "Process", portal: "Portal", state: "Status" },
    value: { process: "Read portal messages", portal: "roomscout.dev · Profile Herzbuben" },
    state: { expired: "Sign-in expired", renewed: "Connected (renewed)" },
    label: { cause: "Cause", impact: "Impact", next: "Next step", timeline: "Event timeline" },
    text: {
      cause: "The saved sign-in has expired.",
      impact: "Private portal messages cannot be read right now. Listing search continues.",
      next: "Reconnect portal access. The band sees a notice in its access settings.",
    },
    simulation: {
      label: "Simulation",
      text: "Locally sets the sample access to Connected and releases the waiting demo task once. Completed inquiries are not triggered again.",
      action: "Simulate renewed sign-in",
    },
    resolved: "Access renewed. The waiting task was resumed once.",
  },
  events: {
    time: { "0941": "09:41", "0942": "09:42", now: "Now" },
    notificationReceived: "Portal notification received for a new message",
    openFailed: "Opening portal message failed: sign-in expired",
    taskMarkedExpired: "Task “Read portal messages” marked “Sign-in expired”",
    taskWaitingAccess: "Task “Prepare inquiry” is waiting for access",
    userHintShown: "Notice shown in the band’s access settings",
    loginRenewed: "Sign-in renewed (simulation) · waiting task resumed once",
  },
  scout: {
    waitingAccess: {
      text: "Your portal access to roomscout.dev needs a new sign-in.",
      cta: "Go to access settings",
    },
    status: { needsLogin: "My access to roomscout.dev needs a new sign-in before I can make an inquiry." },
  },
  settings: {
    page: { sources: { title: "Sources & access" } },
    sources: {
      state: { expired: "Sign in again" },
      action: { openLogin: "Open sign-in" },
      saved: "Access saved. Your Scout can continue.",
    },
  },
  host: {
    demoControls: { loadIncident: "Load sample incident", openOperator: "Operator view" },
    now: { prefix: "Today", format: "{prefix}, {h}:{mm}" },
  },
} as const satisfies DeepWiden<typeof operatorDe>;
