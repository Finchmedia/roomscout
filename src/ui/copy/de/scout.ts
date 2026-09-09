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
 *
 * ── Deliberate port changes (§18 is otherwise reproduced byte-for-byte) ──────────────
 * Seven places knowingly depart from a literal §18 transcription. Each is recorded at the
 * key itself; the list is repeated here so a reviewer can find them without a diff:
 *   1. `facts.budget.lower.*` / `facts.budget.compact.*` — ADDED. §6.2 rule 4: the two
 *      `{budget}` consumers must not run German `.replace()` over a translated label.
 *   2. `autopilot.approval.budget.fallback` — ADDED from SCOUT_STATE §20.12
 *      (`scout.release.budget.fallback`); §18.10 has no key and `{budget}` would render raw.
 *   3. `autopilot.brief.pill.compact` / `.budget.fallback` — REPLACE §18.10's pre-resolved
 *      `autopilot.briefPill` literal. §6.2 rules 3+4; the pill has two values in the demo.
 *   4. `deadEnd.option.budget.title` — number parametrised per DECISIONS item 27.
 *   5. `data.summary.pattern` — REPLACED by per-case sentence templates per DECISIONS item 11.
 *   6. `data.time.today` — `{h}`/`{mm}` → `{time}` per COMPONENT_MAP §6.3 + DECISIONS item 44.
 *   7. `data.*` — every string the Settings surface also owns now names its `settings.*` twin
 *      in a comment (DECISIONS item 16: "Record the mapping in the copy layer").
 * Everything else in this file is verbatim. Four known copy defects are NOT silently fixed
 * here because fixing them would author German — they are marked `⚠ REVIEW` at the key and
 * routed through DECISIONS item 15 / REVIEW_COPY.md.
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
    // INTENTIONALLY DEAD, kept on purpose — not an oversight, do not "clean up" without a
    // decision. `briefOpenInline` is hard-coded `false` (SCOUT_SCREENS §19.1) and the key has
    // 0 references in the prototype template. It is shipped because §18.6 lists it and dropping
    // a documented key silently would read as a missing extraction. It is the fourth carrier of
    // "Euer Suchauftrag" (brief.title · autopilot.brief.title · offer.brief.title are the others),
    // so `en.ts` and the parity test must carry an entry that can never appear on screen.
    // Open question for the maintainer: drop this key, or wire the inline brief.
    inlineBrief: {
      label: "Euer Suchauftrag",
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
    // `{budget}` means three different things in the three §18/§20 keys that interpolate it —
    // a full label (`autopilot.approval.message`), a compact label (`autopilot.brief.pill.compact`)
    // and a bare number (`candidates.budget.over`, `deadEnd.option.budget.title`). All three are
    // verbatim, so the collision cannot be renamed away here; instead every resolved form is a
    // key of its own below, and no caller may transform a value from this bag.
    budget: {
      // §18.8 verbatim — the fact-card label.
      "400": "Bis 400 € / Monat",
      "350": "Bis 350 € / Monat",
      // Δ port (ADDED). The prototype derives the two forms below with German string surgery on
      // the label: `budget.replace('Bis','bis')` for the approval message (SCOUT_STATE.md:1026)
      // and `.replace('Bis ','bis ').replace(' / Monat','')` for the brief pill
      // (SCOUT_STATE.md:1273-1274). Both replacements are a no-op or a corruption in English
      // ("Up to €350 / month"), so COMPONENT_MAP §6.2 rule 4 requires the parts to be named keys.
      // The `350` forms are verbatim (SCOUT_STATE §20.12 / §20.11 fallbacks); the `400` forms are
      // the same documented transformation applied to the verbatim §18.8 `400` label.
      lower: {
        "400": "bis 400 € / Monat",
        "350": "bis 350 € / Monat",
      },
      compact: {
        "400": "bis 400 €",
        "350": "bis 350 €",
      },
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
      // Plural, resolved through `Intl.PluralRules` (COMPONENT_MAP §6.3, one of its four cases).
      // The hard-coded numeral in `one` is NOT a transcription slip: §18.9 and COMPONENT_MAP
      // §6.2's own worked example both spell it "1 Wunsch gemerkt". SCOUT_STATE §20.11 disagrees
      // (`scout.sheet.title.one` = "{n} Wunsch gemerkt" / `.many` = "{n} Wünsche gemerkt") — two
      // source docs, and §18 wins as the canonical copy dictionary. Consequences to know:
      //   · `tp()` passes a `count` that the `one` branch ignores. Harmless for de/en, where
      //     `Intl.PluralRules` puts only exactly 1 in `one`; wrong for a locale whose `one`
      //     category also covers 21/31/… . Revisit if a third locale is ever added.
      //   · The placeholder is `{count}` here and `{n}` in the structurally identical
      //     `settings.knowledge.import.done`. Both names are verbatim and both are in §6.3's
      //     declared 18-placeholder union, so neither file may unilaterally rename its own.
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
      // ⚠ The TRAILING SPACE is load-bearing and verbatim from §18.10 — the label and the
      // recipient render on one line as `toLabel + to`. Do not trim it, and do not let a
      // formatter or a translation tool eat it; every locale must reproduce it (EN: "To: ").
      // SCOUT_STATE §20.12 gives the same key without the space (`scout.release.toLabel` =
      // "An:"), so the two docs disagree — §18.10 wins as the canonical copy dictionary.
      // Open question for the maintainer: move the gap into markup/CSS and store "An:" instead.
      toLabel: "An: ",
      to: "Anbieter · Raum in Stuttgart-West · roomscout.dev",
      // Composed: {name} twice + {budget} (COMPONENT_MAP §6.2 rule 4). {budget} takes a
      // `facts.budget.lower.*` value here (the full lowercase label), never a bare number —
      // see the placeholder note on `facts.budget`.
      message: "Hallo, wir sind {name}, eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, {budget}, donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, {name} (über RoomScout)",
      // Δ port (ADDED). SCOUT_STATE §11 builds the approval message as
      // `budget = facts.budget?.label ?? 'bis 350 € / Monat'` (SCOUT_STATE.md:1026). Without
      // this key a band with no budget fact renders the raw `{budget}` token or an empty gap.
      // Verbatim from SCOUT_STATE §20.12 `scout.release.budget.fallback`; §18.10 has no key
      // for it, which is why it sits under the §18 `approval` block rather than a `release` one.
      budget: {
        fallback: "bis 350 € / Monat",
      },
      contactOff: "Anschreiben ist in deinem Handlungsspielraum deaktiviert. Diese Nachricht geht nur mit deiner ausdrücklichen Freigabe raus.",
      release: "Nachricht freigeben",
      changeAutonomy: "Handlungsspielraum ändern",
    },
    blocked: {
      chooseSource: "Quelle auswählen",
      accessText: "Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.",
      accessLink: "Zu den Zugängen",
    },
    brief: {
      title: "Euer Suchauftrag",
      // Δ port (REPLACES §18.10's `autopilot.briefPill` = "Stuttgart · bis 350 €").
      // That literal is a COMPUTED value in the source, not a fixed string: SCOUT_SCREENS.md:983
      // and SCOUT_STATE.md:1273 both define it as
      //   'Stuttgart · ' + (facts.budget?.label ?? 'bis 350 €')
      //                      .replace('Bis ','bis ').replace(' / Monat','')
      // and it demonstrably takes a second value inside the demo — after the dead-end budget
      // compromise the same pill reads „Stuttgart · bis 400 €“ (SCOUT_SCREENS.md:983).
      // Freezing it breaks COMPONENT_MAP §6.2 rule 3 (never a computed string) and rule 4
      // (composed strings stay composed, with the parts named), and leaves `en.ts` no way to
      // re-derive the budget half. Both keys are verbatim from SCOUT_STATE §20.11
      // (`scout.brief.pill.compact` / `scout.brief.pill.budget.fallback`); they live under
      // `autopilot` because §18.10 is where the pill is rendered.
      // The city is hard-coded in the source and does NOT follow the `ort` fact — after the
      // Umland compromise the pill still says „Stuttgart“ (SCOUT_STATE.md:1273-1275). Preserved
      // deliberately; changing it is a product decision, not a copy one.
      // {budget} takes a `facts.budget.compact.*` value here.
      pill: {
        compact: "Stuttgart · {budget}",
        budget: {
          fallback: "bis 350 €",
        },
      },
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
      // ⚠ REVIEW — same defect as `complete.subline`: the trailing sentence „In dieser Demo wird
      // nichts versendet.“ is false in the real app, and the conditional „würde … zusagen“ with
      // it. DECISIONS item 30 covers only the complete subline, so no replacement has been
      // authored for this key or for `question.answer` below. Verbatim §18.14 until one is —
      // authoring it goes through DECISIONS item 15 into REVIEW_COPY.md.
      disclaimer: "Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet.",
    },
    question: {
      toggle: "Noch eine Frage klären",
      prepared: "Was passiert nach der Zusage?",
      // ⚠ REVIEW — ends with the same false demo sentence; see `accept.disclaimer` above.
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
    // ⚠ REVIEW — this line is FALSE in the real app, where the acceptance really is sent.
    // DECISIONS item 30 [decided, maintainer review pending] replaces it; the approved German
    // is already written down in REVIEW_COPY.md §5 (line 121), status PROPOSED:
    //   „Deine Zusage ist unterwegs zum Anbieter. Ich schicke euch die Bestätigung, sobald sie
    //    da ist.“ / "Your acceptance is on its way to the provider. I will send you the
    //    confirmation as soon as it arrives."
    // Not swapped in here because item 30 is the one Scout decision still gated on maintainer
    // review and SCOUT_SCREENS §12 (line 1197) has not been updated — so the extraction stays
    // faithful and the replacement stays one edit away. Ship the REVIEW_COPY line before this
    // dictionary is used outside the demo. REVIEW_COPY.md also flags the headline above as
    // overstating a sent acceptance (DATA_BINDING_PLAN §11 Q5, undecided — no copy proposed).
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
        // Δ port. §18.16 ships the frozen literal "Budget bis 400 €" and SCOUT_SCREENS.md:1229
        // still says "keep the literal, or wire the dynamic value deliberately" — but
        // DECISIONS item 27 has since decided [decided] to use the dynamic dead-end budget
        // line, `deadBudget = 'Bis ' + (budgetNum + 50) + ' €'` (SCOUT_STATE.md:1369). The doc
        // was never updated to match, so the two contradict each other.
        // Resolution taken here: apply item 27 to the NUMBER only. `{budget}` is the bare
        // next-step number (same meaning as in `candidates.budget.over`, € outside the token),
        // so at the default budget this still renders "Budget bis 400 €" character for
        // character. Item 27's literal `deadBudget` form („Bis 400 €“) is deliberately NOT
        // adopted: dropping the word „Budget“ is a copy edit, and §18 is canonical for wording.
        // Open question: confirm the wording, then correct SCOUT_SCREENS §13.
        title: "Budget bis {budget} €",
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
      // `{budget}` here is a BARE NUMBER ("350"), with the € sign outside the token — not the
      // full label that `autopilot.approval.message` puts in its identically named slot. See
      // the placeholder note on `facts.budget`.
      // Doc conflict, resolved in favour of §18: SCOUT_SCREENS §18.17 and REVIEW_COPY.md:107
      // both name the placeholder `{budget}`, SCOUT_STATE §20.6 (line 1650) calls it
      // `{budgetNum}`. `{budgetNum}` is not in COMPONENT_MAP §6.3's declared 18-placeholder
      // union and `{budget}` is, so §18 is right and SCOUT_STATE §20.6 needs the correction.
      // (This variant is computed but never rendered by the prototype; DECISIONS item 26 keeps
      // it in the build, so it does need a real EN pair — REVIEW_COPY.md §4 has one PROPOSED.)
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
  // §18.19 Strings produced here but consumed by the Settings surface.
  //
  // ⚠ 21 of these 27 keys are the SAME STRING as a key the Settings surface also owns. That is
  // faithful to the docs — §18.19 exists precisely because the Scout demo engine produces the
  // values Settings renders — but it means `en.ts` translates each string twice and the parity
  // test cannot catch a drift between the two copies. Per DECISIONS item 16 ("Canonical wording
  // is the prototype/design-system wording where it exists … Record the mapping in the copy
  // layer"), every duplicated key below names its `settings.*` twin. THE SCOUT KEY IS CANONICAL:
  // it is the producer, Settings is the consumer. If one of a pair has to change, change this
  // one first and carry the twin with it.
  // Open question for the maintainer: collapse each pair by having the Settings surface read
  // `scout.data.*` directly, which would delete ~21 keys from `settings.ts` and remove the drift
  // risk entirely. Not done unilaterally — it is a cross-surface refactor, not an extraction fix.
  data: {
    name: {
      default: "Herzbuben", // = settings.sources.demo.roomscout.profile · = common.demoName
    },
    initials: {
      default: "HB", // Scout-only; no Settings twin.
    },
    session: {
      held: "Gespräch pausiert · läuft weiter, wenn du zurückkehrst", // = settings.session.held
      paused: "Suche pausiert", // = settings.session.paused · = scout.chrome.badge.paused
      running: "Scout ist unterwegs", // = settings.session.working · = scout.chrome.badge.running
    },
    usage: {
      talk: "Noch nicht erfasst", // = settings.billing.usage.talkNone
    },
    export: {
      hinweis: "Lokale Demo-Daten des Designprototyps", // = settings.privacy.export.note
    },
    knowledge: {
      origin: {
        conversation: "Aus dem Gespräch · Teil eures Suchauftrags", // = settings.knowledge.demo.origin.fact
      },
      genre: {
        text: "Hardrock und Alternative", // = settings.knowledge.demo.k_genre.text
        origin: "Demo-Bandprofil", // = settings.knowledge.demo.origin.bandprofile
      },
      mates: {
        text: "Ähnliche Musikrichtung bei Mitnutzern wichtig", // = settings.knowledge.demo.k_mates.text
        origin: "Annahme deines Scouts", // = settings.knowledge.demo.origin.assumption
      },
      amps: {
        text: "Verstärker bringt ihr selbst mit", // = settings.knowledge.demo.k_amps.text
        origin: "Aus dem Gespräch", // = settings.knowledge.demo.origin.conversation
      },
    },
    log: {
      factCorrected: "Angabe korrigiert: {label}", // cf. settings.knowledge.log.entry.corrected ({text})
      briefAdjusted: "Suchauftrag angepasst: {label}", // = scout.activity.briefAdjusted
      rulesUpdated: "Handlungsspielraum aktualisiert", // = settings.autonomy.saved · = settings.knowledge.log.entry.rulesUpdated
      // ⚠ REVIEW — hard plural. Interpolates a count but has no `one` form, so n=1 renders
      // "1 Angaben aus Beispiel-Kontext übernommen". Left verbatim on purpose:
      //   · §18.19 supplies no singular, and authoring „{count} Angabe aus Beispiel-Kontext
      //     übernommen“ here would invent German copy — that goes through DECISIONS item 15
      //     into REVIEW_COPY.md, not into an extraction.
      //   · Its real twin, `settings.knowledge.log.entry.imported`, is the identical string and
      //     is shipped with the identical defect and the identical note. Fixing one and not the
      //     other would be worse than fixing neither. (The `{ one, other }` pair at
      //     `settings.knowledge.import.done` — „{n} Angabe übernommen.“ — is a DIFFERENT string:
      //     the import dialog's confirmation, not the change-log entry.)
      //   · COMPONENT_MAP §6.3 lists four plural cases and does not name this one, so the source
      //     doc is incomplete here too.
      // Note also the placeholder split: `{count}` per SCOUT §18.19, `{n}` in the Settings twin
      // per SETTINGS §17.6 / SCOUT_STATE §20.13. Both verbatim, both in §6.3's union.
      knowledgeImported: "{count} Angaben aus Beispiel-Kontext übernommen",
    },
    // Δ port (REPLACES §18.19's `data.summary.pattern`).
    // The doc value — "Ihr seid eine [vierköpfige ]Band[ aus {ort}]. …" — is NOTATION, not a
    // string: the square brackets are §18.19's shorthand for the optional segments that
    // SCOUT_STATE §5.3 concatenates at runtime (SCOUT_STATE.md:434). Passing it through
    // `interpolate()` renders literal `[` and `]` to the user.
    // DECISIONS item 11 [decided]: "Use per-case sentence templates in both dictionaries for
    // summary()" — precisely because SCOUT_STATE §20.13's alternative, a bag of nine fragments
    // with load-bearing leading/trailing spaces (`opener` = "Ihr seid eine ", `and` = " und "),
    // cannot be translated into English (the doc says so itself at SCOUT_STATE.md:1884-1886).
    // Each template below is one case of §5.3, spelled out; every word is verbatim from the
    // §20.13 fragment it comes from, and the default case renders byte-for-byte identically to
    // the sentence the doc prints at SCOUT_STATE.md:442 and to `settings.knowledge.summary.demo`.
    // `{ort}` survives as this dictionary's only use of that placeholder (COMPONENT_MAP §6.3).
    summary: {
      empty: "Ich weiß noch nichts über euch. Erzähl es mir beim nächsten Gespräch.", // §18.19 verbatim
      // Sentence 1 — picked by (band fact says four?) × (ort fact present?).
      band: {
        fourFromOrt: "Ihr seid eine vierköpfige Band aus {ort}.",
        four: "Ihr seid eine vierköpfige Band.",
        fromOrt: "Ihr seid eine Band aus {ort}.",
        plain: "Ihr seid eine Band.",
      },
      // Sentence 2 — omitted entirely when neither a band nor a drum-storage fact exists.
      seeks: {
        sharedAndStorage: "Ihr sucht einen geteilten Proberaum und möchtet euer Schlagzeug dort lassen.",
        shared: "Ihr sucht einen geteilten Proberaum.",
        roomAndStorage: "Ihr sucht einen Proberaum und möchtet euer Schlagzeug dort lassen.",
        room: "Ihr sucht einen Proberaum.",
        storage: "Ihr möchtet euer Schlagzeug dort lassen.",
      },
    },
    source: {
      roomscout: {
        name: "roomscout.dev", // = settings.sources.demo.roomscout.name
        desc: "Kontrolliertes Demo-Portal", // = settings.sources.demo.roomscout.desc
      },
      musiker: {
        name: "Musiker in deiner Stadt", // = settings.sources.demo.musiker.name
        desc: "Stuttgart · Öffentliche Anzeigen", // = settings.sources.demo.musiker.desc
      },
      bandnet: {
        name: "Bandnet Hamburg", // = settings.sources.demo.bandnet.name
        desc: "Hamburg · Andere Region", // = settings.sources.demo.bandnet.desc
      },
    },
    time: {
      // Δ port. §18.19 ships the prototype's hand-rolled clock, "Heute, {h}:{mm}" — two tokens,
      // with the caller zero-padding `mm` itself. COMPONENT_MAP §6.3 replaces exactly this
      // pattern with one token plus `Intl.DateTimeFormat`, because "Today, {h}:{mm}" cannot
      // produce the English forms; DECISIONS item 44 then fixes `hour12: false` for both
      // locales, so DE and EN share one formatter („Heute, 9:41“ / "Today, 9:41").
      //   time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit",
      //                                            hour12: false }).format(d)
      // `{time}` is the one port-introduced placeholder of §6.3, and the same edit was already
      // applied to `operator.sources.check.renewed`. Timestamps the Settings knowledge log
      // renders come through here. (`operator.host.now.format` still carries the raw
      // "{prefix}, {h}:{mm}" because §6.3 quotes that key verbatim — open question.)
      today: "Heute, {time}",
    },
  },
} as const;
