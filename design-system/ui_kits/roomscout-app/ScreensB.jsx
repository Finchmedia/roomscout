const DS2 = window.RoomScoutDesignSystem_e8f376;
const { ScoutBlob: Blob2, Button: Btn, Icon: Ic, FactList: Facts, Composer: Comp, SummaryPill: Pill, Card: Crd, Overline: Ovl, ChatBubble: Bubble, Notice: Ntc, StatusDot: Dot2 } = DS2;

const STATUS = ['Ich suche nach passenden Räumen in Stuttgart.', 'Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details.', 'Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist.', 'Jetzt warte ich auf eine Antwort.'];
const START_LINE = 'Alles klar. Ich suche passende Räume und kläre die Details. Ich melde mich, wenn ich euch brauche.';
const FOLLOW_STATUS = 'Ich bestätige, dass Mittwoch für euch möglich ist, und lasse mir das Angebot geben.';
const ALT_STATUS = 'Ich frage nach einer Alternative zu Mittwoch und suche weiter.';
const OFFER_TALK = 'Das Angebot liegt bei 280 Euro inklusive Nebenkosten. Ihr könnt mittwochs von 19 bis 22 Uhr proben, und euer Schlagzeug darf bleiben. Soll ich euch die übrigen Konditionen erklären?';
const QA_A = 'Ich sage dem Anbieter verbindlich zu und schicke euch die Bestätigung mit allen Bedingungen. Ihr könnt ab dem 1. Oktober proben. In dieser Demo wird nichts versendet.';
const ACT = { start: { text: 'Suchauftrag gestartet' }, found: { text: 'Raum in Stuttgart-West gefunden', meta: 'roomscout.dev · Demo-Portal' }, contacted: { text: 'Anbieter über das Portal kontaktiert' }, waiting: { text: 'Warte auf Antwort' }, notif: { text: 'Benachrichtigung aus dem Portal erhalten' }, read: { text: 'Neue Nachricht im Portal gelesen' }, confirmed: { text: 'Mittwoch bestätigt, Angebot angefragt' }, alt: { text: 'Alternative zu Mittwoch angefragt' }, offer: { text: 'Angebot eingegangen' }, declined: { text: 'Anbieter hat abgesagt: Donnerstag nicht möglich' }, noMatch: { text: 'Kein weiterer passender Raum in Stuttgart gefunden' }, found2: { text: 'Drei Räume zum Vergleich zusammengestellt', meta: 'roomscout.dev · Demo-Portal' } };

