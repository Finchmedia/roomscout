/**
 * German copy dictionary — Scout surface (`scout.*`).
 *
 * Source: docs/UI_PORT/SCOUT_SCREENS.md §18 "Copy dictionary (DE)" (§18.1–§18.17, §18.19),
 * cross-checked against docs/UI_PORT/SCOUT_STATE.md §20 "Copy dictionary (DE)".
 * Extracted verbatim on 2026-09-09. Do not re-type or "improve" a string —
 * typography („ “ · – — € … ) is part of the value (COMPONENT_MAP.md §6.2 rule 2).
 *
 * §18.18 `demo.*` (28 keys, prototype dev bar) is NOT shipped here — see ./dev.ts
 * (COMPONENT_MAP.md §6.1 rule 2).
 *
 * Structural note: eleven doc keys are both a leaf and a namespace, which a TS object
 * literal cannot express. For those the bare value moves to a `.text` member — the
 * convention the doc itself already uses for `offer.stale.text` / `offer.stale.link`,
 * and SCOUT_STATE §20.13 for `settings.knowledge.k_genre.text` / `.origin`.
 * No string was changed; only these paths gained the `.text` segment:
 *   discovery.ended · facts.ort · activity.found · activity.found2 ·
 *   clarification.yes · clarification.no · offer.prompt · review.accept ·
 *   data.knowledge.genre · data.knowledge.mates · data.knowledge.amps
 */

