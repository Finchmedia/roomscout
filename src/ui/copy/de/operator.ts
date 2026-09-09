/**
 * German copy dictionary — Operator surface.
 *
 * Source: docs/UI_PORT/OPERATOR_SCREENS.md § 17 "Copy dictionary (DE)" (§ 17.1–§ 17.12).
 * Extracted verbatim on 2026-09-09. German is the source language (COMPONENT_MAP.md Part 6).
 *
 * Namespacing (COMPONENT_MAP.md § 6.1, hand-edit 1): the doc's § 17.1–§ 17.2 keys already carry an
 * `operator.` self-prefix — it is stripped here, so `operator.nav.back` / `operator.brand` are
 * reached once this object is nested under the top-level `operator` namespace. The § 17.12
 * cross-surface block keeps its `settings.` / `host.` / `scout.` prefixes on purpose: they become
 * `operator.settings.*`, `operator.host.*`, `operator.scout.*` and must NOT be merged into the
 * Settings or Scout surfaces.
 *
 * Do not re-type these strings. Typography („ “ · – — → …) is part of the value.
 */
export const operatorDe = {
  // --- 17.1 Chrome
  brand: "roomscout",
  badge: {
    internal: "INTERN",
  },
  env: {
    development: "Entwicklung",
  },
  avatar: {
    initials: "OP",
    aria: "Operator",
  },
  footer: {
    note: "Interner Status · Darstellung mit Beispieldaten",
  },

  // --- 17.2 Sidebar
  nav: {
    aria: "Betrieb",
    back: "Zur App",
    groupLabel: "Betrieb",
    overview: "Übersicht",
    sources: "Quellen",
    tasks: "Aufträge",
    integrations: "Integrationen",
    flags: "Feature-Flags",
    diag: "Diagnose",
    footerNote: "Nur für Betreiber",
  },

  // --- 17.3 Overview — Betrieb im Blick
  overview: {
    title: "Betrieb im Blick",
    subtitle: "Provider, Quellen und wartende Aufgaben.",
    attention: {
      icon: "!",
      text: "1 Aufgabe braucht Aufmerksamkeit",
      cta: "Ansehen",
    },
    calm: {
      text: "Keine Aufgabe braucht Aufmerksamkeit. Beispielstörung über die Demo-Steuerung laden.",
    },
    section: {
      integrations: "Integrationen",
      tasks: "Aufgaben",
    },
    openai: {
      name: "OpenAI direkt",
      separator: "·",
      role: "Voice & Embeddings",
      status: "Bereit",
    },
    rules: {
      label: "Betriebsregeln",
      sessions: {
        label: "Parallele Browser-Sessions",
        value: "2",
      },
      retries: {
        label: "Erneute Versuche",
        value: "Mit zunehmendem Abstand",
      },
      note: "Illustrative Betriebsregeln, keine echten Worker-Pools.",
    },
    flags: {
      label: "Feature-Flags",
      edit: "Flags bearbeiten",
      publicSearch: {
        sub: "Demo auf roomscout.dev begrenzt",
      },
    },
  },

  // --- 17.4 Shared — task table
  tasks: {
    column: {
      process: "Vorgang",
      source: "Quelle",
      status: "Status",
      next: "Nächster Schritt",
    },
    action: {
      diagnose: "Diagnose",
      details: "Details",
    },
    source: {
      roomscout: "roomscout.dev",
    },
    status: {
      done: "Abgeschlossen",
      expired: "Anmeldung abgelaufen",
      blocked: "Wartet auf Zugang",
      planned: "Geplant",
      resumed: "Fortgesetzt (einmalig)",
    },
    t1: {
      name: "Neue Anzeigen prüfen",
      detail: "Öffentliche Anzeigen auf roomscout.dev wurden im Demo-Lauf geprüft. Ein passender Raum in Stuttgart-West wurde markiert.",
    },
    t2: {
      name: "Portal-Nachrichten lesen",
      // §17.4 also lists `tasks.t2.detail.expired`, whose prototype value is an empty string.
      // Omitted here (no source copy, and an empty value is not shippable) — see §14.3.
      detail: "Antworten im Portal werden über den verbundenen Demo-Zugang gelesen.",
    },
    t3: {
      name: "Anfrage vorbereiten",
      detail: {
        blocked: "Wartet, bis der Portalzugang erneut verbunden ist. Es wird keine Anfrage doppelt gesendet.",
        resumed: "Nach der erneuerten Anmeldung einmalig fortgesetzt.",
        default: "Anfrage an den Anbieter im Rahmen des Handlungsspielraums der Band.",
      },
    },
  },

  // --- 17.5 Quellen
  sources: {
    title: "Quellen",
    subtitle: "Technische Anbindung der Demo-Quellen, unabhängig von Nutzerpräferenzen.",
    column: {
      source: "Quelle",
      region: "Region",
      connection: "Anbindung",
      lastCheck: "Letzter Demo-Check",
    },
    tech: {
      portal: {
        connected: "Angebunden · Demo-Zugang",
        expired: "Angebunden · Zugang braucht Anmeldung",
      },
      public: {
        active: "Öffentliche Anzeigen · Demo-Daten",
        inactive: "Nicht aktiv (Flag aus)",
      },
    },
    check: {
      demoRun: "Heute · Demo-Lauf",
      // Δ port: the doc dictionary shows the prototype literal 'Heute, {h}:{mm}'; § 17.5
      // 'Formatting rule' and COMPONENT_MAP § 6.3 both mandate this locale-formatted token
      // instead: time = Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).
      renewed: "Heute, {time}",
      none: "—",
    },
    footnote: "Der Demo-Lauf ist auf roomscout.dev begrenzt. Persönliche Quellenpräferenzen der Nutzer (z. B. „Bandnet für meine Suche ausschließen“) verändern diesen Status nicht.",
    item: {
      roomscout: {
        name: "roomscout.dev",
        region: "Stuttgart",
      },
      musiker: {
        name: "Musiker in deiner Stadt",
        region: "Stuttgart",
      },
      bandnet: {
        name: "Bandnet Hamburg",
        region: "Hamburg",
      },
    },
  },

  // --- 17.6 Aufträge
  orders: {
    title: "Aufträge",
    subtitle: "Vorgänge des laufenden Demo-Auftrags.",
    filter: {
      all: "Alle",
      attention: "Braucht Aufmerksamkeit",
    },
    empty: "Keine Aufgabe braucht Aufmerksamkeit.",
  },

  // --- 17.7 Integrationen
  integrations: {
    title: "Integrationen",
    subtitle: "Rolle und lokaler Demo-Status je Provider. Keine Schlüssel, keine Secrets.",
    field: {
      config: "Konfiguration:",
      lastTest: "Letzter Demo-Test:",
    },
    status: {
      ready: "Bereit",
      configured: "Konfiguriert",
      check: "Prüfen",
    },
    test: {
      success: "Erfolgreich (Demo)",
      none: "Noch kein Demo-Test",
    },
    config: {
      configured: "Konfiguriert",
    },
    convex: {
      name: "Convex AI Gateway",
      role: "Text & Auswertung",
      note: "Verarbeitet Gesprächstext und Faktenextraktion im Demo-Lauf.",
    },
    firecrawl: {
      name: "Firecrawl",
      role: "Quellen beobachten",
      note: "Eine konfigurierte Integration ist kein Nachweis für einen erfolgreichen Live-Test.",
    },
    agentmail: {
      name: "AgentMail",
      role: "Scout-Postfächer",
      note: "Stellt die Scout-Adressen bereit, über die Portal-Benachrichtigungen ankommen.",
    },
    browserbase: {
      name: "Browserbase",
      role: "Portal-Zugänge",
      note: {
        ok: "Hält die Portal-Sitzungen für Lesen und Senden von Nachrichten.",
        incident: "Ein abgelaufener Portal-Login ist kein Ausfall von Browserbase insgesamt.",
      },
      test: {
        incident: "1 Portalzugang braucht eine neue Anmeldung",
      },
    },
    openai: {
      name: "OpenAI direkt",
      role: "Voice & Embeddings",
      note: "Sprachein- und -ausgabe sowie Embeddings für die Einordnung von Anzeigen.",
    },
  },

  // --- 17.8 Feature-Flags
  flags: {
    title: "Feature-Flags",
    subtitle: "Lokale Demo-Änderungen, keine Deployments.",
    voice: {
      label: "Voice Scout",
      effect: "Aus: keine neuen Demo-Voice-Sessions. Laufende Gespräche werden nicht abgeschnitten, Text bleibt nutzbar.",
    },
    publicSearch: {
      label: "Öffentliche Quellensuche",
      effect: "An: nur vorhandene fiktive Demo-Daten. Aus: öffentliche Quellen bleiben als Präferenz gespeichert, gelten aber als „In dieser Demo nicht aktiv“.",
    },
    scopeNote: "Demo auf roomscout.dev begrenzt. Es startet kein echter Crawl.",
    preview: {
      label: "Wirkung vor dem Speichern",
      arrow: "→",
      on: "an",
      off: "aus",
      voice: {
        on: "Neue Demo-Voice-Sessions sind wieder möglich.",
        off: "Keine neuen Demo-Voice-Sessions; Suchwissen und laufende Gespräche bleiben erhalten.",
      },
      publicSearch: {
        on: "Öffentliche Demo-Quellen werden für Nutzer aktiv. Kein Zugriff auf echte Portale.",
        off: "Öffentliche Quellen werden in den Nutzereinstellungen als nicht aktiv gekennzeichnet.",
      },
    },
    action: {
      cancel: "Abbrechen",
      save: "Lokal speichern",
    },
    saved: "Flags lokal gespeichert.",
    state: {
      on: "An",
      off: "Aus",
    },
  },

  // --- 17.9 Diagnose (page)
  diag: {
    title: "Diagnose",
    subtitle: "Verständliche Ereignisse aus den lokalen Demo-Daten.",
    empty: "Keine offenen Störungen. Über die Demo-Steuerung lässt sich eine Beispielstörung laden.",
    openSheet: "Diagnose-Sheet öffnen",
  },

  // --- 17.10 Diagnose sheet
  diagSheet: {
    title: "Diagnose",
    close: {
      aria: "Schließen",
    },
    field: {
      process: "Vorgang",
      portal: "Portal",
      state: "Zustand",
    },
    value: {
      process: "Portal-Nachrichten lesen",
      portal: "roomscout.dev · Profil Herzbuben",
    },
    state: {
      expired: "Anmeldung abgelaufen",
      renewed: "Verbunden (erneuert)",
    },
    label: {
      cause: "Ursache",
      impact: "Auswirkung",
      next: "Nächster Schritt",
      timeline: "Ereignisfolge",
    },
    text: {
      cause: "Die gespeicherte Anmeldung ist abgelaufen.",
      impact: "Private Portalnachrichten können momentan nicht gelesen werden. Die Suche nach Anzeigen läuft weiter.",
      next: "Portalzugang erneut verbinden. Die Band sieht dazu einen Hinweis in ihren Zugängen.",
    },
    simulation: {
      label: "Simulation",
      text: "Setzt den Beispielzugang lokal auf „Verbunden“ und gibt die wartende Demo-Aufgabe einmalig frei. Bereits abgeschlossene Anfragen werden nicht erneut ausgelöst.",
      action: "Anmeldung als erneuert simulieren",
    },
    resolved: "Zugang erneuert. Die wartende Aufgabe wurde einmalig fortgesetzt.",
  },

  // --- 17.11 Incident events
  events: {
    time: {
      "0941": "09:41",
      "0942": "09:42",
      now: "Jetzt",
    },
    notificationReceived: "Portal-Benachrichtigung über neue Nachricht erhalten",
    openFailed: "Öffnen der Portal-Nachricht fehlgeschlagen: Anmeldung abgelaufen",
    taskMarkedExpired: "Aufgabe „Portal-Nachrichten lesen“ als „Anmeldung abgelaufen“ markiert",
    taskWaitingAccess: "Aufgabe „Anfrage vorbereiten“ wartet auf Zugang",
    userHintShown: "Hinweis in den Zugängen der Band angezeigt",
    loginRenewed: "Anmeldung erneuert (Simulation) · wartende Aufgabe einmalig fortgesetzt",
  },

  // --- 17.12 Cross-surface strings referenced by the incident flow (owned by other surfaces, listed for coordination)
  scout: {
    waitingAccess: {
      text: "Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.",
      cta: "Zu den Zugängen",
    },
    status: {
      needsLogin: "Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.",
    },
  },
  settings: {
    page: {
      sources: {
        // Settings.dc.html:448 — the page `Zu den Zugängen` opens (owned by the Settings surface).
        title: "Quellen & Zugänge",
      },
    },
    sources: {
      state: {
        expired: "Anmeldung erneut nötig",
      },
      action: {
        openLogin: "Anmeldung öffnen",
      },
      saved: "Zugang gespeichert. Dein Scout kann weitermachen.",
    },
  },
  host: {
    demoControls: {
      loadIncident: "Beispielstörung laden",
      openOperator: "Betreiberansicht",
    },
    now: {
      // Roomscout.dc.html:737, `now()`
      prefix: "Heute",
      // h unpadded, mm zero-padded; feeds sources.check.renewed (§17.5)
      format: "{prefix}, {h}:{mm}",
    },
  },
} as const;
