// German copy dictionary — landing surface.
// Source: docs/UI_PORT/LANDING_SCREENS.md §17 "Copy dictionary (DE)" (§17.1–§17.11).
// Extracted verbatim from `Landing v2.dc.html` copy on 2026-09-09.
// §17.12 `v1.*` (43 keys, superseded Landing.dc.html copy) is deliberately NOT shipped
// (COMPONENT_MAP.md §6.1 rule 2). Singular `fact.*` here holds landing fact VALUES and is
// distinct from `scout.facts.*` (fact labels) — do not merge them (COMPONENT_MAP.md §6.1).
// Line breaks are keys (`.line1` / `.line2`), rendered with an explicit <br/> (§6.2 rule 5).
// Strings are verbatim, including `’ · – — € ↓ ↗`. Never re-type them.
// One shape edit vs. the doc: the doc lists `hero.cta.secondary` (leaf) and
// `hero.cta.secondary.arrow` (child) at the same path, which a nested object cannot express —
// the label ships as `hero.cta.secondary.label`, the arrow keeps `.arrow` (§6.2 rule 4).

export const landingDe = {
  // §17.1 Header
  header: {
    wordmark: "roomscout",
    nav: {
      how: "So funktioniert’s",
      features: "Dein Scout",
    },
    cta: {
      demo: "Demo starten",
    },
  },
  // §17.2 Hero
  hero: {
    eyebrow: "Euer persönlicher Proberaum-Scout",
    headline: {
      line1: "Ihr macht Musik.",
      line2: "Der Scout sucht den Raum.",
    },
    subline: "Erzählt, was ihr sucht. RoomScout übernimmt die Suche und klärt mit Anbietern, ob der Raum zu euch passt.",
    cta: {
      primary: "Demo ausprobieren",
      secondary: {
        label: "So funktioniert’s",
        arrow: "↓",
      },
    },
    disclaimer: "Früher Prototyp · Kontrollierte Demo",
    preview: {
      alt: "Beispielansicht der RoomScout-App: Der Scout arbeitet und wartet auf eine Antwort.",
      badge: "Beispielansicht",
    },
  },
  // §17.3 Intro „So funktioniert RoomScout“
  how: {
    eyebrow: "So funktioniert RoomScout",
    headline: {
      line1: "Ein Gespräch.",
      line2: "Dann übernimmt euer Scout.",
    },
    lead: "Von euren Wünschen bis zum konkreten Angebot.",
    link: {
      features: "Weiter zu den Funktionen ↓",
    },
  },
  // §17.4 Beat 1 — Gespräch
  convo: {
    status: {
      listening: "Ich höre zu",
    },
    speaker: {
      user: "Du",
    },
    line1: "Wir sind zu viert und suchen einen geteilten Proberaum in Stuttgart.",
    line2: "Bis 400 Euro im Monat. Unser Schlagzeug soll dort bleiben können.",
    line3: "Am liebsten donnerstags ab 19 Uhr.",
    line4: "Eigentlich lieber maximal 350 Euro.",
  },
  // §17.4 Beat 1 — Gespräch (fact VALUES, cf. scout.facts.* labels)
  fact: {
    ort: "Stuttgart & Umgebung",
    band: "Geteilter Raum · 4 Personen",
    budget: {
      initial: "Bis 400 € / Monat",
      corrected: "Bis 350 € / Monat",
    },
    zeit: "Donnerstags ab 19 Uhr",
    equip: "Schlagzeug darf im Raum bleiben",
  },
  // §17.4/§17.5 Suchauftrag — live panel + summary card
  brief: {
    panel: {
      title: "Euer Suchauftrag",
      caption: "Während ihr sprecht, merke ich mir, was zählt. Korrekturen ersetzen den alten Wert.",
    },
    card: {
      title: "So suche ich für euch.",
      heading: "Euer Suchauftrag",
      row1: "Stuttgart & Umgebung",
      row2: "Bis 350 € / Monat",
      row3: "Geteilter Raum · 4 Personen",
      row4: "Donnerstags ab 19 Uhr",
      row5: "Schlagzeug darf im Raum bleiben",
      cta: "Scout losschicken",
      note: {
        line1: "Ich suche und frage selbstständig an.",
        line2: "Eine verbindliche Zusage gebt nur ihr.",
      },
    },
  },
  // §17.6 Beat 3 — Der Scout arbeitet
  work: {
    headline: "Ich kümmere mich darum.",
    status1: "Ich suche passende Räume.",
    status2: "Ich kläre die offenen Fragen mit dem Anbieter.",
    status3: "Die Anfrage ist raus. Ich warte auf eine Antwort.",
    context: {
      pill: "Stuttgart · bis 350 €",
    },
    reassurance: "Ihr könnt die App schließen. Ich melde mich, wenn ich euch brauche.",
  },
  // §17.7 Beat 4 — Rückfrage
  clarify: {
    headline: "Nur echte Entscheidungen kommen zu euch.",
    card: {
      kicker: "Dein Scout",
      question: "Ein Raum passt zu euch. Donnerstag ist schon belegt — wäre Mittwoch ab 19 Uhr auch möglich?",
    },
    choice: {
      wednesday: "Mittwoch passt",
      thursday: "Donnerstag bleibt wichtig",
    },
    answer: {
      wednesday: "Mittwoch passt auch.",
      thursday: "Donnerstag bleibt wichtig.",
    },
    reply: {
      wednesday: "Alles klar, Mittwoch geht also auch. Ich kläre den Rest.",
      thursday: "Alles klar. Ich suche weiter nach Donnerstag.",
    },
    resume: "Beispiel fortsetzen (Mittwoch-Pfad)",
  },
  // §17.8 Beat 5 — Angebot
  offer: {
    headline: "Ein Raum, der zu euch passt.",
    image: {
      alt: "Proberaum mit Schlagzeug und Akustikpaneelen",
    },
    eyebrow: "Beispielangebot",
    title: "Stuttgart-West · Geteilter Proberaum",
    price: {
      amount: "280 €",
      period: "/ Monat",
      note: "inklusive Nebenkosten",
    },
    feature1: "Mittwochs, 19–22 Uhr",
    feature2: "Schlagzeug kann im Raum bleiben",
    cta: "Angebot prüfen",
    note: "Eine verbindliche Zusage gebt nur ihr.",
    footnote: "Beispielsuche · Ablauf verkürzt dargestellt",
  },
  // §17.9 Feature-Bento
  features: {
    eyebrow: "Mehr als eine Trefferliste",
    headline: {
      line1: "Ein Scout, der euch versteht.",
      line2: "Und dranbleibt.",
    },
    lead: "Eure Wünsche, eure Gespräche und eure Suche bleiben zusammen.",
    memory: {
      title: "Merkt sich, was euch wichtig ist.",
      subtitle: "Auch wenn sich eure Wünsche ändern.",
      panel: {
        label: "Eure Wünsche",
      },
      stamp: {
        idle: "Aktualisiert",
        updated: "Aktualisiert · gerade eben",
      },
      row: {
        band: "Geteilter Raum · 4 Personen",
        equip: "Schlagzeug darf bleiben",
        budget: {
          old: "400 €",
          new: "350 € / Monat",
        },
      },
    },
    followup: {
      title: "Bleibt an Antworten dran.",
      subtitle: "Ihr müsst nicht jedes Portal selbst prüfen.",
      msg1: {
        sender: "Anbieter",
        time: "Heute, 14:27",
        body: "Mittwoch wäre noch frei.",
      },
      msg2: {
        sender: "RoomScout",
        time: "Heute, 14:28",
        body: "Passt Mittwoch für euch?",
      },
    },
    sources: {
      title: "Behält eure Quellen im Blick.",
      subtitle: "Passende Anzeigen an einem Ort.",
      card: {
        listing: "Angebot · Stuttgart-West",
        wanted: "Gesuch · Band sucht Raum",
        shared: "Geteilter Raum",
      },
      pill: {
        city: "Stuttgart",
      },
    },
    autopilot: {
      title: "Übernimmt Arbeit. Nicht eure Entscheidung.",
      subtitle: "Anfragen laufen im Autopilot. Verbindliche Zusagen bleiben bei euch.",
      row1: {
        title: "Anbieter kontaktieren",
        sub: "Darf RoomScout für euch übernehmen.",
      },
      row2: {
        title: "Verbindlich zusagen",
        sub: "Bleibt immer bei euch.",
      },
      link: "So behaltet ihr die Kontrolle ↓",
    },
  },
  // §17.10 Kontrolle & FAQ
  control: {
    eyebrow: "Klar geregelt",
    headline: {
      line1: "Euer Scout übernimmt.",
      line2: "Ihr behaltet das letzte Wort.",
    },
    lead: "Ihr bestimmt, wo gesucht wird, was der Scout übernehmen darf und was er sich merkt.",
  },
  // §17.10 Kontrolle & FAQ
  faq: {
    q1: "Was darf der Scout selbstständig tun?",
    a1: "Er recherchiert und fragt unverbindlich an — innerhalb eures Suchauftrags. Verbindliche Zusagen, Buchungen und Zahlungen entscheidet ihr selbst. Quellen, Handlungsspielraum und Erinnerungen könnt ihr in den Einstellungen prüfen und ändern.",
    q2: "Muss ich mit dem Scout sprechen?",
    a2: "Nein. Ihr könnt sprechen oder schreiben. Beides gehört zur selben Suche.",
    q3: "Funktioniert das schon auf allen Portalen?",
    a3: "Noch nicht. Die aktuelle Demo zeigt den Ablauf auf einem von uns kontrollierten Testportal. Öffentliche Quellen und ihre Kontaktwege werden schrittweise geprüft und angebunden. In dieser Demo kontaktieren wir keine fremden Anbieter.",
  },
  // §17.11 Abschluss & Footer
  closing: {
    disclaimer: "Aktuell: kontrollierte Demo. Keine Anfragen an fremde Anbieter.",
    headline: "Bereit für euren nächsten Proberaum?",
    cta: {
      primary: "Demo ausprobieren",
      secondary: "Projekt ansehen ↗",
    },
  },
  // §17.11 Abschluss & Footer
  footer: {
    wordmark: "roomscout",
    tagline: "Ein persönlicher Scout für eure Proberaumsuche.",
    link: {
      github: "GitHub",
    },
    credit: "Entstanden beim Convex All Gas Hackathon.",
  },
} as const;