/* Autopilot: status line + activity. The sequence is driven by `ap` (kind) from App state so it survives settings/operator overlays. */
function Autopilot({ go, facts, paused, narrow, ap, setAp, status, setStatus, activity, addActivity, rules, sources, flags, pending, setPending, waitingFor, setWaitingFor, openSettings, showHint, name }) {
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [actOpen, setActOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const T = React.useRef([]);
  const after = (ms, fn) => T.current.push(setTimeout(fn, ms));
  const usable = sources.filter(s => s.enabled && (s.kind === 'portal' || flags.publicSearch));
  const room = sources.find(s => s.id === 'roomscout');
  const budget = (facts.find(f => f.id === 'budget') || {}).label || 'bis 350 €';

  const attemptContact = () => {
    if (!usable.length || !room.enabled) { setStatus('Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen.'); setWaitingFor('source'); return; }
    if (room.access !== 'connected') { setStatus('Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.'); setWaitingFor('access'); return; }
    if (rules.mode === 'review' || !rules.contact) {
      const text = 'Hallo, wir sind ' + name + ', eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, ' + budget.replace('Bis', 'bis') + ', donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, ' + name + ' (über RoomScout)';
      setPending({ to: 'Anbieter · Raum in Stuttgart-West · roomscout.dev', text, reason: !rules.contact ? 'contact' : 'review' }); setStatus('Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst.'); setWaitingFor('release'); return;
    }
    setAp({ kind: 'contact' });
  };
  React.useEffect(() => {
    T.current.forEach(clearTimeout); T.current = [];
    if (paused || waitingFor || pending) return;
    const k = ap.kind;
    if (k === 'start') { setStatus(START_LINE); after(3800, () => setStatus(STATUS[0])); after(7800, () => { setStatus(STATUS[1]); addActivity(ACT.found); }); after(11800, attemptContact); }
    else if (k === 'retry') { attemptContact(); }
    else if (k === 'contact') { setStatus(STATUS[2]); addActivity(ACT.contacted); after(3000, () => { setStatus(STATUS[3]); addActivity(ACT.waiting); }); after(10000, () => { addActivity(ACT.notif); addActivity(ACT.read); go('clarification'); }); }
    else if (k === 'follow') { setStatus(ap.line || FOLLOW_STATUS); after(5000, () => { addActivity(ACT.offer); go('offer'); }); }
    else if (k === 'alt') { setStatus(ALT_STATUS); after(6000, () => { addActivity(ACT.declined); addActivity(ACT.noMatch); go('dead_end'); }); }
    else if (k === 'compromise') { setStatus(ap.line); if (ap.target === 'zeit') { after(3500, () => setStatus(FOLLOW_STATUS)); after(8500, () => { addActivity(ACT.offer); go('offer'); }); } else { after(3500, () => setStatus('Ich suche erneut mit den neuen Kriterien.')); after(7000, () => { addActivity(ACT.found2); go('candidates'); }); } }
    else if (k === 'keep') { setStatus(ap.line); }
    return () => T.current.forEach(clearTimeout);
  }, [ap, paused, waitingFor, pending, rules.mode, rules.contact, room.access, room.enabled, flags.publicSearch]);

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '16px 24px 32px', animation: 'rsFadeUp .6s ease both' }}>
      <Blob2 size={narrow ? 112 : 160} state={paused ? 'still' : 'idle'} style={{ marginBottom: narrow ? 30 : 48 }} />
      <h1 style={{ margin: 0, fontSize: narrow ? 34 : 'clamp(36px,5vw,58px)', lineHeight: 1.08, fontWeight: 300, letterSpacing: '-.02em' }}>Ich kümmere mich darum.</h1>
      <p key={status} aria-live="polite" style={{ margin: '22px 0 0', fontSize: 'clamp(17px,1.6vw,22px)', lineHeight: 1.45, color: 'var(--rs-ink-2)', maxWidth: 560, minHeight: 32, textWrap: 'balance', animation: 'rsFadeUp .5s ease both' }}>{paused ? 'Suche pausiert.' : status}</p>
      {pending && <Crd tone="accent" size="md" style={{ marginTop: 26, width: 'min(680px,100%)', animation: 'rsFadeUp .4s ease both' }}>
        <Ovl tone="accent" style={{ letterSpacing: '.14em' }}>Freigabe nötig</Ovl>
        <div style={{ marginTop: 10, fontSize: 14, color: 'var(--rs-ink-6)' }}>An: <span style={{ color: 'var(--rs-ink-2)' }}>{pending.to}</span></div>
        <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 12, background: 'var(--rs-surface-subtle)', fontSize: 15, lineHeight: 1.55 }}>{pending.text}</div>
        {pending.reason === 'contact' && <div style={{ marginTop: 10, fontSize: 13.5, color: 'var(--rs-ink-4)' }}>Anschreiben ist in deinem Handlungsspielraum deaktiviert. Diese Nachricht geht nur mit deiner ausdrücklichen Freigabe raus.</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><Btn size="sm" onClick={() => { setPending(null); setWaitingFor(null); setAp({ kind: 'contact' }); }}>Nachricht freigeben</Btn><Btn variant="link" size="2xs" style={{ fontSize: 14 }} onClick={() => openSettings('autonomy')}>Handlungsspielraum ändern</Btn></div>
      </Crd>}
      {waitingFor === 'source' && <Btn variant="secondary" size="xs" style={{ marginTop: 14 }} onClick={() => openSettings('sources')}>Quelle auswählen</Btn>}
      {waitingFor === 'access' && <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--rs-ink-2)', flexWrap: 'wrap', justifyContent: 'center' }}><Dot2 tone="warning" style={{ fontSize: 14 }}>Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.</Dot2><Btn variant="link" size="2xs" style={{ color: 'var(--rs-ink)', padding: '4px 6px', fontSize: 14 }} onClick={() => openSettings('sources')}>Zu den Zugängen</Btn></div>}
      <Pill size="lg" icon={<Ic name="search" size={18} />} chevron open={briefOpen} onClick={() => setBriefOpen(o => !o)} style={{ marginTop: 34 }}>Stuttgart · {budget.replace('Bis ', 'bis ').replace(' / Monat', '')}</Pill>
      {briefOpen && <Facts variant="compact" facts={facts} style={{ marginTop: 10 }} />}
      <Btn variant="ghost" icon={<Ic name="clock" size={18} />} style={{ marginTop: 22, fontSize: 15 }} onClick={() => setActOpen(o => !o)}>{actOpen ? 'Aktivität ausblenden' : 'Aktivität ansehen'}</Btn>
      {actOpen && <Crd size="sm" tone="faint" style={{ width: 'min(420px,100%)', padding: '16px 20px', animation: 'rsFadeUp .3s ease both' }}>
        {activity.map((a, k) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 12, alignItems: 'start', padding: '7px 0' }}><span style={{ marginTop: 6, width: 8, height: 8, borderRadius: '50%', background: k === activity.length - 1 ? 'var(--rs-orange)' : 'rgba(255,220,190,.35)', justifySelf: 'center' }} /><div><div style={{ fontSize: 15 }}>{a.text}</div>{a.meta && <div style={{ fontSize: 12.5, color: 'var(--rs-ink-6)', marginTop: 2 }}>{a.meta}</div>}</div></div>)}
      </Crd>}
      <div style={{ marginTop: 42, width: 'min(660px,100%)' }}><Comp value={note} onChange={setNote} onSubmit={() => { if (!note.trim()) return; setNote(''); showHint('Prototyp: Zusätzliche Hinweise werden hier nicht interpretiert. Der Scout arbeitet mit dem Suchauftrag weiter.'); }} onVoice={() => showHint('Prototyp: Das Mikrofon ist simuliert. Die Demo läuft ohne Spracheingabe weiter.')} divider placeholder="Möchtest du mir noch etwas sagen?" height={62} /></div>
      <div style={{ marginTop: 22, fontSize: 14, color: 'var(--rs-ink-6)' }}>Du kannst die App schließen. Ich melde mich.</div>
    </div>
  );
}