export const scoutDe = {
  // §18.1 `chrome`
  chrome: {
    wordmark: "roomscout",
    badge: {
      running: "Scout ist unterwegs",
      paused: "Suche pausiert",
    },
    pause: {
      pause: "Suche pausieren",
      resume: "Suche fortsetzen",
    },
    avatar: {
      aria: "Profilmenü",
    },
    menu: {
      subtitle: "Persönlicher Bereich",
      settings: "Einstellungen",
      backToScout: "Zurück zum Scout",
    },
    settingsFooter: "Designprototyp · Beispieldaten",
  },
  // §18.2 `toast`
  toast: {
    action: "Zum Scout",
    dismiss: {
      aria: "Schließen",
    },
    approval: "Dein Scout wartet auf deine Freigabe",
    clarification: "Dein Scout hat eine Rückfrage",
    decision: "Dein Scout braucht eine Entscheidung",
    candidates: "Dein Scout hat Räume zum Vergleichen",
    offer: "Ein Angebot ist eingegangen",
  },
  // §18.3 `hint`
  hint: {
    voiceDisabled: "Voice Scout ist in dieser Demo deaktiviert. Das Gespräch läuft im Textmodus.",
    scoutNotDone: "Der Scout ist noch nicht fertig. Gleich kannst du antworten.",
    freeTextDiscovery: "Prototyp: Freitext wird hier nicht interpretiert. Nutze den vorbereiteten Antwortvorschlag oder formuliere ihn ähnlich.",
    sideNote: "Prototyp: Zusätzliche Hinweise werden hier nicht interpretiert. Der Scout arbeitet mit dem Suchauftrag weiter.",
    micSimulatedAutopilot: "Prototyp: Das Mikrofon ist simuliert. Die Demo läuft ohne Spracheingabe weiter.",
    clarificationNotUnderstood: "Prototyp: Diese Antwort wird nicht interpretiert. Antworte mit „Ja, Mittwoch passt“ oder „Nein, Donnerstag ist wichtig“.",
    micSimulatedClarification: "Prototyp: Das Mikrofon ist simuliert. Antworte per Klick oder Text.",
    freeQuestion: "Prototyp: Freie Fragen werden hier nicht interpretiert. Nutze die vorbereitete Frage.",
  },
  // §18.4 `transcript`
  transcript: {
    title: "Mitschrift",
    close: {
      aria: "Mitschrift schließen",
    },
    empty: "Noch keine Äußerungen.",
    who: {
      scout: "Dein Scout",
      user: "Du",
    },
  },
  // §18.5 `welcome`
  welcome: {
    greeting: "Hey {name}.",
    headline: "Finden wir euren Proberaum.",
    cta: {
      voice: "Mit Scout sprechen",
      text: "Lieber schreiben",
    },
    footnote: "Du erzählst. Dein Scout kümmert sich.",
  },
  // §18.6 `discovery`
  discovery: {
    speaker: {
      scout: "Dein Scout",
      user: "Du",
    },
    state: {
      listening: "Ich höre zu",
      micOff: "Mikro aus",
      thinking: "Ich denke kurz nach",
    },
    ended: {
      text: "Gespräch beendet. Eure Wünsche bleiben als Entwurf gespeichert.",
      resume: "Gespräch fortsetzen",
      viewBrief: "Suchauftrag ansehen",
    },
    controls: {
      micOn: "Mikro an",
      micOff: "Mikro aus",
      transcript: "Mitschrift",
      end: "Gespräch beenden",
      switchToText: "Zum Schreiben wechseln",
    },
    input: {
      aria: "Nachricht an deinen Scout",
      placeholder: {
        awaiting: "Antwort an deinen Scout …",
        busy: "Dein Scout spricht …",
      },
    },
    send: {
      aria: "Senden",
    },
    switchToVoice: {
      aria: "Zum Sprechen wechseln",
    },
    links: {
      transcript: "Mitschrift",
      end: "Gespräch beenden",
    },
    inlineBrief: {
      label: "Euer Suchauftrag", // dead binding, never rendered
    },
  },
  // §18.7 `script` — the scripted dialogue (also the transcript content and the text-mode suggestions)
  script: {
    s1: {
      scout: "Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?",
    },
    s2: {
      user: "Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat.",
    },
    s3: {
      scout: "Welche Tage passen euch zum Proben?",
    },
    s4: {
      user: "Donnerstags ab 19 Uhr wäre gut.",
    },
    s5: {
      scout: "Gibt es etwas, das im Raum vorhanden sein oder dort bleiben muss?",
    },
    s6: {
      user: "Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit.",
    },
    s7: {
      user: "Und beim Budget lieber maximal 350 Euro.",
    },
    s8: {
      scout: "Alles klar, maximal 350 Euro. So würde ich für euch suchen. Soll ich loslegen?",
    },
    memory: {
      amps: "Verstärker bringt die Band mit",
    },
    resumeSuggestion: "Ja, leg los.",
  },
  // §18.8 `facts` — fact labels
  facts: {
    ort: {
      text: "Stuttgart",
      umland: "Stuttgart & Umland",
    },
    budget: {
      "400": "Bis 400 € / Monat",
      "350": "Bis 350 € / Monat",
    },
    band: "Geteilter Raum · 4 Personen",
    zeit: {
      donnerstag: "Donnerstags ab 19 Uhr",
      mittwochOderDonnerstag: "Mittwoch oder Donnerstag ab 19 Uhr",
    },
    equip: "Schlagzeug darf im Raum bleiben",
  },
  // §18.9 `brief` (fact card, mobile sheet, brief stage)
  brief: {
    headline: "So suche ich für euch.",
    title: "Euer Suchauftrag",
    edit: {
      aria: "Suchauftrag bearbeiten",
    },
    editRow: {
      aria: "Kriterium bearbeiten",
    },
    cta: "Scout losschicken",
    caption: {
      line1: "Ich suche und frage selbstständig an.",
      line2: "Eine verbindliche Zusage gibst nur du.",
    },
    changeMore: "Noch etwas ändern",
    backToConvo: "Zurück zum Gespräch",
    save: "Übernehmen",
    cancel: "Abbrechen",
    sheet: {
      count: {
        one: "1 Wunsch gemerkt",
        other: "{count} Wünsche gemerkt",
      },
    },
  },
  // §18.10 `autopilot`
  autopilot: {
    headline: "Ich kümmere mich darum.",
    resume: "Fortsetzen",
    status: {
      start: "Alles klar. Ich suche passende Räume und kläre die Details. Ich melde mich, wenn ich euch brauche.",
      searching: "Ich suche nach passenden Räumen in Stuttgart.",
      found: "Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details.",
      asked: "Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist.",
      waiting: "Jetzt warte ich auf eine Antwort.",
      followUp: "Ich bestätige, dass Mittwoch für euch möglich ist, und lasse mir das Angebot geben.",
      alternative: "Ich frage nach einer Alternative zu Mittwoch und suche weiter.",
      noSource: "Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen.",
      noAccess: "Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.",
      prepared: "Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst.",
      searchAgain: "Ich suche erneut mit den neuen Kriterien.",
      requestOffer: "Ich frage beim {roomName} nach einem Angebot und kläre die Details.",
      keepSearching: "Alles klar, ich suche weiter und melde mich, sobald sich etwas Neues ergibt.",
      keepWaiting: "Alles klar, ich suche im Hintergrund weiter und melde mich.",
    },
    approval: {
      eyebrow: "Freigabe nötig",
      toLabel: "An: ",
      to: "Anbieter · Raum in Stuttgart-West · roomscout.dev",
      message: "Hallo, wir sind {name}, eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, {budget}, donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, {name} (über RoomScout)",
      contactOff: "Anschreiben ist in deinem Handlungsspielraum deaktiviert. Diese Nachricht geht nur mit deiner ausdrücklichen Freigabe raus.",
      release: "Nachricht freigeben",
      changeAutonomy: "Handlungsspielraum ändern",
    },
    blocked: {
      chooseSource: "Quelle auswählen",
      accessText: "Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.",
      accessLink: "Zu den Zugängen",
    },
    briefPill: "Stuttgart · bis 350 €", // = "Stuttgart · " + budget without "Bis "/" / Monat"
    brief: {
      title: "Euer Suchauftrag",
    },
    activity: {
      show: "Aktivität ansehen",
      hide: "Aktivität ausblenden",
    },
    sideNote: {
      placeholder: "Möchtest du mir noch etwas sagen?",
      aria: "Nachricht an deinen Scout",
      voice: {
        aria: "Mit Scout sprechen",
      },
    },
    footnote: "Du kannst die App schließen. Ich melde mich.",
  },
  // §18.11 `activity` — activity-list entries
  activity: {
    start: "Suchauftrag gestartet",
    found: {
      text: "Raum in Stuttgart-West gefunden",
      meta: "roomscout.dev · Demo-Portal",
    },
    contacted: "Anbieter über das Portal kontaktiert",
    waiting: "Warte auf Antwort",
    notif: "Benachrichtigung aus dem Portal erhalten",
    read: "Neue Nachricht im Portal gelesen",
    confirmed: "Mittwoch bestätigt, Angebot angefragt",
    alt: "Alternative zu Mittwoch angefragt",
    offer: "Angebot eingegangen",
    declined: "Anbieter hat abgesagt: Donnerstag nicht möglich",
    noMatch: "Kein weiterer passender Raum in Stuttgart gefunden",
    found2: {
      text: "Drei Räume zum Vergleich zusammengestellt",
      meta: "roomscout.dev · Demo-Portal",
    },
    briefAdjusted: "Suchauftrag angepasst: {label}",
    offerRequested: "Angebot angefragt: {short}",
  },
  // §18.12 `clarification`
  clarification: {
    headline: "Eine kurze Rückfrage.",
    eyebrow: "Raum in Stuttgart-West",
    question: "Donnerstag ist leider belegt. Wäre Mittwoch ab 19 Uhr auch möglich?",
    detail: "280 € inklusive Nebenkosten. Euer Schlagzeug kann im Raum bleiben.",
    yes: {
      text: "Ja, Mittwoch passt",
      userText: "Ja, Mittwoch passt auch.",
      reply: "Alles klar, Mittwoch geht also auch. Ich kläre den Rest.",
    },
    no: {
      text: "Nein, Donnerstag ist wichtig",
      userText: "Nein, Donnerstag ist wichtig.",
      reply: "Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter.",
    },
    input: {
      placeholder: "Nachricht an deinen Scout …",
      aria: "Antwort an deinen Scout",
    },
    send: {
      aria: "Senden",
    },
    voice: "Sprechen",
  },
  // §18.13 `offer`
  offer: {
    headline: "Ein Raum, der zu euch passt.",
    stale: {
      text: "Nach deiner Änderung muss das Angebot erneut geprüft werden.",
      link: "Angaben ansehen",
    },
    photo: {
      alt: "Proberaum mit Schlagzeug und Akustikpaneelen",
      pending: "Foto folgt vom Anbieter",
    },
    eyebrow: "Angebot eingegangen",
    title: "Euer {roomName}", // → "Euer Raum in Stuttgart-West"
    price: {
      perMonth: "/ Monat",
      note: "inklusive Nebenkosten",
    },
    cta: "Angebot prüfen",
    footnote: "Vor einer Zusage schauen wir uns alle Konditionen an.",
    prompt: {
      text: "Soll ich euch das Angebot erklären?",
      speaking: "Dein Scout",
    },
    talk: "Das Angebot liegt bei 280 Euro inklusive Nebenkosten. Ihr könnt mittwochs von 19 bis 22 Uhr proben, und euer Schlagzeug darf bleiben. Soll ich euch die übrigen Konditionen erklären?",
    talkCta: "Mit Scout sprechen",
    brief: {
      title: "Euer Suchauftrag",
    },
    briefPill: "Suchauftrag",
  },
  // §18.14 `review`
  review: {
    headline: "Passt das für euch?",
    price: {
      note: "inklusive Nebenkosten",
    },
    terms: {
      shared: "Geteilter Raum · 4 Personen",
      storage: "Schlagzeug-Lagerung bestätigt",
      start: "Beginn: 1. Oktober 2026",
      deposit: "Keine Kaution",
      notice: "Kündigungsfrist: ein Monat zum Monatsende",
      show: "Vollständige Bedingungen anzeigen",
      hide: "Vollständige Bedingungen ausblenden",
      full: "Geteilte Nutzung des Raums in Stuttgart-West durch vier Bandmitglieder, mittwochs 19–22 Uhr. Miete 280 € monatlich inklusive Nebenkosten, Beginn 1. Oktober 2026. Keine Kaution. Kündigungsfrist ein Monat zum Monatsende. Das eigene Schlagzeug darf dauerhaft im Raum gelagert werden. Verstärker werden von der Band mitgebracht.",
      demoNote: "Demo-Bedingungen. Im echten Produkt wäre hier das vollständige Angebot des Anbieters einsehbar.",
    },
    accept: {
      text: "Angebot annehmen",
      disclaimer: "Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet.",
    },
    question: {
      toggle: "Noch eine Frage klären",
      prepared: "Was passiert nach der Zusage?",
      answer: "Ich sage dem Anbieter verbindlich zu und schicke euch die Bestätigung mit allen Bedingungen. Ihr könnt ab dem 1. Oktober proben. In dieser Demo wird nichts versendet.",
      placeholder: "Frage an deinen Scout …",
      aria: "Frage an deinen Scout",
      send: {
        aria: "Senden",
      },
    },
  },
  // §18.15 `complete`
  complete: {
    headline: "Euer nächster Proberaum steht bereit.",
    subline: "Demo abgeschlossen — es wurde keine echte Zusage versendet.",
    summary: "{short} · {price} · {timeLower}", // z. B. "Stuttgart-West · 280 € / Monat · mittwochs 19–22 Uhr"
    restart: "Demo erneut ansehen",
  },
  // §18.16 `deadEnd`
  deadEnd: {
    headline: "Da komme ich gerade nicht weiter.",
    eyebrow: "Raum in Stuttgart-West",
    body: "Der Anbieter kann Donnerstag nicht anbieten. Weitere Räume in Stuttgart, die zu eurem Suchauftrag passen, habe ich aktuell nicht gefunden.",
    prompt: "Was wäre für euch denkbar? Ich passe den Suchauftrag nur an, wenn ihr es sagt.",
    option: {
      budget: {
        title: "Budget bis 400 €",
        sub: "Erweitert die Suche in Stuttgart um weitere Räume.",
      },
      umland: {
        title: "Umland einbeziehen",
        sub: "Esslingen, Ludwigsburg, Fellbach · 20 bis 30 Minuten Weg.",
      },
      zeit: {
        title: "Mittwoch doch erlauben",
        sub: "Der Raum in Stuttgart-West wäre dann verfügbar. Donnerstag bleibt gemerkt.",
      },
    },
    keepWaiting: "Nichts ändern, weiter suchen lassen",
    reply: {
      budget: "Alles klar, bis 400 Euro. Ich suche erneut in Stuttgart.",
      umland: "Alles klar, ich beziehe das Umland ein: Esslingen, Ludwigsburg und Fellbach.",
      zeit: "Alles klar, Mittwoch geht also auch. Ich frage den Raum in Stuttgart-West erneut an.",
    },
  },
  // §18.17 `candidates`
  candidates: {
    headline: "Drei Räume, die in Frage kommen.",
    subline: "Ich habe die Unterschiede nebeneinander gelegt. Ihr entscheidet, wo ich anfrage.",
    badge: {
      best: "Mein Vorschlag",
    },
    photo: {
      pending: "Foto folgt vom Anbieter",
    },
    budget: {
      ok: "Im Budget",
      over: "Über eurem Budget ({budget} €)",
    },
    cta: "Diesen Raum anfragen",
    keepSearching: "Keiner passt, weiter suchen",
    west: {
      name: "Raum in Stuttgart-West",
      short: "Stuttgart-West",
      price: "280 € / Monat",
      time: "Mittwochs, 19–22 Uhr",
      timeLower: "mittwochs 19–22 Uhr",
      storage: "Schlagzeug kann im Raum bleiben",
      way: "12 Min. mit der Stadtbahn",
      size: "ca. 28 m² · geteilt mit einer Band",
      note: "Günstigster Raum, aber nur mittwochs frei.",
    },
    esslingen: {
      name: "Raum in Esslingen",
      short: "Esslingen",
      price: "320 € / Monat",
      time: "Donnerstags, 19–23 Uhr",
      timeLower: "donnerstags 19–23 Uhr",
      storage: "Schlagzeug kann im Raum bleiben",
      way: "25 Min. mit der S-Bahn",
      size: "ca. 35 m² · geteilt mit zwei Bands",
      note: "Euer Wunschtag, dafür im Umland.",
    },
    ost: {
      name: "Raum in Stuttgart-Ost",
      short: "Stuttgart-Ost",
      price: "350 € / Monat",
      time: "Donnerstags, ab 20 Uhr",
      timeLower: "donnerstags ab 20 Uhr",
      storage: "Schlagzeug müsste abgebaut werden",
      way: "18 Min. mit der Stadtbahn",
      size: "ca. 22 m² · geteilt mit drei Bands",
      note: "Am Budgetlimit, und das Schlagzeug kann nicht bleiben.",
    },
  },
  // §18.19 Strings produced here but consumed by the Settings surface
  data: {
    name: {
      default: "Herzbuben",
    },
    initials: {
      default: "HB",
    },
    session: {
      held: "Gespräch pausiert · läuft weiter, wenn du zurückkehrst",
      paused: "Suche pausiert",
      running: "Scout ist unterwegs",
    },
    usage: {
      talk: "Noch nicht erfasst",
    },
    export: {
      hinweis: "Lokale Demo-Daten des Designprototyps",
    },
    knowledge: {
      origin: {
        conversation: "Aus dem Gespräch · Teil eures Suchauftrags",
      },
      genre: {
        text: "Hardrock und Alternative",
        origin: "Demo-Bandprofil",
      },
      mates: {
        text: "Ähnliche Musikrichtung bei Mitnutzern wichtig",
        origin: "Annahme deines Scouts",
      },
      amps: {
        text: "Verstärker bringt ihr selbst mit",
        origin: "Aus dem Gespräch",
      },
    },
    log: {
      factCorrected: "Angabe korrigiert: {label}",
      briefAdjusted: "Suchauftrag angepasst: {label}",
      rulesUpdated: "Handlungsspielraum aktualisiert",
      knowledgeImported: "{count} Angaben aus Beispiel-Kontext übernommen",
    },
    summary: {
      empty: "Ich weiß noch nichts über euch. Erzähl es mir beim nächsten Gespräch.",
      pattern: "Ihr seid eine [vierköpfige ]Band[ aus {ort}]. Ihr sucht einen [geteilten ]Proberaum[ und möchtet euer Schlagzeug dort lassen].",
    },
    source: {
      roomscout: {
        name: "roomscout.dev",
        desc: "Kontrolliertes Demo-Portal",
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
    time: {
      today: "Heute, {h}:{mm}",
    },
  },
} as const;
