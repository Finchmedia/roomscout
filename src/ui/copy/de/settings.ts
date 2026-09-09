// German copy dictionary — settings surface.
// Source: docs/UI_PORT/SETTINGS_SCREENS.md §17 "Copy dictionary (DE)" (§17.1–§17.11).
// Extracted verbatim on 2026-09-09. Do not re-type or "improve" a value —
// re-extract from the doc if a string has to change.
//
// Hand-edits applied per docs/UI_PORT/COMPONENT_MAP.md §6.1:
//   rule 1 — §17.1's own leading `settings.` prefix is stripped (settings.nav.back, not settings.settings.nav.back).
//   rule 3 — §17.12's `common.*` block is hoisted to the top level and lives in ./common.ts, not here.
// Plurals per COMPONENT_MAP.md §6.3, which names three of its four cases in this file:
//   `billing.usage.searches` and `knowledge.import.done` ship as { one, other } objects
//   (doc keys `…searchesOne/…searchesMany` and `…doneOne/…doneMany`; both values verbatim).
//   `privacy.portals.sub` is singular-only in the prototype; §6.3 requires a plural form in the
//   port, so it ships as { one, other } too — the `one` is the doc value, the `other` comes from
//   docs/UI_PORT/REVIEW_COPY.md §10 and is PROPOSED (DECISIONS.md item 15), not yet approved.
// One further hard-plural string is NOT converted — see the note at `knowledge.log.entry.imported`.