function Clarification({ go, setFacts, setTranscript, setAp, addActivity, showHint }) {
  const [answer, setAnswer] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const timer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const reply = (yes, text) => {
    setAnswer(yes ? 'yes' : 'no'); setTranscript(t => t.concat([{ who: 'user', text }, { who: 'scout', text: yes ? 'Alles klar, Mittwoch geht also auch. Ich kläre den Rest.' : 'Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter.' }]));
    if (yes) setFacts(f => f.map(x => x.id === 'zeit' ? { ...x, label: 'Mittwoch oder Donnerstag ab 19 Uhr', changed: true } : x));
    timer.current = setTimeout(() => { addActivity(yes ? ACT.confirmed : ACT.alt); setAp(yes ? { kind: 'follow' } : { kind: 'alt' }); go('scouting'); }, 3200);
  };
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '16px 24px 32px', animation: 'rsFadeUp .6s ease both' }}>
      <Blob2 size={118} state="listening" style={{ marginBottom: 34 }} />
      <h1 style={{ margin: 0, fontSize: 'clamp(34px,4.6vw,52px)', lineHeight: 1.1, fontWeight: 300, letterSpacing: '-.02em' }}>Eine kurze Rückfrage.</h1>
      <Crd size="lg" tone="soft" style={{ marginTop: 28, width: 'min(740px,100%)', textAlign: 'center' }}>
        <Ovl>Raum in Stuttgart-West</Ovl>
        <div style={{ marginTop: 14, fontSize: 'clamp(24px,2.6vw,34px)', lineHeight: 1.2, fontWeight: 300, letterSpacing: '-.01em', textWrap: 'balance' }}>Donnerstag ist leider belegt. Wäre Mittwoch ab 19 Uhr auch möglich?</div>
        <div style={{ marginTop: 16, fontSize: 16, color: 'var(--rs-ink-4)' }}>280 € inklusive Nebenkosten. Euer Schlagzeug kann im Raum bleiben.</div>
        {!answer && <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}><Btn variant="tint" size="sm" onClick={() => reply(true, 'Ja, Mittwoch passt auch.')}>Ja, Mittwoch passt</Btn><Btn variant="secondary" size="sm" onClick={() => reply(false, 'Nein, Donnerstag ist wichtig.')}>Nein, Donnerstag ist wichtig</Btn></div>}
      </Crd>
      <div style={{ width: 'min(740px,100%)', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
        {answer && <Bubble who="user">{answer === 'yes' ? 'Ja, Mittwoch passt auch.' : 'Nein, Donnerstag ist wichtig.'}</Bubble>}
        {answer && <Bubble who="scout" style={{ animationDelay: '.6s', opacity: 0, animationFillMode: 'both' }}>{answer === 'yes' ? 'Alles klar, Mittwoch geht also auch. Ich kläre den Rest.' : 'Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter.'}</Bubble>}
      </div>
      {!answer && <div style={{ marginTop: 22, width: 'min(740px,100%)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}><Comp value={draft} onChange={setDraft} onSubmit={() => { const l = draft.trim().toLowerCase(); if (!l) return; if (/\bnein\b|nicht|donnerstag ist wichtig/.test(l)) reply(false, draft.trim()); else if (/mittwoch|\bja\b|passt|ok|gern|klar/.test(l)) reply(true, draft.trim()); else showHint('Prototyp: Diese Antwort wird nicht interpretiert. Antworte mit „Ja, Mittwoch passt“ oder „Nein, Donnerstag ist wichtig“.'); }} showKeyboardIcon={false} height={58} /></div>
        <Btn variant="secondary" size="lg" icon={<Ic name="mic" size={18} />} style={{ height: 58, fontSize: 15 }} onClick={() => showHint('Prototyp: Das Mikrofon ist simuliert. Antworte per Klick oder Text.')}>Sprechen</Btn>
      </div>}
    </div>
  );
}

const CHECK = <Ic name="check" size={18} color="var(--rs-orange)" />;
function Offer({ go, facts, offer, offerStale, openSettings, narrow }) {
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [talk, setTalk] = React.useState(false);
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 24px 32px' }}>
      <h1 style={{ margin: '0 0 30px', fontSize: 'clamp(34px,4.6vw,52px)', lineHeight: 1.1, fontWeight: 300, letterSpacing: '-.02em', animation: 'rsFadeUp .6s ease both' }}>Ein Raum, der zu euch passt.</h1>
      {offerStale && <Ntc style={{ margin: '-12px 0 22px' }} action={<Btn variant="link" size="2xs" style={{ color: 'var(--rs-ink)', padding: '2px 4px', fontSize: 14 }} onClick={() => openSettings('knowledge')}>Angaben ansehen</Btn>}>Nach deiner Änderung muss das Angebot erneut geprüft werden.</Ntc>}
      <Crd size="xl" padding={0} style={{ width: 'min(1190px,100%)', display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) minmax(0,1.05fr)', overflow: 'hidden', animation: 'rsFadeUp .7s .1s ease both' }}>
        {offer.photo ? <img src={'../../' + offer.photo} alt="Proberaum mit Schlagzeug und Akustikpaneelen" style={{ display: 'block', width: '100%', height: '100%', minHeight: narrow ? 200 : 380, maxHeight: narrow ? 240 : 470, objectFit: 'cover' }} /> : <div style={{ minHeight: narrow ? 200 : 380, height: '100%', background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--rs-ink-6)' }}>Foto folgt vom Anbieter</div>}
        <div style={{ padding: 'clamp(24px,3vw,44px) clamp(24px,3.4vw,56px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <Ovl tone="accent">Angebot eingegangen</Ovl>
          <div style={{ marginTop: 18, fontSize: 'clamp(24px,2.4vw,32px)', letterSpacing: '-.01em' }}>Euer {offer.name}</div>
          <div style={{ marginTop: 6, fontSize: 'clamp(38px,3.8vw,52px)', letterSpacing: '-.02em', lineHeight: 1.1 }}>{offer.price.split(' ')[0]} € <span style={{ fontSize: '.6em', color: 'var(--rs-ink-2)' }}>/ Monat</span></div>
          <div style={{ marginTop: 6, fontSize: 18, color: 'var(--rs-ink-4)' }}>inklusive Nebenkosten</div>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 17 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{CHECK}{offer.time}</div><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{CHECK}{offer.storage}</div></div>
          <Btn size="md" style={{ marginTop: 30, alignSelf: 'flex-start', padding: '0 40px', height: 54 }} onClick={() => go('offer_review')}>Angebot prüfen</Btn>
          <div style={{ marginTop: 16, fontSize: 14, color: 'var(--rs-ink-6)' }}>Vor einer Zusage schauen wir uns alle Konditionen an.</div>
        </div>
      </Crd>
      <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}><Blob2 size={58} state={talk ? 'speaking' : 'idle'} /><div style={{ fontSize: 19 }}>{talk ? 'Dein Scout' : 'Soll ich euch das Angebot erklären?'}</div></div>
        {talk ? <div style={{ maxWidth: 620, fontSize: 17, lineHeight: 1.5, animation: 'rsFadeUp .4s ease both' }}>{OFFER_TALK}</div> : <Btn variant="secondary" size="base" icon={<Ic name="mic" size={18} />} style={{ height: 52, fontSize: 16 }} onClick={() => setTalk(true)}>Mit Scout sprechen</Btn>}
      </div>
      {briefOpen && <Facts variant="compact" facts={facts} style={{ marginTop: 28 }} />}
      <Pill icon={<Ic name="list" size={16} />} chevron open={briefOpen} onClick={() => setBriefOpen(o => !o)} style={{ marginTop: briefOpen ? 10 : 34 }}>Suchauftrag</Pill>
    </div>
  );
}

function Review({ go, offer, showHint }) {
  const [terms, setTerms] = React.useState(false);
  const [qOpen, setQOpen] = React.useState(false);
  const [qa, setQa] = React.useState(null);
  const [qDraft, setQDraft] = React.useState('');
  const rows = ['Geteilter Raum · 4 Personen', offer.time, 'Schlagzeug-Lagerung bestätigt', 'Beginn: 1. Oktober 2026', 'Keine Kaution', 'Kündigungsfrist: ein Monat zum Monatsende'];
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 24px 32px', animation: 'rsFadeUp .5s ease both' }}>
      <Blob2 size={64} state={qa ? 'speaking' : 'idle'} style={{ marginBottom: 22 }} />
      <h1 style={{ margin: '0 0 26px', fontSize: 'clamp(34px,4.6vw,52px)', lineHeight: 1.1, fontWeight: 300, letterSpacing: '-.02em' }}>Passt das für euch?</h1>
      <Crd size="xl" style={{ width: 'min(720px,100%)', padding: '28px clamp(22px,3vw,36px) 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}><img src={'../../' + (offer.photo || 'assets/proberaum.png')} alt="" style={{ width: 112, height: 84, objectFit: 'cover', borderRadius: 12, flex: 'none' }} /><div><Ovl>{offer.name}</Ovl><div style={{ marginTop: 6, fontSize: 26, letterSpacing: '-.01em' }}>{offer.price} <span style={{ fontSize: 16, color: 'var(--rs-ink-4)' }}>inklusive Nebenkosten</span></div></div></div>
        <div style={{ margin: '24px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '10px 24px', fontSize: 16 }}>{rows.map(r => <div key={r} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><span style={{ marginTop: 2 }}>{CHECK}</span>{r}</div>)}</div>
        <Btn variant="ghost" size="2xs" style={{ marginTop: 18, fontSize: 14, padding: '6px 0' }} onClick={() => setTerms(t => !t)}>{terms ? 'Vollständige Bedingungen ausblenden' : 'Vollständige Bedingungen anzeigen'}<Ic name="chevron-down" size={14} style={{ transform: terms ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }} /></Btn>
        {terms && <div style={{ marginTop: 8, padding: '16px 18px', borderRadius: 14, background: 'var(--rs-surface-subtle)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--rs-ink-2)', animation: 'rsFadeUp .3s ease both' }}>Geteilte Nutzung des Raums in Stuttgart-West durch vier Bandmitglieder, mittwochs 19–22 Uhr. Miete 280 € monatlich inklusive Nebenkosten, Beginn 1. Oktober 2026. Keine Kaution. Kündigungsfrist ein Monat zum Monatsende. Das eigene Schlagzeug darf dauerhaft im Raum gelagert werden. Verstärker werden von der Band mitgebracht.<div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--rs-ink-6)' }}>Demo-Bedingungen. Im echten Produkt wäre hier das vollständige Angebot des Anbieters einsehbar.</div></div>}
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12 }}><Btn size="md" block onClick={() => go('complete')}>Angebot annehmen</Btn><div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--rs-ink-4)', textAlign: 'center' }}>Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet.</div></div>
      </Crd>
      <Btn variant="link" style={{ marginTop: 20, fontSize: 15 }} onClick={() => setQOpen(o => !o)}>Noch eine Frage klären</Btn>
      {qOpen && <div style={{ marginTop: 8, width: 'min(720px,100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'rsFadeUp .3s ease both' }}>
        {!qa && <Btn variant="tint" size="2xs" style={{ fontWeight: 400 }} onClick={() => setQa({ q: 'Was passiert nach der Zusage?', a: QA_A })}>Was passiert nach der Zusage?</Btn>}
        {qa && <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}><Bubble who="user" compact style={{ fontSize: 16 }}>{qa.q}</Bubble><Bubble who="scout" style={{ fontSize: 16 }}>{qa.a}</Bubble></div>}
        <Comp value={qDraft} onChange={setQDraft} onSubmit={() => { const t = qDraft.trim(); if (!t) return; setQDraft(''); if (/zusage|danach|passiert|dann/.test(t.toLowerCase())) setQa({ q: t, a: QA_A }); else showHint('Prototyp: Freie Fragen werden hier nicht interpretiert. Nutze die vorbereitete Frage.'); }} showKeyboardIcon={false} placeholder="Frage an deinen Scout …" height={56} />
      </div>}
    </div>
  );
}

function Complete({ go, offer }) {
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 24px 40px' }}>
      <Blob2 size={96} style={{ marginBottom: 40 }} />
      <h1 style={{ margin: 0, fontSize: 'clamp(36px,5vw,58px)', lineHeight: 1.08, fontWeight: 300, letterSpacing: '-.02em', maxWidth: 720, textWrap: 'balance', animation: 'rsFadeUp .6s ease both' }}>Euer nächster Proberaum steht bereit.</h1>
      <div style={{ marginTop: 22, fontSize: 17, color: 'var(--rs-ink-4)', animation: 'rsFadeUp .6s .1s ease both' }}>Demo abgeschlossen — es wurde keine echte Zusage versendet.</div>
      <Pill size="md" style={{ marginTop: 28, height: 46, color: 'var(--rs-ink)', fontSize: 15, animation: 'rsFadeUp .6s .2s ease both' }}>{offer.short} · {offer.price} · {offer.timeLower}</Pill>
      <Btn variant="link" style={{ marginTop: 40, fontSize: 15, animation: 'rsFadeUp .6s .3s ease both' }} onClick={() => go('welcome', { reset: true })}>Demo erneut ansehen</Btn>
    </div>
  );
}

Object.assign(window, { Autopilot, Clarification, Offer, Review, Complete, ACT });