export const settingsDe = {
  // §17.1 Navigation & shell (doc keys carry a leading `settings.` — stripped per COMPONENT_MAP §6.1 rule 1)
  nav: {
    back: "Zurück zum Scout",
    aria: "Einstellungen",
    groupScout: "Dein Scout",
    groupAccount: "Dein Konto",
    item: {
      sources: "Quellen & Zugänge",
      autonomy: "Handlungsspielraum",
      knowledge: "Was dein Scout weiß",
      profile: "Profil",
      notifications: "Benachrichtigungen",
      billing: "Tarif & Nutzung",
      privacy: "Datenschutz",
    },
    footer: {
      role: "Persönlicher Bereich",
    },
  },
  // §17.1 Session badge
  session: {
    working: "Scout ist unterwegs",
    paused: "Suche pausiert",
    held: "Gespräch pausiert · läuft weiter, wenn du zurückkehrst",
  },
  // §17.1 Host caption
  host: {
    caption: "Designprototyp · Beispieldaten",
  },
  // §17.2 Quellen & Zugänge
  sources: {
    title: "Wo darf dein Scout suchen?",
    subtitle: {
      withOrder: "Quellen für eure Suche in {city}.",
      noOrder: "Quellen gelten für einen konkreten Suchauftrag.",
    },
    noOrder: {
      title: "Lege zuerst einen Suchauftrag an.",
      body: "Quellen gelten immer für eine konkrete Suche. Deine Portalzugänge bleiben davon unabhängig.",
      cta: "Zum Scout",
    },
    auto: {
      title: "Passende Quellen automatisch auswählen",
      sub: "Deine Ausschlüsse bleiben erhalten.",
      saved: "Gespeichert",
    },
    list: {
      label: "Deine Quellen",
      scope: "Für diese Suche",
    },
    noUsable: {
      text: "Aktuell ist keine nutzbare Quelle ausgewählt. Dein Scout kann so nicht weitersuchen.",
      cta: "Quelle auswählen",
    },
    status: {
      excluded: "Nicht einbezogen",
      connected: "Verbunden",
      expired: "Anmeldung erneut nötig",
      public: "Ohne Anmeldung",
    },
    row: {
      saved: "Gespeichert",
      switchAria: "{name} für diese Suche verwenden",
      detailsAria: "Details",
    },
    detail: {
      portalProfile: "Portalprofil: {profile}",
      portalScope: "Anzeigen lesen und Nachrichten austauschen",
      publicListings: "Öffentliche Anzeigen können berücksichtigt werden. Der Kontaktweg hängt von der Anzeige ab.",
      demoInactive: "In dieser Demo nicht aktiv",
      outOfRegion: "Hamburg liegt außerhalb eurer Suche. Eine Anmeldung ist dafür nicht nötig.",
      offHint: "Keine neuen Anfragen über diese Quelle. Vorhandene Gespräche bleiben sichtbar.",
      manageConnection: "Verbindung verwalten",
      openLogin: "Anmeldung öffnen",
    },
    address: {
      title: "Deine Scout-Adresse",
      value: "herzbuben@scout.example",
      hint: "Für Portal-Anmeldungen und Antworten an deinen Scout.",
      copy: "Kopieren",
      copied: "Kopiert",
      copyFail: "Kopieren war nicht möglich. Du kannst die Adresse markieren und selbst kopieren.",
    },
    more: {
      show: "Weitere Quellen ansehen",
      hide: "Weitere Quellen ausblenden",
      note: "Eine Quelle auszuschließen löscht keinen Portal-Account.",
      searchPlaceholder: "Quelle oder Region suchen …",
      searchAria: "Quellen durchsuchen",
      state: {
        available: "Verfügbar",
        loginNeeded: "Anmeldung nötig",
        unavailable: "Noch nicht verfügbar",
      },
      action: {
        exclude: "Ausschließen",
        include: "Einbeziehen",
        unavailable: "Nicht verfügbar",
      },
      example: {
        name: "Proberaumbörse Süd (Beispiel)",
        region: "Baden-Württemberg",
        title: "Diese Beispielquelle ist im Prototyp nicht angebunden.",
      },
      empty: "Keine Quelle gefunden. Die Liste zeigt nur die vorhandenen Demo-Quellen.",
      footnote: "Demo-Quellen. Keine vollständige Liste aller Portale.",
    },
    demo: {
      roomscout: {
        name: "roomscout.dev",
        desc: "Kontrolliertes Demo-Portal",
        profile: "Herzbuben",
      },
      musiker: {
        name: "Musiker in deiner Stadt",
        desc: "Stuttgart · Öffentliche Anzeigen",
      },
      bandnet: {
        name: "Bandnet Hamburg",
        desc: "Hamburg · Andere Region",
      },
    },
  },
  // §17.3 Verbindung zu roomscout.dev (sheet)
  connection: {
    title: "Verbindung zu roomscout.dev",
    closeAria: "Schließen",
    field: {
      profile: "Portalprofil",
      state: "Zustand",
      lastAccess: "Letzter erfolgreicher Zugriff",
    },
    state: {
      connected: "Verbunden",
      expired: "Anmeldung erneut nötig",
      disconnected: "Nicht verbunden",
    },
    lastAccess: {
      connectedNone: "In dieser Demo noch kein Zugriff",
      none: "Noch kein Zugriff",
    },
    explain: "Mit diesem Zugang kann dein Scout Anzeigen auf roomscout.dev lesen, Anbieter anschreiben und Antworten im Portal abrufen. Zugangsdaten werden im Prototyp nicht gespeichert.",
    disconnect: "Verbindung trennen",
    confirm: {
      body: "RoomScout verliert den gespeicherten Zugang. Dein Account auf dem Portal bleibt bestehen.",
      stay: "Verbunden bleiben",
      disconnect: "Verbindung trennen",
    },
    disconnected: {
      hint: "Zum Lesen oder Senden privater Nachrichten musst du dich verbinden.",
      cta: "Anmeldung öffnen",
    },
    login: {
      eyebrow: "Demo-Anmeldesimulation",
      body: "Dies ist keine echte Login-Seite von roomscout.dev. Es werden keine Zugangsdaten abgefragt oder gespeichert. Die Anmeldung wird lokal simuliert.",
      cancel: "Abbrechen",
      finish: "Demo-Anmeldung abschließen",
    },
    msg: {
      removed: "Zugang entfernt. Dein Account auf dem Portal bleibt bestehen.",
      saved: "Zugang gespeichert. Dein Scout kann weitermachen.",
    },
  },
  // §17.4 Handlungsspielraum
  autonomy: {
    title: "So arbeitet dein Scout",
    subtitle: "Du bestimmst, wie selbstständig ich vorgehe.",
    modeGroupAria: "Arbeitsmodus",
    mode: {
      autopilot: {
        title: "Autopilot",
        sub: "Suchen, anfragen und Details klären.",
      },
      review: {
        title: "Mit Rücksprache",
        sub: "Nachrichten vor dem Versand prüfen.",
      },
    },
    actions: {
      label: "Was ich selbstständig erledigen darf",
      details: "Anschreiben umfasst Erstanfragen und Nachfragen zu Verfügbarkeit, Preis und Ausstattung. Besichtigungen werden nur vorgeschlagen, nie verbindlich zugesagt. Eine eigene Suchanzeige wäre öffentlich sichtbar und enthält nur freigegebene Informationen.",
    },
    details: {
      toggle: "Details",
    },
    action: {
      contact: "Anbieter anschreiben und nachfassen",
      viewings: "Besichtigungstermine vorschlagen",
      publishAd: "Eigene Suchanzeige veröffentlichen",
    },
    share: {
      label: "Was ich teilen darf",
      details: "Bandprofil: Bandname, Besetzung, Musikrichtung, gewünschte Probezeiten und die Scout-Adresse. Privat: persönliche Telefonnummern und genaue Wohnadressen. Diese Freigabe gilt unabhängig vom Arbeitsmodus.",
      profile: "Bandprofil, Verfügbarkeit und Scout-Adresse",
      private: "Private Telefonnummer und genaue Adresse",
    },
    limits: {
      label: "Grenzen",
      perDay: "Neue Anbieter pro Tag",
      decAria: "Weniger",
      incAria: "Mehr",
      more: "Weitere Grenzen",
      invalid: "Bitte eine ganze Zahl größer als 0 eingeben.",
      caption: "Gemeint sind neue kontaktierte Anbieter, nicht die Nachrichten in einer laufenden Unterhaltung.",
      periodLabel: "Suchzeitraum:",
      periodValue: "bis ihr den Suchauftrag beendet oder ein Angebot annehmt.",
      stopsLabel: "Geltende Stopps:",
      stopsValue: "Suche jederzeit im Hauptbereich pausierbar; verbindliche Zusagen nie automatisch.",
      budgetLabel: "Budget:",
      budgetValue: "gehört zum Suchauftrag.",
      budgetLink: "Suchauftrag bearbeiten",
    },
    lock: {
      title: "Verbindliche Entscheidungen bleiben bei dir.",
      sub: "Verträge, Buchungen und Zahlungen brauchen immer deine Freigabe.",
    },
    saved: "Handlungsspielraum aktualisiert",
    cancel: "Abbrechen",
    save: "Änderungen speichern",
  },
  // §17.5 Änderungen verwerfen (dialog)
  discard: {
    title: "Änderungen verwerfen?",
    body: "Dein Handlungsspielraum hat ungespeicherte Änderungen.",
    keep: "Weiter bearbeiten",
    discard: "Verwerfen",
  },
  // §17.6 Was dein Scout weiß
  knowledge: {
    title: "Was ich über euch weiß",
    subtitle: "Korrigiere mich jederzeit. Ihr bestimmt, was ich mir merke.",
    summary: {
      demo: "Ihr seid eine vierköpfige Band aus Stuttgart. Ihr sucht einen geteilten Proberaum und möchtet euer Schlagzeug dort lassen.",
      editAria: "Zugrunde liegende Angaben bearbeiten",
    },
    tab: {
      band: "Eure Band",
      alltag: "Alltag & Wege",
      ausstattung: "Ausstattung",
    },
    empty: {
      band: "Über eure Band weiß ich noch nichts. Erzähl es mir beim nächsten Gespräch.",
      alltag: "Zu euren Wegen weiß ich noch nichts. Du kannst es mir beim nächsten Gespräch erzählen.",
      ausstattung: "Zu eurer Ausstattung weiß ich noch nichts. Du kannst es mir beim nächsten Gespräch erzählen.",
    },
    edit: {
      inputAria: "Angabe bearbeiten",
      save: "Speichern",
      cancel: "Abbrechen",
      factHint: "Diese Angabe ist Teil eures Suchauftrags und wird dort ebenfalls aktualisiert.",
    },
    badge: {
      assumed: "Noch zu bestätigen",
    },
    origin: {
      line: "Herkunft: {origin}. Verwendet für: {usage}.",
      confirmedByYou: "Von euch bestätigt · Präferenz, kein Ausschluss",
      imported: "Importiert aus Beispiel-Kontext",
    },
    usage: {
      fact: "Suchauftrag und Anfragen",
      preference: "Einordnung von Räumen und Mitnutzern, kein harter Filter",
    },
    action: {
      confirm: "Stimmt",
      dismiss: "Nicht wichtig",
      editAria: "Bearbeiten",
      menuAria: "Mehr",
    },
    menu: {
      retire: "Nicht mehr verwenden",
      origin: "Herkunft ansehen",
    },
    undo: {
      text: "„{text}“ wird nicht mehr verwendet.",
      action: "Rückgängig",
    },
    log: {
      show: "Änderungsverlauf ansehen",
      hide: "Änderungsverlauf ausblenden",
      empty: "Noch keine Änderungen in dieser Demo.",
      demoEntry: "Budget korrigiert: 400 → 350 €",
      demoWhen: "Heute",
      entry: {
        corrected: "Angabe korrigiert: {text}",
        retired: "Angabe nicht mehr verwenden: {text}",
        confirmed: "Präferenz bestätigt: {text}",
        dismissed: "Annahme verworfen: {text}",
        undo: "Rückgängig: {text}",
        // Hard plural: interpolates {n} but has no singular in §17.6, so n=1 renders
        // "1 Angaben …". COMPONENT_MAP.md §6.3 does not list this key among its four plural
        // cases and the doc supplies no `one` form, so it stays verbatim; a singular has to be
        // authored through DECISIONS.md item 15 / REVIEW_COPY.md before it can become
        // { one, other } like its dialog twin `knowledge.import.done`.
        imported: "{n} Angaben aus Beispiel-Kontext übernommen",
        rulesUpdated: "Handlungsspielraum aktualisiert",
      },
    },
    import: {
      title: "Dein bisheriger Kontext kann mitkommen",
      sub: "Musik-Kontext aus ChatGPT oder Claude übernehmen.",
      cta: "Kontext importieren",
      done: {
        one: "{n} Angabe übernommen.",
        other: "{n} Angaben übernommen.",
      },
    },
    managePrivacy: "Gespeicherte Informationen verwalten",
    toast: {
      factRetire: "Diese Angabe gehört zum Suchauftrag. Bearbeite sie dort oder korrigiere sie hier.",
      dismissed: "Nicht mehr in den aktiven Präferenzen. Andere Musikangaben bleiben erhalten.",
      noItems: "Noch keine Angaben vorhanden.",
    },
    demo: {
      f_band: {
        text: "Geteilter Raum · 4 Personen",
      },
      f_budget: {
        text: "Bis 350 € / Monat",
      },
      f_ort: {
        text: "Stuttgart",
      },
      f_zeit: {
        text: "Donnerstags ab 19 Uhr",
      },
      f_equip: {
        text: "Schlagzeug darf im Raum bleiben",
      },
      k_genre: {
        text: "Hardrock und Alternative",
      },
      k_mates: {
        text: "Ähnliche Musikrichtung bei Mitnutzern wichtig",
      },
      k_amps: {
        text: "Verstärker bringt ihr selbst mit",
      },
      origin: {
        fact: "Aus dem Gespräch · Teil eures Suchauftrags",
        bandprofile: "Demo-Bandprofil",
        assumption: "Annahme deines Scouts",
        conversation: "Aus dem Gespräch",
      },
    },
  },
  // §17.7 Kontext importieren (dialog)
  import: {
    step: "Schritt {n} von 3",
    closeAria: "Schließen",
    title: {
      "1": "Kontext vorbereiten",
      "2": "Ergebnis einfügen",
      "3": "Vor Übernahme prüfen",
    },
    step1: {
      intro: "Kopiere diesen Prompt in ChatGPT oder Claude und lass dir den musikbezogenen Kontext zusammenfassen.",
      prompt: "Fasse ausschließlich den musikbezogenen Kontext zusammen, den du tatsächlich über mich und meine Band kennst: Besetzung, Instrumente, Musikrichtung, Proberaumwünsche, Budget, Verfügbarkeit und relevante Wege. Erfinde nichts, kennzeichne Unsicheres und lasse Passwörter, Kontaktdaten und sachfremde persönliche Informationen weg. Falls dir kein solcher Kontext vorliegt, sage das ausdrücklich.",
      copy: "Prompt kopieren",
      copied: "Kopiert",
      next: "Weiter",
    },
    step2: {
      label: "Musik-Kontext einfügen",
      placeholder: "Zusammenfassung hier einfügen …",
      hint: "Bitte keine Zugangsdaten oder sensiblen Informationen einfügen. Der Text wird nach dem Import nicht gespeichert.",
      useExample: "Beispiel einsetzen",
      back: "Zurück",
      check: "Angaben prüfen",
    },
    example: "Wir sind eine fünfköpfige Band aus Stuttgart (zwei Gitarren, Bass, Schlagzeug, Gesang) und spielen Hardrock und Alternative. Wir proben meist abends nach 19 Uhr und kommen mit dem Auto, ein Parkplatz wäre hilfreich. Beim Budget bin ich unsicher, vermutlich bis 300 € im Monat.",
    step3: {
      free: "Freitext wird in diesem Prototyp nicht automatisch ausgewertet. Für die Demo steht das vorbereitete Beispiel bereit; eigene Angaben kannst du im Gespräch oder direkt in der Wissensliste ergänzen.",
      useExample: "Beispiel verwenden",
      intro: "Simulierte Auswertung des Beispiels. Wähle, was dein Scout sich merken soll.",
    },
    cand: {
      i1: "Fünf Bandmitglieder",
      i2: "Besetzung: zwei Gitarren, Bass, Schlagzeug, Gesang",
      i3: "Proben meist abends nach 19 Uhr",
      i4: "Anreise mit dem Auto, Parkplatz hilfreich",
      i5: "Budget bis 300 € (unsicher)",
    },
    conflict: {
      band: "Widerspricht „{text}“ im aktuellen Suchauftrag. Der Suchauftrag wird nicht überschrieben.",
      budget: "Als unsicher gekennzeichnet und abweichend vom Suchauftrag ({text}).",
      budgetPlain: "Als unsicher gekennzeichnet.",
    },
    pickCount: "{n} ausgewählt",
    back: "Zurück",
    apply: "Ausgewählte Angaben übernehmen",
  },
  // §17.8 Profil
  profile: {
    title: "Dein Profil",
    subtitle: "Wie soll dein Scout euch ansprechen?",
    nameLabel: "Anzeigename",
    save: "Speichern",
    saved: "Name gespeichert. Ansprache und Initialen sind aktualisiert.",
    login: {
      title: "Demo-Login",
      sub: "Lokale Beispielidentität „herzbuben“ · keine echte Anmeldung",
      badge: "Designprototyp",
    },
    footnote: "Externe Portal-Accounts und deine Scout-Adresse werden bei einer Namensänderung nicht umbenannt.",
    initialsFallback: "–",
  },
  // §17.9 Benachrichtigungen
  notif: {
    title: "Wann soll ich mich melden?",
    subtitle: "Wichtiges erreicht dich immer in der App.",
    decision: {
      label: "Wenn deine Entscheidung nötig ist",
      sub: "Rückfragen, Freigaben und Angebote, die du prüfen sollst",
    },
    offer: {
      label: "Wenn ein Angebot eingeht",
      sub: "Konkrete Angebote mit Konditionen",
    },
    digest: {
      label: "Allgemeine Fortschritte als Zusammenfassung",
      sub: "Gelegentlicher Überblick über Suche und Anfragen",
    },
    channel: {
      label: "Kanal",
      aria: "Kanal",
      app: "In der App",
      mail: "Scout-Adresse (simuliert)",
    },
    footnote: "Präferenzen werden lokal gespeichert. Es wird keine Browser-Berechtigung angefragt und keine echte E-Mail versendet. Notwendige Entscheidungen bleiben in der App sichtbar, auch wenn Benachrichtigungen aus sind.",
    toast: {
      saved: "Gespeichert",
    },
  },
  // §17.10 Tarif & Nutzung
  billing: {
    title: "Tarif & Nutzung",
    subtitle: "Dein Zugang, deine Aktivität und deine Abrechnung.",
    access: {
      label: "Dein Zugang",
      plan: "Demo-Zugang",
      sub: "Kein kostenpflichtiges Abonnement aktiv.",
      cta: "Tarife ansehen",
    },
    tariff: {
      title: "Tarife sind noch nicht festgelegt.",
      body: "In diesem Prototyp kannst du RoomScout ausprobieren. Es wird nichts berechnet.",
    },
    usage: {
      label: "Aktivität im September",
      searches: {
        one: "Aktive Suche",
        other: "Aktive Suchen",
      },
      contacted: "Anbieter kontaktiert",
      talk: "Gespräche mit Scout",
      talkNone: "Noch nicht erfasst",
      footnote: "Aktivitätsübersicht, keine Abrechnungseinheiten.",
    },
    payment: {
      title: "Zahlungsdaten",
      sub: "Keine Zahlungsmethode hinterlegt",
      cta: "Verwalten",
    },
    address: {
      title: "Rechnungsadresse",
      sub: "Noch nicht hinterlegt",
      cta: "Hinzufügen",
    },
    pay: {
      title: "Zahlungsverwaltung ist noch nicht eingerichtet.",
      body: "Hier würdest du später deine Zahlungs- und Rechnungsdaten verwalten.",
    },
    invoices: {
      label: "Rechnungen",
      emptyTitle: "Noch keine Rechnungen",
      emptySub: "Hier findest du später deine Belege.",
    },
    footnote: "Produktkonzept · Noch keine Zahlungsintegration",
  },
  // §17.11 Datenschutz
  privacy: {
    title: "Deine Daten, deine Kontrolle",
    subtitle: "Was RoomScout in dieser Demo lokal speichert.",
    stored: {
      title: "Gespeicherte Angaben",
      sub: "{n} Angaben über eure Band und Suche",
      cta: "Gespeicherte Angaben ansehen",
    },
    transcript: {
      title: "Gesprächsverlauf",
      sub: "Mitschrift eurer Gespräche mit dem Scout, in der App einsehbar",
    },
    portals: {
      title: "Portalzugänge",
      // §17.11 ships one singular-only string. COMPONENT_MAP.md §6.3 lists this key as one of the
      // four plural cases and instructs: "give it a plural form in the port and note the change".
      // `one` = SETTINGS_SCREENS.md §17.11 `privacy.portals.sub`, verbatim.
      // `other` = docs/UI_PORT/REVIEW_COPY.md §10 (`settings.privacy.portals.sub.other`), status
      //   PROPOSED per DECISIONS.md item 15 — awaiting maintainer sign-off, not a source string.
      sub: {
        one: "{n} verbundener Portalzugang, simuliert",
        other: "{n} verbundene Portalzugänge, simuliert",
      },
      cta: "Portalzugänge verwalten",
    },
    export: {
      title: "Export",
      sub: "Exportiert ausschließlich die lokalen Demo-Daten dieses Prototyps als JSON.",
      cta: "Demo-Daten exportieren",
      filename: "roomscout-demo-daten.json",
      note: "Lokale Demo-Daten des Designprototyps",
    },
    delete: {
      title: "Konto löschen",
      body: "Im späteren Produkt würde hier die endgültige Löschung aller Kontodaten angestoßen. In dieser Demo gibt es dafür noch keine Funktion; der Demo-Neustart ersetzt sie nicht.",
    },
    vendors: {
      title: "Beteiligte Dienstleister",
      body: "Für Text und Auswertung, Quellenbeobachtung, Scout-Postfächer, Portal-Zugänge sowie Sprache: Convex, Firecrawl, AgentMail, Browserbase und OpenAI. Welche Daten dabei verarbeitet werden, hängt von der konkreten Funktion ab und wäre im Produkt einzeln erklärt.",
    },
    toast: {
      exported: "Lokale Demo-Daten exportiert.",
      exportFailed: "Export war nicht möglich.",
    },
  },
} as const;
